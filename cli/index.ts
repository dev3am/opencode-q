import * as http from "node:http"
import { DEFAULT_PORT, PREVIEW_LENGTH } from "../src/constants"

const args = process.argv.slice(2)

function parseFlag(args: string[], flag: string, shortFlag: string): { value: string | null; rest: string[] } {
  const rest: string[] = []
  let value: string | null = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag || args[i] === shortFlag) {
      value = args[i + 1] || null
      i++
    } else {
      rest.push(args[i])
    }
  }
  return { value, rest }
}

const { value: projectPath, rest: rest1 } = parseFlag(args, "--project", "-p")
const { value: rawSession, rest: positional } = parseFlag(rest1, "--session", "-s")
const baseDir = projectPath || process.cwd()
const sessionId = rawSession || "default"
const serverPort = parseInt(process.env.OPENCODE_Q_PORT || String(DEFAULT_PORT), 10)

function request(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined
    const opts: http.RequestOptions = {
      hostname: "localhost",
      port: serverPort,
      path,
      method,
      headers: { "Content-Type": "application/json" },
    }
    if (bodyStr) opts.headers!["Content-Length"] = Buffer.byteLength(bodyStr)
    const req = http.request(opts, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk) => chunks.push(chunk))
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString()
        try { resolve({ status: res.statusCode || 200, json: JSON.parse(text) }) }
        catch { resolve({ status: res.statusCode || 200, json: text }) }
      })
    })
    req.on("error", reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

function projectBase(): string {
  return `/api/projects/${encodeURIComponent(baseDir)}`
}

function queueBase(): string {
  return `${projectBase()}/queue/${sessionId}`
}

function showHelp() {
  console.log(`opencode-q — Prompt queue manager for OpenCode

Usage:
  opencode-q add <text> [-p <path>] [-s <id>]     Add prompt
  opencode-q list [-p <path>] [-s <id>]            List queue
  opencode-q remove <id> [-p <path>] [-s <id>]     Remove by ID
  opencode-q clear [-p <path>] [-s <id>]           Clear queue
  opencode-q reorder <from> <to> [-p <path>] [-s <id>]  Reorder (1-based)
  opencode-q peek [-p <path>] [-s <id>]            Show next prompt
  opencode-q next [-p <path>] [-s <id>]            Execute next (dequeue)
  opencode-q sessions [-p <path>]                  List sessions
  opencode-q projects                              List active projects
  opencode-q logs                                  Show error logs
  opencode-q help                                  Show this help

Options:
  --project, -p <path>   Target project directory (default: cwd)
  --session, -s <id>     Target session ID (default: "default")

Environment:
  OPENCODE_Q_PORT   Server port (default: 4321)`)
}

async function requireServer(): Promise<boolean> {
  try {
    await request("GET", "/api/projects")
    return true
  } catch {
    console.error(`Error: opencode-q server is not running on port ${serverPort}`)
    console.error(`Start OpenCode first, or the server will auto-start when a plugin loads.`)
    return false
  }
}

const command = positional[0]

async function main() {
  switch (command) {
    case "projects": {
      if (!await requireServer()) return
      const res = await request("GET", "/api/projects")
      if (res.json.projects.length === 0) {
        console.log("No active projects")
        return
      }
      for (const p of res.json.projects) {
        const name = p.baseDir.split("/").pop() || p.baseDir
        const sessions = p.sessions.map((s: any) => `${s.sessionId} (${s.status})`).join(", ")
        console.log(`  ${name} — ${p.baseDir} [${sessions}]`)
      }
      return
    }

    case "logs": {
      const { homedir } = await import("node:os")
      const { join } = await import("node:path")
      const { existsSync, readFileSync } = await import("node:fs")
      const logFile = join(homedir(), ".config", "opencode", "opencode-q-errors.log")
      if (!existsSync(logFile)) {
        console.log("No error logs found.")
        return
      }
      const raw = readFileSync(logFile, "utf-8").trim()
      if (!raw) {
        console.log("No error logs found.")
        return
      }
      const logs = raw.split("\n")
      console.log(`--- Error Logs (${logs.length} entries) ---`)
      for (const line of logs) {
        if (!line) continue
        try {
          const entry = JSON.parse(line)
          console.log(`[${entry.timestamp}] Project: ${entry.project || "none"}`)
          console.log(`Message: ${entry.message}`)
          if (entry.stack) {
            console.log(`Stack:\n${entry.stack.split("\n").slice(0, 5).join("\n")}`)
          }
          console.log("-".repeat(40))
        } catch {
          console.log(line)
        }
      }
      return
    }

    case "add": {
      if (!await requireServer()) return
      const text = positional.slice(1).join(" ")
      if (!text) { console.error("Error: prompt text required"); process.exit(1) }
      const res = await request("POST", queueBase(), { text })
      if (res.status !== 201) { console.error(`Error: ${res.json.error}`); process.exit(1) }
      console.log(`Added #${res.json.item.id} [project: ${baseDir.split("/").pop()}, session: ${sessionId}]`)
      return
    }

    case "list": {
      if (!await requireServer()) return
      const res = await request("GET", queueBase())
      if (res.json.items.length === 0) { console.log(`Queue is empty [session: ${sessionId}]`); return }
      console.log(`Project: ${baseDir.split("/").pop()} | Session: ${sessionId}`)
      for (let i = 0; i < res.json.items.length; i++) {
        const item = res.json.items[i]
        const preview = item.text.length > PREVIEW_LENGTH ? item.text.slice(0, PREVIEW_LENGTH) + "..." : item.text
        console.log(`${i + 1}. [${item.id}] ${preview}`)
      }
      return
    }

    case "remove": {
      if (!await requireServer()) return
      const id = positional[1]
      if (!id) { console.error("Error: ID required"); process.exit(1) }
      const res = await request("DELETE", `${queueBase()}/${id}`)
      if (res.status !== 200) { console.error(`Not found (${id})`); process.exit(1) }
      console.log(`Removed (${id}) [session: ${sessionId}]`)
      return
    }

    case "clear": {
      if (!await requireServer()) return
      await request("DELETE", queueBase())
      console.log(`Queue cleared [session: ${sessionId}]`)
      return
    }

    case "reorder": {
      if (!await requireServer()) return
      const from = parseInt(positional[1], 10)
      const to = parseInt(positional[2], 10)
      if (isNaN(from) || isNaN(to)) { console.error("Error: from and to positions required (numbers)"); process.exit(1) }
      const res = await request("PATCH", `${queueBase()}/reorder`, { from, to })
      if (res.status !== 200) { console.error(`Error: ${res.json.error}`); process.exit(1) }
      console.log(`Reordered [session: ${sessionId}]:`)
      for (let i = 0; i < res.json.items.length; i++) console.log(`  ${i + 1}. [${res.json.items[i].id}]`)
      return
    }

    case "peek": {
      if (!await requireServer()) return
      const listRes = await request("GET", queueBase())
      if (listRes.json.items.length === 0) { console.log(`Queue is empty [session: ${sessionId}]`); return }
      const item = listRes.json.items[0]
      console.log(`[${item.id}] ${item.text} [session: ${sessionId}]`)
      return
    }

    case "next": {
      if (!await requireServer()) return
      const res = await request("POST", `${queueBase()}/next`)
      if (!res.json.executed) { console.log(`Queue is empty [session: ${sessionId}]`); return }
      console.log(res.json.item.text)
      return
    }

    case "sessions": {
      if (!await requireServer()) return
      const projRes = await request("GET", projectBase())
      const data = projRes.json
      if (data.sessions) {
        for (const s of data.sessions) console.log(`  ${s.sessionId} (${s.status})`)
      } else {
        console.log("No sessions found")
      }
      return
    }

    case "help":
    case "--help":
    case "-h":
      showHelp()
      return

    default:
      console.error(`Unknown command: ${command || "(none)"}`)
      showHelp()
      process.exit(1)
  }
}

main().catch((e) => { console.error(`Fatal: ${e.message}`); process.exit(1) })
