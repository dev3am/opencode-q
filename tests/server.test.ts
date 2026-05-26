import { test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import * as http from "node:http"
import { createRequestHandler, runSweep } from "../src/server"
import * as S from "../src/storage"
import * as R from "../src/registry"
import { PENDING_TIMEOUT_MS, STALE_CLEANUP_MS } from "../src/constants"

let home: string, proj: string, server: http.Server, port: number

function req(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const data = body !== undefined ? JSON.stringify(body) : undefined
    const r = http.request({ hostname: "127.0.0.1", port, path, method, headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) } }, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (c) => chunks.push(c))
      res.on("end", () => { const t = Buffer.concat(chunks).toString(); try { resolve({ status: res.statusCode!, json: JSON.parse(t) }) } catch { resolve({ status: res.statusCode!, json: t }) } })
    })
    r.on("error", reject); if (data) r.write(data); r.end()
  })
}
const pq = () => `/api/projects/${encodeURIComponent(proj)}/sessions/ses1`

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "oq-srv-home-"))
  proj = mkdtempSync(join(tmpdir(), "oq-srv-proj-"))
  process.env.OPENCODE_Q_HOME = home
  server = http.createServer(createRequestHandler({ webDir: undefined }))
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()))
  port = (server.address() as any).port
  R.touchHeartbeat(proj, [{ sessionId: "ses1", status: "idle" }], "i1")
})
afterEach(() => { server.close(); delete process.env.OPENCODE_Q_HOME; rmSync(home, { recursive: true, force: true }); rmSync(proj, { recursive: true, force: true }) })

test("GET /health returns the opencode-q signature", async () => {
  const res = await req("GET", "/health")
  expect(res.status).toBe(200)
  expect(res.json.app).toBe("opencode-q")
})

test("GET /api/state aggregates online projects, sessions, and items", async () => {
  S.addItem(proj, "ses1", "hello")
  const res = await req("GET", "/api/state")
  expect(res.status).toBe(200)
  const p = res.json.projects.find((x: any) => x.baseDir === proj)
  expect(p.online).toBe(true)
  const s = p.sessions.find((x: any) => x.sessionId === "ses1")
  expect(s.items.map((i: any) => i.text)).toEqual(["hello"])
})

test("POST items adds a queued item", async () => {
  const res = await req("POST", `${pq()}/items`, { text: "task one" })
  expect(res.status).toBe(201)
  expect(res.json.item.status).toBe("queued")
})

test("send marks the item pending; a second send returns 409", async () => {
  const add = await req("POST", `${pq()}/items`, { text: "a" })
  const add2 = await req("POST", `${pq()}/items`, { text: "b" })
  const send1 = await req("POST", `${pq()}/items/${add.json.item.id}/send`)
  expect(send1.status).toBe(200)
  expect(S.loadQueue(proj, "ses1").items.find((i) => i.id === add.json.item.id)!.status).toBe("pending")
  const send2 = await req("POST", `${pq()}/items/${add2.json.item.id}/send`)
  expect(send2.status).toBe(409)
})

test("resend re-queues a failed item to pending", async () => {
  const add = await req("POST", `${pq()}/items`, { text: "a" })
  S.setStatus(proj, "ses1", add.json.item.id, "failed", { error: "x" })
  const res = await req("POST", `${pq()}/items/${add.json.item.id}/resend`)
  expect(res.status).toBe(200)
  expect(S.loadQueue(proj, "ses1").items[0].status).toBe("pending")
})

test("reorder uses 0-based indices", async () => {
  await req("POST", `${pq()}/items`, { text: "a" })
  await req("POST", `${pq()}/items`, { text: "b" })
  const res = await req("PATCH", `${pq()}/reorder`, { from: 1, to: 0 })
  expect(res.status).toBe(200)
  expect(res.json.items.map((i: any) => i.text)).toEqual(["b", "a"])
})

test("DELETE removes an item", async () => {
  const add = await req("POST", `${pq()}/items`, { text: "a" })
  const res = await req("DELETE", `${pq()}/items/${add.json.item.id}`)
  expect(res.status).toBe(200)
  expect(S.loadQueue(proj, "ses1").items).toEqual([])
})

test("offline project with NO live items is excluded from /api/state", async () => {
  R.writeProjectRecord({ baseDir: "/gone", sessions: [{ sessionId: "s", status: "idle" }], heartbeat: new Date(Date.now() - 999999).toISOString(), instanceId: "old" })
  const res = await req("GET", "/api/state")
  expect(res.json.projects.some((p: any) => p.baseDir === "/gone")).toBe(false)
})

test("offline project WITH live items is shown gray (online:false)", async () => {
  const gone = mkdtempSync(join(tmpdir(), "oq-gone-"))
  try {
    R.writeProjectRecord({ baseDir: gone, sessions: [{ sessionId: "s", status: "idle" }], heartbeat: new Date(Date.now() - 999999).toISOString(), instanceId: "old" })
    S.addItem(gone, "s", "preserved")
    const res = await req("GET", "/api/state")
    const p = res.json.projects.find((x: any) => x.baseDir === gone)
    expect(p).toBeTruthy()
    expect(p.online).toBe(false)
    expect(p.sessions[0].items[0].text).toBe("preserved")
  } finally { rmSync(gone, { recursive: true, force: true }) }
})

test("two instances of one baseDir collapse to a single project", async () => {
  R.touchHeartbeat(proj, [{ sessionId: "ses1", status: "idle" }], "i1")
  R.touchHeartbeat(proj, [{ sessionId: "ses2", status: "idle" }], "i2")
  const res = await req("GET", "/api/state")
  const matches = res.json.projects.filter((x: any) => x.baseDir === proj)
  expect(matches).toHaveLength(1)
  expect(matches[0].sessions.map((s: any) => s.sessionId).sort()).toEqual(["ses1", "ses2"])
})

test("runSweep fails timed-out pending in an ONLINE project", () => {
  R.touchHeartbeat(proj, [{ sessionId: "ses1", status: "idle" }], "i1")
  const a = S.addItem(proj, "ses1", "x")
  S.sendItem(proj, "ses1", a.id)
  const data = S.loadQueue(proj, "ses1")
  data.items[0].pendingAt = new Date(Date.now() - PENDING_TIMEOUT_MS - 1000).toISOString()
  S.saveQueue(proj, "ses1", data)
  runSweep(Date.now())
  expect(S.loadQueue(proj, "ses1").items[0].status).toBe("failed")
})

test("runSweep fails all in-flight items in an OFFLINE project", () => {
  // Make both instances offline
  R.writeProjectRecord({ baseDir: proj, sessions: [{ sessionId: "ses1", status: "idle" }], heartbeat: new Date(Date.now() - 999999).toISOString(), instanceId: "i1" })
  R.writeProjectRecord({ baseDir: proj, sessions: [{ sessionId: "ses1", status: "idle" }], heartbeat: new Date(Date.now() - 999999).toISOString(), instanceId: "old" })
  const a = S.addItem(proj, "ses1", "x")
  S.setStatus(proj, "ses1", a.id, "sent", { sentAt: new Date().toISOString() })
  runSweep(Date.now())
  expect(S.loadQueue(proj, "ses1").items[0].status).toBe("failed")
})

test("runSweep removes a long-stale instance record with no live items", () => {
  R.writeProjectRecord({ baseDir: proj, sessions: [{ sessionId: "ses1", status: "idle" }], heartbeat: new Date(Date.now() - STALE_CLEANUP_MS - 1000).toISOString(), instanceId: "dead" })
  runSweep(Date.now())
  expect(R.readAllProjects().some((r) => r.instanceId === "dead")).toBe(false)
})

test("runSweep keeps a stale record that still has live items", () => {
  R.writeProjectRecord({ baseDir: proj, sessions: [{ sessionId: "ses1", status: "idle" }], heartbeat: new Date(Date.now() - STALE_CLEANUP_MS - 1000).toISOString(), instanceId: "keep" })
  S.addItem(proj, "ses1", "preserved")
  runSweep(Date.now())
  expect(R.readAllProjects().some((r) => r.instanceId === "keep")).toBe(true)
})

test("send to an OFFLINE project is rejected with 409", async () => {
  R.writeProjectRecord({ baseDir: proj, sessions: [{ sessionId: "ses1", status: "idle" }], heartbeat: new Date(Date.now() - 999999).toISOString(), instanceId: "i1" })
  const add = await req("POST", `${pq()}/items`, { text: "a" })
  const res = await req("POST", `${pq()}/items/${add.json.item.id}/send`)
  expect(res.status).toBe(409)
})
