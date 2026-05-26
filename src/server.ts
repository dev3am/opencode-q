import * as http from "node:http"
import * as QM from "./queue-manager"
import * as Storage from "./storage"
import { SSE_HEARTBEAT_MS } from "./constants"
import { existsSync, readFileSync, appendFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, extname, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"
import type { SessionStatus, FailedItem, ProjectState, ProjectRegistration } from "./types"
import { REGISTRY_FILENAME } from "./constants"

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

function registryPath(): string {
  if (process.env.OPENCODE_Q_REGISTRY) return process.env.OPENCODE_Q_REGISTRY
  return join(homedir(), ".config", "opencode", REGISTRY_FILENAME)
}

interface RegistryEntry {
  baseDir: string
  sessionId: string
  status: string
  realSessionId: string | null
  callbackUrl?: string
}

function loadRegistry(): Map<string, ProjectState> {
  const file = registryPath()
  if (!existsSync(file)) return new Map()
  try {
    const raw = JSON.parse(readFileSync(file, "utf-8")) as { projects: RegistryEntry[] }
    const map = new Map<string, ProjectState>()
    for (const entry of raw.projects || []) {
      const sessions = new Map([[entry.sessionId, { status: entry.status as SessionStatus }]])
      const aliasToReal = new Map<string, string>()
      if (entry.realSessionId) aliasToReal.set("default", entry.realSessionId)
      map.set(entry.baseDir, { baseDir: entry.baseDir, sdkClient: null, callbackUrl: entry.callbackUrl, sessions, aliasToReal })
    }
    return map
  } catch {
    return new Map()
  }
}

function saveRegistry(projects: Map<string, ProjectState>): void {
  const dir = dirname(registryPath())
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const entries: RegistryEntry[] = []
  for (const p of projects.values()) {
    for (const [sid, s] of p.sessions) {
      entries.push({ baseDir: p.baseDir, sessionId: sid, status: s.status, realSessionId: p.aliasToReal.get("default") || null, callbackUrl: p.callbackUrl })
    }
  }
  writeFileSync(registryPath(), JSON.stringify({ projects: entries }), "utf-8")
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
  const { webDir } = config
  const sseClients: http.ServerResponse[] = []
  const projects = loadRegistry()

  function healthCheckCallbacks() {
    for (const [baseDir, project] of projects) {
      if (!project.callbackUrl) continue
      fetch(`${project.callbackUrl}/health`, { signal: AbortSignal.timeout(3000) })
        .then((r) => { if (!r.ok) throw new Error(`${r.status}`) })
        .catch(() => {
          serverLog(`health check failed: ${baseDir} (${project.callbackUrl})`)
          project.callbackUrl = undefined
          project.sdkClient = null
          for (const [, s] of project.sessions) { s.status = "unknown" }
          saveRegistry(projects)
          broadcast("projects-updated", {})
        })
    }
  }

  const healthCheckInterval = setInterval(healthCheckCallbacks, 15000)

  function ensureSession(project: ProjectState, sessionId: string, status: SessionStatus = "idle") {
    const s = project.sessions.get(sessionId)
    if (s) s.status = status
    else project.sessions.set(sessionId, { status })
  }

  function registerProject(reg: ProjectRegistration): void {
    const existing = projects.get(reg.baseDir)
    if (existing) {
      existing.sdkClient = reg.sdkClient
      if (reg.callbackUrl) existing.callbackUrl = reg.callbackUrl
      ensureSession(existing, reg.sessionId)
      existing.aliasToReal.set("default", reg.sessionId)
      serverLog(`project updated: ${reg.baseDir}`)
    } else {
      const state: ProjectState = {
        baseDir: reg.baseDir,
        sdkClient: reg.sdkClient,
        callbackUrl: reg.callbackUrl,
        sessions: new Map([[reg.sessionId, { status: "idle" as SessionStatus }]]),
        aliasToReal: new Map([["default", reg.sessionId]]),
      }
      projects.set(reg.baseDir, state)
      serverLog(`project registered: ${reg.baseDir}`)
    }
    saveRegistry(projects)
  }

  function unregisterProject(baseDir: string): boolean {
    const removed = projects.delete(baseDir)
    if (removed) {
      serverLog(`project unregistered: ${baseDir}`)
      saveRegistry(projects)
    }
    return removed
  }

  function getProjectState(baseDir: string): ProjectState | undefined {
    return projects.get(baseDir)
  }

  function requireProject(encodedBaseDir: string): { baseDir: string; project: ProjectState } | null {
    const baseDir = decodeURIComponent(encodedBaseDir)
    const project = getProjectState(baseDir)
    if (!project) return null
    return { baseDir, project }
  }

  function resolveSessionId(project: ProjectState, sid: string): string {
    return project.aliasToReal.get(sid) || sid
  }

  function setSessionIdMapping(baseDir: string, alias: string, realId: string) {
    const project = projects.get(baseDir)
    if (!project) return
    project.aliasToReal.set(alias, realId)
    serverLog(`sessionId mapping: "${alias}" -> "${realId}" [${baseDir}]`)
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

  function setSessionStatus(baseDir: string, sessionId: string, status: SessionStatus, detail?: { prompt?: string; message?: string }) {
    const project = projects.get(baseDir)
    if (!project) return
    ensureSession(project, sessionId, status)
    const realId = project.aliasToReal.get(sessionId)
    broadcast("session-status", { baseDir, status, sessionId, realSessionId: realId, prompt: detail?.prompt, message: detail?.message })
  }

  function executeViaCallback(project: ProjectState, sid: string, item: any): void {
    const url = project.callbackUrl
    if (!url) return
    const rid = resolveSessionId(project, sid)
    serverLog(`callback execute: alias=${sid}, real=${rid}, url=${url}`)
    fetch(`${url}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: item.text, realSessionId: rid }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`callback returned ${r.status}`)
        return r.json()
      })
      .then(() => {
        broadcast("queue-updated", { baseDir: project.baseDir, sessionId: sid })
      })
      .catch((err) => {
        const baseDir = project.baseDir
        QM.reinsertAtFront(baseDir, sid, item)
        const ss = project.sessions.get(sid)
        if (ss) { ss.failedItem = { item, retryCount: 0 }; ss.status = "error" }
        broadcast("queue-updated", { baseDir, sessionId: sid })
        broadcast("session-status", { baseDir, status: "error", sessionId: sid, message: String(err) })
      })
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

    if (pathname === "/api/projects" && req.method === "GET") {
      const merged = new Map(projects)
      const registry = loadRegistry()
      for (const [baseDir, state] of registry) {
        if (!merged.has(baseDir)) merged.set(baseDir, state)
      }
      const list = Array.from(merged.values()).map((p) => {
        const sessions = Array.from(p.sessions.entries()).map(([sid, s]) => ({ sessionId: sid, status: s.status }))
        return { baseDir: p.baseDir, sessions, hasSdk: !!p.sdkClient, hasCallback: !!p.callbackUrl }
      })
      jsonResponse(res, { projects: list })
      return
    }

    if (pathname === "/api/projects/register" && req.method === "POST") {
      const body = JSON.parse(await parseBody(req))
      if (!body.baseDir) { jsonResponse(res, { error: "baseDir is required" }, 400); return }
      registerProject({ baseDir: body.baseDir, sdkClient: null, sessionId: body.sessionId || "default", callbackUrl: body.callbackUrl })
      broadcast("projects-updated", {})
      jsonResponse(res, { registered: true, baseDir: body.baseDir })
      return
    }

    m = pathname.match(/^\/api\/projects\/([^/]+)$/)
    if (m) {
      const [, encodedBaseDir] = m
      const baseDir = decodeURIComponent(encodedBaseDir)
      if (req.method === "GET") {
        const project = getProjectState(baseDir)
        if (!project) { jsonResponse(res, { error: "Project not found" }, 404); return }
        const sessions = Array.from(project.sessions.entries()).map(([sid, s]) => ({ sessionId: sid, status: s.status }))
        jsonResponse(res, { baseDir: project.baseDir, sessions })
        return
      }
      if (req.method === "DELETE") {
        const removed = unregisterProject(baseDir)
        if (!removed) { jsonResponse(res, { error: "Project not found" }, 404); return }
        broadcast("projects-updated", {})
        if (projects.size === 0 && serverSingleton) {
          serverLog("last project unregistered, shutting down server")
          serverSingleton.server.close()
          serverSingleton = null
        }
        jsonResponse(res, { unregistered: true })
        return
      }
    }

    m = pathname.match(/^\/api\/projects\/([^/]+)\/session\/([^/]+)\/status$/)
    if (m && req.method === "PUT") {
      const [, encodedBaseDir, sid] = m
      const rp = requireProject(encodedBaseDir)
      if (!rp) { jsonResponse(res, { error: "Project not registered" }, 404); return }
      const { project } = rp
      const body = JSON.parse(await parseBody(req))
      setSessionStatus(rp.baseDir, sid, body.status, body)
      jsonResponse(res, { updated: true })
      return
    }

    m = pathname.match(/^\/api\/projects\/([^/]+)\/session\/([^/]+)\/mapping$/)
    if (m && req.method === "PUT") {
      const [, encodedBaseDir, sid] = m
      const rp = requireProject(encodedBaseDir)
      if (!rp) { jsonResponse(res, { error: "Project not registered" }, 404); return }
      const body = JSON.parse(await parseBody(req))
      setSessionIdMapping(rp.baseDir, body.alias || sid, body.realId)
      saveRegistry(projects)
      jsonResponse(res, { updated: true })
      return
    }

    m = pathname.match(/^\/api\/projects\/([^/]+)\/queue\/([^/]+)\/execution-result$/)
    if (m && req.method === "POST") {
      const [, encodedBaseDir, sid] = m
      const rp = requireProject(encodedBaseDir)
      if (!rp) { jsonResponse(res, { error: "Project not registered" }, 404); return }
      const { baseDir, project } = rp
      const body = JSON.parse(await parseBody(req))
      if (body.success) {
        broadcast("queue-updated", { baseDir, sessionId: sid })
      } else {
        const sessionState = project.sessions.get(sid)
        if (sessionState) {
          sessionState.status = "error"
          if (body.item) sessionState.failedItem = { item: body.item, retryCount: (sessionState.failedItem?.retryCount ?? 0) + 1 }
        }
        broadcast("queue-updated", { baseDir, sessionId: sid })
        broadcast("session-status", { baseDir, status: "error", sessionId: sid, message: body.error || "Execution failed" })
      }
      jsonResponse(res, { received: true })
      return
    }

    m = pathname.match(/^\/api\/projects\/([^/]+)\/queue\/([^/]+)\/reorder$/)
    if (m && req.method === "PATCH") {
      const [, encodedBaseDir, sid] = m
      const rp = requireProject(encodedBaseDir)
      if (!rp) { jsonResponse(res, { error: "Project not registered" }, 404); return }
      const { baseDir } = rp
      const body = JSON.parse(await parseBody(req))
      try {
        const items = QM.reorder(baseDir, sid, body.from - 1, body.to - 1)
        broadcast("queue-updated", { baseDir, sessionId: sid })
        jsonResponse(res, { items })
      } catch (e: any) { jsonResponse(res, { error: e.message }, 400) }
      return
    }

    m = pathname.match(/^\/api\/projects\/([^/]+)\/queue\/([^/]+)\/execute\/([^/]+)$/)
    if (m && req.method === "POST") {
      const [, encodedBaseDir, sid, id] = m
      const rp = requireProject(encodedBaseDir)
      if (!rp) { jsonResponse(res, { error: "Project not registered" }, 404); return }
      const { baseDir, project } = rp
      const data = Storage.load(baseDir, sid)
      const idx = data.items.findIndex((i) => i.id === id)
      if (idx === -1) { jsonResponse(res, { error: "Item not found" }, 404); return }
      const [item] = data.items.splice(idx, 1)
      Storage.save(baseDir, sid, data)
      if (project.sdkClient) {
        const rid = resolveSessionId(project, sid)
        serverLog(`execute: alias=${sid}, real=${rid}, text="${item.text.slice(0, 50)}"`)
        project.sdkClient.prompt({ path: { id: rid }, body: { parts: [{ type: "text", text: item.text }] } })
          .then(() => { broadcast("queue-updated", { baseDir, sessionId: sid }) })
          .catch((err: any) => {
            const current = Storage.load(baseDir, sid); current.items.unshift(item); Storage.save(baseDir, sid, current)
            const ss = project.sessions.get(sid)
            if (ss) { ss.failedItem = { item, retryCount: 0 }; ss.status = "error" }
            broadcast("queue-updated", { baseDir, sessionId: sid })
            broadcast("session-status", { baseDir, status: "error", sessionId: sid, message: String(err) })
          })
      } else if (project.callbackUrl) {
        executeViaCallback(project, sid, item)
      } else {
        data.items.unshift(item); Storage.save(baseDir, sid, data); jsonResponse(res, { error: "SDK not available" }, 503); return
      }
      broadcast("queue-updated", { baseDir, sessionId: sid })
      jsonResponse(res, { executed: true, item })
      return
    }

    m = pathname.match(/^\/api\/projects\/([^/]+)\/queue\/([^/]+)\/next$/)
    if (m && req.method === "POST") {
      const [, encodedBaseDir, sid] = m
      const rp = requireProject(encodedBaseDir)
      if (!rp) { jsonResponse(res, { error: "Project not registered" }, 404); return }
      const { baseDir, project } = rp
      const item = QM.dequeue(baseDir, sid)
      if (!item) { jsonResponse(res, { executed: false }); return }
      if (project.sdkClient) {
        const rid = resolveSessionId(project, sid)
        serverLog(`next: alias=${sid}, real=${rid}`)
        project.sdkClient.prompt({ path: { id: rid }, body: { parts: [{ type: "text", text: item.text }] } })
          .then(() => { broadcast("queue-updated", { baseDir, sessionId: sid }) })
          .catch((err: any) => {
            QM.reinsertAtFront(baseDir, sid, item)
            const ss = project.sessions.get(sid)
            if (ss) { ss.failedItem = { item, retryCount: 0 }; ss.status = "error" }
            broadcast("queue-updated", { baseDir, sessionId: sid })
            broadcast("session-status", { baseDir, status: "error", sessionId: sid, message: String(err) })
          })
      } else if (project.callbackUrl) {
        executeViaCallback(project, sid, item)
      } else {
        QM.reinsertAtFront(baseDir, sid, item); jsonResponse(res, { error: "SDK not available" }, 503); return
      }
      broadcast("queue-updated", { baseDir, sessionId: sid })
      jsonResponse(res, { executed: true, item })
      return
    }

    m = pathname.match(/^\/api\/projects\/([^/]+)\/queue\/([^/]+)\/retry$/)
    if (m && req.method === "POST") {
      const [, encodedBaseDir, sid] = m
      const rp = requireProject(encodedBaseDir)
      if (!rp) { jsonResponse(res, { error: "Project not registered" }, 404); return }
      const { baseDir, project } = rp
      const sessionState = project.sessions.get(sid)
      const failed = sessionState?.failedItem
      if (!failed) { jsonResponse(res, { error: "No failed item" }, 404); return }
      if (failed.retryCount >= 3) { jsonResponse(res, { error: "Max retries exceeded", item: failed.item }, 429); return }
      const failedItem = { ...failed.item }
      if (project.sdkClient) {
        const rid2 = resolveSessionId(project, sid)
        project.sdkClient.prompt({ path: { id: rid2 }, body: { parts: [{ type: "text", text: failed.item.text }] } })
          .then(() => {
            const ss = project.sessions.get(sid)
            if (ss) { ss.failedItem = undefined; ss.status = "idle" }
            broadcast("queue-updated", { baseDir, sessionId: sid })
          })
          .catch(() => {
            const ss = project.sessions.get(sid)
            if (ss?.failedItem) ss.failedItem.retryCount++
          })
      } else if (project.callbackUrl) {
        executeViaCallback(project, sid, failed.item)
      } else {
        jsonResponse(res, { error: "SDK not available" }, 503); return
      }
      if (sessionState) sessionState.failedItem = undefined
      broadcast("queue-updated", { baseDir, sessionId: sid })
      jsonResponse(res, { executed: true, item: failedItem })
      return
    }

    m = pathname.match(/^\/api\/projects\/([^/]+)\/queue\/([^/]+)\/skip$/)
    if (m && req.method === "POST") {
      const [, encodedBaseDir, sid] = m
      const rp = requireProject(encodedBaseDir)
      if (!rp) { jsonResponse(res, { error: "Project not registered" }, 404); return }
      const { baseDir, project } = rp
      const sessionState = project.sessions.get(sid)
      const failed = sessionState?.failedItem
      if (!failed) { jsonResponse(res, { error: "No failed item" }, 404); return }
      if (sessionState) { sessionState.failedItem = undefined }
      broadcast("queue-updated", { baseDir, sessionId: sid })
      jsonResponse(res, { skipped: true, item: failed.item })
      return
    }

    m = pathname.match(/^\/api\/projects\/([^/]+)\/queue\/([^/]+)\/([^/]+)$/)
    if (m) {
      const [, encodedBaseDir, sid, id] = m
      const rp = requireProject(encodedBaseDir)
      if (!rp) { jsonResponse(res, { error: "Project not registered" }, 404); return }
      const { baseDir } = rp
      if (req.method === "DELETE") {
        const removed = QM.remove(baseDir, sid, id)
        if (!removed) { jsonResponse(res, { error: "Item not found" }, 404); return }
        broadcast("queue-updated", { baseDir, sessionId: sid })
        jsonResponse(res, { removed: true })
        return
      }
      if (req.method === "PATCH") {
        const body = JSON.parse(await parseBody(req))
        try {
          const item = QM.update(baseDir, sid, id, body.text)
          if (!item) { jsonResponse(res, { error: "Item not found" }, 404); return }
          broadcast("queue-updated", { baseDir, sessionId: sid })
          jsonResponse(res, { item })
        } catch (e: any) { jsonResponse(res, { error: e.message }, 400) }
        return
      }
    }

    m = pathname.match(/^\/api\/projects\/([^/]+)\/queue\/([^/]+)$/)
    if (m) {
      const [, encodedBaseDir, sid] = m
      const rp = requireProject(encodedBaseDir)
      if (!rp) { jsonResponse(res, { error: "Project not registered" }, 404); return }
      const { baseDir } = rp
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
          broadcast("queue-updated", { baseDir, sessionId: sid })
          jsonResponse(res, { item }, 201)
        } catch (e: any) { jsonResponse(res, { error: e.message }, 400) }
        return
      }
      if (req.method === "DELETE") {
        QM.clear(baseDir, sid)
        broadcast("queue-updated", { baseDir, sessionId: sid })
        jsonResponse(res, { cleared: true })
        return
      }
    }

    m = pathname.match(/^\/api\/projects\/([^/]+)\/session\/([^/]+)$/)
    if (m && req.method === "GET") {
      const [, encodedBaseDir, sid] = m
      const rp = requireProject(encodedBaseDir)
      if (!rp) { jsonResponse(res, { error: "Project not registered" }, 404); return }
      const { project } = rp
      const sessionState = project.sessions.get(sid)
      const failed = sessionState?.failedItem
      jsonResponse(res, { status: sessionState?.status || "unknown", failedItem: failed?.item ?? null, retryCount: failed?.retryCount ?? 0 })
      return
    }

    if (pathname === "/api/broadcast" && req.method === "POST") {
      const body = JSON.parse(await parseBody(req))
      broadcast(body.event, body.data || {})
      jsonResponse(res, { broadcast: true })
      return
    }

    if (webDir && serveStaticRes(webDir, pathname, res)) return

    jsonResponse(res, { error: "Not found" }, 404)
  }

  return {
    handler: handleRequest,
    broadcast,
    registerProject,
    unregisterProject,
    getProjectState,
    setSessionStatus,
    setSessionIdMapping,
    healthCheckInterval,
  }
}

let serverSingleton: {
  broadcast: (event: string, data: any) => void
  registerProject: (reg: ProjectRegistration) => void
  unregisterProject: (baseDir: string) => boolean
  getProjectState: (baseDir: string) => ProjectState | undefined
  setSessionStatus: (baseDir: string, sid: string, status: any, detail?: any) => void
  setSessionIdMapping: (baseDir: string, alias: string, realId: string) => void
  server: http.Server
} | null = null

export function resetServerSingleton() {
  serverSingleton = null
}

function tryListenPort(server: http.Server, port: number): Promise<number | null> {
  return new Promise((resolve) => {
    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        serverLog(`Port ${port} in use, will use remote server`)
        resolve(null)
      } else {
        serverLog(`Server error: ${err}`)
        resolve(null)
      }
    })
    server.on("listening", () => {
      const addr = server.address()
      resolve(typeof addr === "object" && addr ? addr.port : port)
    })
    server.listen(port)
  })
}

function createRemoteClient(port: number) {
  const origin = `http://localhost:${port}`
  return {
    broadcast: (event: string, data: any) => {
      fetch(`${origin}/api/broadcast`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, data }) }).catch(() => {})
    },
    registerProject: (reg: ProjectRegistration) => {
      const merged = loadRegistry()
      if (!merged.has(reg.baseDir)) {
        merged.set(reg.baseDir, { baseDir: reg.baseDir, sdkClient: reg.sdkClient, callbackUrl: reg.callbackUrl, sessions: new Map([[reg.sessionId, { status: "idle" as SessionStatus }]]), aliasToReal: new Map([["default", reg.sessionId]]) })
      } else {
        const existing = merged.get(reg.baseDir)!
        if (reg.callbackUrl) existing.callbackUrl = reg.callbackUrl
      }
      saveRegistry(merged)
      fetch(`${origin}/api/projects/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseDir: reg.baseDir, sessionId: reg.sessionId, callbackUrl: reg.callbackUrl }) }).catch(() => {})
    },
    unregisterProject: (baseDir: string) => {
      fetch(`${origin}/api/projects/${encodeURIComponent(baseDir)}`, { method: "DELETE" }).catch(() => {})
    },
    getProjectState: (_baseDir: string) => undefined as ProjectState | undefined,
    setSessionStatus: (baseDir: string, sid: string, status: any, detail?: any) => {
      fetch(`${origin}/api/projects/${encodeURIComponent(baseDir)}/session/${sid}/status`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, prompt: detail?.prompt, message: detail?.message }),
      }).catch(() => {})
    },
    setSessionIdMapping: (baseDir: string, alias: string, realId: string) => {
      fetch(`${origin}/api/projects/${encodeURIComponent(baseDir)}/session/${alias}/mapping`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias, realId }),
      }).catch(() => {})
    },
  }
}

export async function startServer(config: ServerConfig & { port: number }) {
  const { port, ...handlerConfig } = config
  const { handler, broadcast, registerProject, unregisterProject, getProjectState, setSessionStatus, setSessionIdMapping, healthCheckInterval } = createHandler(handlerConfig)

  if (serverSingleton) {
    serverLog(`Server already running, reusing`)
    return { ...serverSingleton, broadcast, registerProject, unregisterProject, getProjectState, setSessionStatus, setSessionIdMapping, port: (serverSingleton.server.address() as any)?.port ?? port }
  }

  const server = http.createServer((req, res) => {
    handler(req, res).catch((err) => {
      serverLog(`unhandled error: ${err}`)
      if (!res.headersSent) jsonResponse(res, { error: "Internal server error" }, 500)
    })
  })

  const actualPort = await tryListenPort(server, port)
  if (actualPort === null) {
    serverLog(`Using remote server at localhost:${port}`)
    return { ...createRemoteClient(port), port, server: null as any }
  }

  serverLog(`server started at http://localhost:${actualPort}`)

  serverSingleton = { broadcast, registerProject, unregisterProject, getProjectState, setSessionStatus, setSessionIdMapping, server }
  return { broadcast, registerProject, unregisterProject, getProjectState, setSessionStatus, setSessionIdMapping, server, port: actualPort }
}
