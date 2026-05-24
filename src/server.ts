import * as http from "node:http"
import * as QM from "./queue-manager"
import * as Storage from "./storage"
import { PREVIEW_LENGTH, SSE_HEARTBEAT_MS } from "./constants"
import { existsSync, readFileSync, appendFileSync } from "node:fs"
import { join, extname, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import type { SessionStatus, FailedItem } from "./types"

const DEBUG_ENABLED = !!process.env.OPENCODE_Q_DEBUG
const DEBUG_LOG = DEBUG_ENABLED
  ? join(dirname(fileURLToPath(import.meta.url)), "..", "..", "opencode-q-debug.log")
  : ""

function serverLog(msg: string) {
  if (!DEBUG_ENABLED) return
  try {
    const ts = new Date().toISOString()
    appendFileSync(DEBUG_LOG, `[${ts}] [server] ${msg}\n`)
  } catch {}
}

interface ServerConfig {
  baseDir: string
  sdkClient: any
  webDir?: string
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
}

function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk) => chunks.push(chunk))
    req.on("end", () => resolve(Buffer.concat(chunks).toString()))
    req.on("error", reject)
  })
}

function jsonResponse(res: http.ServerResponse, body: any, status = 200) {
  const data = JSON.stringify(body)
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) })
  res.end(data)
}

export function createHandler(config: ServerConfig) {
  const { baseDir, sdkClient, webDir } = config
  const sseClients: http.ServerResponse[] = []
  const lastFailedItem = new Map<string, FailedItem>()
  const lastSessionStatus = new Map<string, SessionStatus>()
  const aliasToReal = new Map<string, string>()

  function resolveSessionId(sid: string): string {
    return aliasToReal.get(sid) || sid
  }

  function setSessionIdMapping(alias: string, realId: string) {
    aliasToReal.set(alias, realId)
    serverLog(`sessionId mapping: "${alias}" -> "${realId}"`)
  }

  function broadcast(event: string, data: any) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    const dead: http.ServerResponse[] = []
    for (const client of sseClients) {
      try { client.write(msg) } catch { dead.push(client) }
    }
    for (const d of dead) {
      const idx = sseClients.indexOf(d)
      if (idx !== -1) sseClients.splice(idx, 1)
    }
  }

  function setSessionStatus(sessionId: string, status: SessionStatus, detail?: { prompt?: string; message?: string }) {
    lastSessionStatus.set(sessionId, status)
    const realId = aliasToReal.get(sessionId)
    broadcast("session-status", { status, sessionId, realSessionId: realId, prompt: detail?.prompt, message: detail?.message })
  }

  function serveStaticRes(webDir: string, urlPath: string, res: http.ServerResponse): boolean {
    let filePath = join(webDir, urlPath === "/" ? "index.html" : urlPath)
    if (!existsSync(filePath)) filePath = join(webDir, "index.html")
    if (!existsSync(filePath)) return false
    const ext = extname(filePath)
    const mime = MIME_TYPES[ext] || "application/octet-stream"
    const data = readFileSync(filePath)
    res.writeHead(200, { "Content-Type": mime, "Content-Length": data.length })
    res.end(data)
    return true
  }

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || "/", "http://localhost")
    const pathname = url.pathname

    if (pathname === "/api/events" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" })
      res.write(": connected\n\n")
      sseClients.push(res)
      const hb = setInterval(() => { try { res.write(": heartbeat\n\n") } catch { clearInterval(hb) } }, SSE_HEARTBEAT_MS)
      req.on("close", () => { clearInterval(hb); const i = sseClients.indexOf(res); if (i !== -1) sseClients.splice(i, 1) })
      return
    }

    let m: RegExpMatchArray | null

    m = pathname.match(/^\/api\/queue\/([^/]+)\/reorder$/)
    if (m && req.method === "PATCH") {
      const [, sid] = m
      const body = JSON.parse(await parseBody(req))
      try {
        const items = QM.reorder(baseDir, sid, body.from - 1, body.to - 1)
        broadcast("queue-updated", { sessionId: sid })
        jsonResponse(res, { items })
      } catch (e: any) { jsonResponse(res, { error: e.message }, 400) }
      return
    }

    m = pathname.match(/^\/api\/queue\/([^/]+)\/execute\/([^/]+)$/)
    if (m && req.method === "POST") {
      const [, sid, id] = m
      const data = Storage.load(baseDir, sid)
      const idx = data.items.findIndex((i) => i.id === id)
      if (idx === -1) { jsonResponse(res, { error: "Item not found" }, 404); return }
      const [item] = data.items.splice(idx, 1)
      Storage.save(baseDir, sid, data)
      if (!sdkClient) { data.items.unshift(item); Storage.save(baseDir, sid, data); jsonResponse(res, { error: "SDK not available" }, 503); return }
      try {
        const rid = resolveSessionId(sid)
        serverLog(`execute: alias=${sid}, real=${rid}, text="${item.text.slice(0, 50)}"`)
        const result = await sdkClient.prompt({ path: { id: rid }, body: { parts: [{ type: "text", text: item.text }] } })
        serverLog(`execute: returned — ${JSON.stringify(result)?.slice(0, 200)}`)
        broadcast("queue-updated", { sessionId: sid })
        jsonResponse(res, { executed: true, item })
      } catch (err) {
        data.items.unshift(item); Storage.save(baseDir, sid, data)
        lastFailedItem.set(sid, { item, retryCount: 0 })
        lastSessionStatus.set(sid, "error")
        broadcast("queue-updated", { sessionId: sid })
        broadcast("session-status", { status: "error", sessionId: sid, message: String(err) })
        jsonResponse(res, { error: String(err), item, canRetry: true }, 500)
      }
      return
    }

    m = pathname.match(/^\/api\/queue\/([^/]+)\/next$/)
    if (m && req.method === "POST") {
      const [, sid] = m
      const item = QM.dequeue(baseDir, sid)
      if (!item) { jsonResponse(res, { executed: false }); return }
      if (!sdkClient) { QM.reinsertAtFront(baseDir, sid, item); jsonResponse(res, { error: "SDK not available" }, 503); return }
      try {
        const rid = resolveSessionId(sid)
        serverLog(`next: alias=${sid}, real=${rid}`)
        await sdkClient.prompt({ path: { id: rid }, body: { parts: [{ type: "text", text: item.text }] } })
        broadcast("queue-updated", { sessionId: sid })
        jsonResponse(res, { executed: true, item })
      } catch (err) {
        QM.reinsertAtFront(baseDir, sid, item)
        lastFailedItem.set(sid, { item, retryCount: 0 })
        lastSessionStatus.set(sid, "error")
        broadcast("queue-updated", { sessionId: sid })
        broadcast("session-status", { status: "error", sessionId: sid, message: String(err) })
        jsonResponse(res, { error: String(err), item, canRetry: true }, 500)
      }
      return
    }

    m = pathname.match(/^\/api\/queue\/([^/]+)\/retry$/)
    if (m && req.method === "POST") {
      const [, sid] = m
      const failed = lastFailedItem.get(sid)
      if (!failed) { jsonResponse(res, { error: "No failed item" }, 404); return }
      if (failed.retryCount >= 3) { jsonResponse(res, { error: "Max retries exceeded", item: failed.item }, 429); return }
      if (!sdkClient) { jsonResponse(res, { error: "SDK not available" }, 503); return }
      try {
        const rid = resolveSessionId(sid)
        await sdkClient.prompt({ path: { id: rid }, body: { parts: [{ type: "text", text: failed.item.text }] } })
        lastFailedItem.delete(sid)
        broadcast("queue-updated", { sessionId: sid })
        jsonResponse(res, { executed: true, item: failed.item })
      } catch (err) {
        failed.retryCount++
        jsonResponse(res, { error: String(err), retryCount: failed.retryCount }, 500)
      }
      return
    }

    m = pathname.match(/^\/api\/queue\/([^/]+)\/skip$/)
    if (m && req.method === "POST") {
      const [, sid] = m
      const failed = lastFailedItem.get(sid)
      if (!failed) { jsonResponse(res, { error: "No failed item" }, 404); return }
      lastFailedItem.delete(sid)
      broadcast("queue-updated", { sessionId: sid })
      jsonResponse(res, { skipped: true, item: failed.item })
      return
    }

    m = pathname.match(/^\/api\/queue\/([^/]+)\/([^/]+)$/)
    if (m && req.method === "DELETE") {
      const [, sid, id] = m
      const removed = QM.remove(baseDir, sid, id)
      if (!removed) { jsonResponse(res, { error: "Item not found" }, 404); return }
      broadcast("queue-updated", { sessionId: sid })
      jsonResponse(res, { removed: true })
      return
    }

    m = pathname.match(/^\/api\/queue\/([^/]+)$/)
    if (m) {
      const [, sid] = m
      if (req.method === "GET") {
        const items = QM.getAll(baseDir, sid)
        const data = Storage.load(baseDir, sid)
        jsonResponse(res, { items, updatedAt: data.updatedAt })
        return
      }
      if (req.method === "POST") {
        const body = JSON.parse(await parseBody(req))
        try {
          const item = QM.add(baseDir, sid, body.text)
          broadcast("queue-updated", { sessionId: sid })
          jsonResponse(res, { item }, 201)
        } catch (e: any) { jsonResponse(res, { error: e.message }, 400) }
        return
      }
      if (req.method === "DELETE") {
        QM.clear(baseDir, sid)
        broadcast("queue-updated", { sessionId: sid })
        jsonResponse(res, { cleared: true })
        return
      }
    }

    m = pathname.match(/^\/api\/session\/([^/]+)$/)
    if (m && req.method === "GET") {
      const [, sid] = m
      const failed = lastFailedItem.get(sid)
      jsonResponse(res, { status: lastSessionStatus.get(sid) || "unknown", failedItem: failed?.item ?? null, retryCount: failed?.retryCount ?? 0 })
      return
    }

    if (webDir && serveStaticRes(webDir, pathname, res)) return

    jsonResponse(res, { error: "Not found" }, 404)
  }

  return { handler: handleRequest, broadcast, setSessionStatus, setSessionIdMapping }
}

let serverSingleton: {
  broadcast: (event: string, data: any) => void
  setSessionStatus: (sid: string, status: any, detail?: any) => void
  setSessionIdMapping: (alias: string, realId: string) => void
  server: http.Server
} | null = null

export function resetServerSingleton() {
  serverSingleton = null
}

function listenWithFallback(server: http.Server, port: number): Promise<number> {
  return new Promise((resolve) => {
    let retried = false

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE" && !retried) {
        retried = true
        serverLog(`Port ${port} in use, falling back to random port`)
        server.listen(0)
      } else {
        serverLog(`Server error: ${err}`)
      }
    })

    server.on("listening", () => {
      const addr = server.address()
      resolve(typeof addr === "object" && addr ? addr.port : port)
    })

    server.listen(port)
  })
}

export async function startServer(config: ServerConfig & { port: number }) {
  const { port, ...handlerConfig } = config
  const { handler, broadcast, setSessionStatus, setSessionIdMapping } = createHandler(handlerConfig)

  if (serverSingleton) {
    serverLog(`Server already running, reusing`)
    return { ...serverSingleton, port: (serverSingleton.server.address() as any)?.port ?? port }
  }

  const server = http.createServer((req, res) => {
    handler(req, res).catch((err) => {
      serverLog(`unhandled error: ${err}`)
      if (!res.headersSent) jsonResponse(res, { error: "Internal server error" }, 500)
    })
  })

  const actualPort = await listenWithFallback(server, port)
  serverLog(`server started at http://localhost:${actualPort}`)

  serverSingleton = { broadcast, setSessionStatus, setSessionIdMapping, server }
  return { broadcast, setSessionStatus, setSessionIdMapping, server, port: actualPort }
}
