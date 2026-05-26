import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import * as http from "node:http"
import * as QM from "./queue-manager"
import { startServer } from "./server"
import { PREVIEW_LENGTH, DEFAULT_PORT, STORAGE_DIR } from "./constants"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const STATUS_MAP: Record<string, string> = {
  busy: "busy",
  idle: "idle",
  retry: "error",
}

const COMMANDS_DIR = "commands"
const COMMAND_DEFINITIONS: Record<string, string> = {
  "q-add": `---
description: 프롬프트를 큐에 추가합니다
---
q-add 툴을 사용하여 다음 프롬프트를 큐에 추가하세요: $ARGUMENTS`,
  "q-list": `---
description: 큐 목록을 조회합니다
---
q-list 툴을 사용하여 현재 큐의 모든 프롬프트를 조회하고 결과를 그대로 보여주세요.`,
  "q-remove": `---
description: 큐에서 프롬프트를 삭제합니다
---
q-remove 툴을 사용하여 다음 ID의 프롬프트를 큐에서 삭제하세요: $ARGUMENTS`,
  "q-clear": `---
description: 큐를 초기화합니다
---
q-clear 툴을 사용하여 큐의 모든 프롬프트를 삭제하세요.`,
  "q-reorder": `---
description: 큐 순서를 변경합니다
---
q-reorder 툴을 사용하여 큐의 프롬프트 순서를 변경하세요. from 위치: $1, to 위치: $2`,
  "q-next": `---
description: 다음 프롬프트를 실행합니다
---
q-next 툴을 사용하여 큐의 다음 프롬프트를 실행하세요.`,
}

function ensureCommands(baseDir: string): void {
  const commandsDir = join(baseDir, STORAGE_DIR, COMMANDS_DIR)
  if (!existsSync(commandsDir)) {
    mkdirSync(commandsDir, { recursive: true })
  }
  for (const [name, content] of Object.entries(COMMAND_DEFINITIONS)) {
    const filePath = join(commandsDir, `${name}.md`)
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content, "utf-8")
    }
  }
}

function startCallbackServer(client: any, mainPort: number, baseDir: string): Promise<{ port: number; url: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
        return
      }
      if (req.url === "/execute" && req.method === "POST") {
        const chunks: Buffer[] = []
        req.on("data", (c: Buffer) => chunks.push(c))
        req.on("end", async () => {
          try {
            const { text, realSessionId } = JSON.parse(Buffer.concat(chunks).toString())
            res.writeHead(202, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ accepted: true }))
            client.session.prompt({ path: { id: realSessionId }, body: { parts: [{ type: "text", text }] } })
              .then(async () => {
                await fetch(`http://localhost:${mainPort}/api/projects/${encodeURIComponent(baseDir)}/queue/default/execution-result`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ success: true }),
                })
              })
              .catch(async (err: any) => {
                await fetch(`http://localhost:${mainPort}/api/projects/${encodeURIComponent(baseDir)}/queue/default/execution-result`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ success: false, error: String(err), item: { text } }),
                })
              })
          } catch {
            if (!res.headersSent) {
              res.writeHead(400, { "Content-Type": "application/json" })
              res.end(JSON.stringify({ error: "Invalid request" }))
            }
          }
        })
        return
      }
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Not found" }))
    })
    server.listen(0, () => {
      const addr = server.address()
      const port = typeof addr === "object" && addr ? addr.port : 0
      resolve({ port, url: `http://localhost:${port}` })
    })
    server.on("error", reject)
  })
}

export default (async ({ client, directory, options }: any) => {
  const baseDir = directory
  ensureCommands(baseDir)

  const webDir = resolveWebDir()
  const desiredPort = options?.port ?? DEFAULT_PORT
  const { broadcast, setSessionIdMapping, setSessionStatus, registerProject, port: actualPort } = await startServer({ webDir, port: desiredPort })

  const callback = await startCallbackServer(client, actualPort, baseDir)

  registerProject({ baseDir, sdkClient: client.session, sessionId: "default", callbackUrl: callback.url })

  if (actualPort !== desiredPort) {
    client.tui.showToast({
      body: { message: `opencode-q: port ${desiredPort} was in use, using port ${actualPort}`, variant: "warning" },
    })
  }

  function mapSession(ctx: any) {
    if (ctx?.sessionID) setSessionIdMapping(baseDir, "default", ctx.sessionID)
  }

  return {
    event: async ({ event }: any) => {
      if (event.properties?.sessionID) {
        setSessionIdMapping(baseDir, "default", event.properties.sessionID)
      }

      if (event.type === "session.status") {
        const statusType = event.properties?.status?.type
        const sseStatus = STATUS_MAP[statusType]
        if (sseStatus) {
          setSessionStatus(baseDir, "default", sseStatus)
        }
        return
      }

      if (event.type === "session.idle") {
        const sid = event.properties?.sessionID || "default"
        const items = QM.getAll(baseDir, sid)
        if (items.length > 0) {
          await client.tui.showToast({
            body: {
              message: `${items.length}개의 대기 프롬프트가 있습니다. /q-next로 실행하세요`,
              variant: "info",
            },
          })
          broadcast("queue-updated", { baseDir, sessionId: sid, count: items.length })
        }
      }
    },

    tool: {
      "q-add": tool({
        description: "프롬프트를 큐에 추가합니다",
        args: {
          text: tool.schema.string(),
        },
        async execute(args: { text: string }, ctx: any) {
          mapSession(ctx)
          const item = QM.add(baseDir, "default", args.text)
          broadcast("queue-updated", { baseDir, sessionId: "default" })
          return `큐에 추가됨 (#${item.id})`
        },
      }),

      "q-list": tool({
        description: "큐의 모든 프롬프트를 조회합니다",
        args: {},
        async execute(_args: any, ctx: any) {
          mapSession(ctx)
          const items = QM.getAll(baseDir, "default")
          if (items.length === 0) return "큐가 비어있습니다"
          return items
            .map((item, i) => {
              const preview =
                item.text.length > PREVIEW_LENGTH
                  ? item.text.slice(0, PREVIEW_LENGTH) + "..."
                  : item.text
              return `${i + 1}. [${item.id}] ${preview}`
            })
            .join("\n")
        },
      }),

      "q-remove": tool({
        description: "큐에서 특정 프롬프트를 삭제합니다",
        args: {
          id: tool.schema.string(),
        },
        async execute(args: { id: string }, ctx: any) {
          mapSession(ctx)
          const removed = QM.remove(baseDir, "default", args.id)
          broadcast("queue-updated", { baseDir, sessionId: "default" })
          return removed
            ? `삭제됨 (${args.id})`
            : `항목을 찾을 수 없습니다 (${args.id})`
        },
      }),

      "q-clear": tool({
        description: "큐를 초기화합니다",
        args: {},
        async execute(_args: any, ctx: any) {
          mapSession(ctx)
          QM.clear(baseDir, "default")
          broadcast("queue-updated", { baseDir, sessionId: "default" })
          return "큐가 초기화되었습니다"
        },
      }),

      "q-reorder": tool({
        description:
          "큐의 프롬프트 순서를 변경합니다. 사용자가 입력한 1-based 위치를 0-based로 변환하여 처리합니다.",
        args: {
          from: tool.schema.number(),
          to: tool.schema.number(),
        },
        async execute(args: { from: number; to: number }, ctx: any) {
          mapSession(ctx)
          try {
            const items = QM.reorder(baseDir, "default", args.from - 1, args.to - 1)
            broadcast("queue-updated", { baseDir, sessionId: "default" })
            return `이동됨. 현재 순서:\n${items.map((item, i) => `${i + 1}. [${item.id}]`).join("\n")}`
          } catch (e) {
            return (e as Error).message
          }
        },
      }),

      "q-next": tool({
        description: "큐의 다음 프롬프트를 TUI 프롬프트 입력란에 채웁니다",
        args: {},
        async execute(_args: any, ctx: any) {
          mapSession(ctx)
          const item = QM.dequeue(baseDir, "default")
          if (!item) return "큐가 비어있습니다"
          await client.tui.appendPrompt({
            body: { text: item.text },
          })
          broadcast("queue-updated", { baseDir, sessionId: "default" })
          const preview =
            item.text.length > PREVIEW_LENGTH
              ? item.text.slice(0, PREVIEW_LENGTH) + "..."
              : item.text
          return `프롬프트가 입력되었습니다: "${preview}"`
        },
      }),
    },
  }
}) satisfies Plugin

function resolveWebDir(): string | undefined {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(__dirname, "web"),
    join(__dirname, "..", "..", "web", "dist"),
    join(process.cwd(), "web", "dist"),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) return dir
  }
  return undefined
}
