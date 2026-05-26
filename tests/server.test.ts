import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import * as http from "node:http"
import { startServer, resetServerSingleton } from "../src/server"

function createTestDir(): string {
  return mkdtempSync(join(tmpdir(), "opencode-q-server-test-"))
}

function createMockSdk(resolves: boolean = true) {
  return {
    prompt: async () => {
      if (!resolves) throw new Error("SDK connection refused")
    },
  }
}

function request(
  port: number,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined
    const opts: http.RequestOptions = {
      hostname: "localhost",
      port,
      path,
      method,
      headers: { "Content-Type": "application/json" },
    }
    if (bodyStr) {
      opts.headers!["Content-Length"] = Buffer.byteLength(bodyStr)
    }
    const req = http.request(opts, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk) => chunks.push(chunk))
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString()
        try {
          resolve({ status: res.statusCode || 200, json: JSON.parse(text) })
        } catch {
          resolve({ status: res.statusCode || 200, json: text })
        }
      })
    })
    req.on("error", reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

describe("REST API Server", () => {
  let testDir: string
  let port: number
  let server: http.Server

  const pq = (sid: string) => `/api/projects/${encodeURIComponent(testDir)}/queue/${sid}`
  const sessionUrl = (sid: string) => `/api/projects/${encodeURIComponent(testDir)}/session/${sid}`

  beforeEach(() => {
    testDir = createTestDir()
    process.env.OPENCODE_Q_REGISTRY = join(testDir, "registry.json")
  })

  afterEach(() => {
    server?.close()
    resetServerSingleton()
    delete process.env.OPENCODE_Q_REGISTRY
    rmSync(testDir, { recursive: true, force: true })
  })

  async function boot(sdkClient?: any): Promise<number> {
    const result = await startServer({ webDir: undefined, port: 0 })
    server = result.server
    port = result.port
    result.registerProject({ baseDir: testDir, sdkClient: sdkClient ?? null, sessionId: "test-session" })
    return port
  }

  test("GET queue returns empty queue", async () => {
    const p = await boot()
    const res = await request(p, "GET", pq("test-session"))
    expect(res.status).toBe(200)
    expect(res.json.items).toEqual([])
  })

  test("POST queue adds an item", async () => {
    const p = await boot()
    const res = await request(p, "POST", pq("test-session"), { text: "hello" })
    expect(res.status).toBe(201)
    expect(res.json.item.text).toBe("hello")
    expect(res.json.item.sessionId).toBe("test-session")
  })

  test("GET queue returns items after add", async () => {
    const p = await boot()
    await request(p, "POST", pq("test-session"), { text: "first" })
    await request(p, "POST", pq("test-session"), { text: "second" })
    const res = await request(p, "GET", pq("test-session"))
    expect(res.json.items.length).toBe(2)
    expect(res.json.items[0].text).toBe("first")
    expect(res.json.items[1].text).toBe("second")
  })

  test("DELETE queue/:id removes an item", async () => {
    const p = await boot()
    const addRes = await request(p, "POST", pq("test-session"), { text: "to remove" })
    const id = addRes.json.item.id
    const delRes = await request(p, "DELETE", `${pq("test-session")}/${id}`)
    expect(delRes.status).toBe(200)
    expect(delRes.json.removed).toBe(true)
    const getRes = await request(p, "GET", pq("test-session"))
    expect(getRes.json.items.length).toBe(0)
  })

  test("DELETE queue clears all items", async () => {
    const p = await boot()
    await request(p, "POST", pq("test-session"), { text: "a" })
    await request(p, "POST", pq("test-session"), { text: "b" })
    const res = await request(p, "DELETE", pq("test-session"))
    expect(res.json.cleared).toBe(true)
    const getRes = await request(p, "GET", pq("test-session"))
    expect(getRes.json.items.length).toBe(0)
  })

  test("PATCH queue/reorder reorders items", async () => {
    const p = await boot()
    await request(p, "POST", pq("test-session"), { text: "first" })
    await request(p, "POST", pq("test-session"), { text: "second" })
    const res = await request(p, "PATCH", `${pq("test-session")}/reorder`, { from: 2, to: 1 })
    expect(res.status).toBe(200)
    expect(res.json.items[0].text).toBe("second")
    expect(res.json.items[1].text).toBe("first")
  })

  test("POST queue/next without SDK returns 503", async () => {
    const p = await boot()
    await request(p, "POST", pq("test-session"), { text: "first" })
    await request(p, "POST", pq("test-session"), { text: "second" })
    const res = await request(p, "POST", `${pq("test-session")}/next`)
    expect(res.status).toBe(503)
    expect(res.json.error).toBe("SDK not available")
    const getRes = await request(p, "GET", pq("test-session"))
    expect(getRes.json.items.length).toBe(2)
  })

  test("POST queue/next returns 200 with executed:false when empty", async () => {
    const p = await boot()
    const res = await request(p, "POST", `${pq("test-session")}/next`)
    expect(res.status).toBe(200)
    expect(res.json.executed).toBe(false)
  })

  test("GET session returns idle status by default", async () => {
    const p = await boot()
    const res = await request(p, "GET", sessionUrl("test-session"))
    expect(res.status).toBe(200)
    expect(res.json.status).toBe("idle")
  })

  test("404 for unknown routes", async () => {
    const p = await boot()
    const res = await request(p, "GET", "/api/unknown")
    expect(res.status).toBe(404)
  })
})

describe("REST API Server with SDK", () => {
  let testDir: string
  let port: number
  let server: http.Server

  const pq = (sid: string) => `/api/projects/${encodeURIComponent(testDir)}/queue/${sid}`
  const sessionUrl = (sid: string) => `/api/projects/${encodeURIComponent(testDir)}/session/${sid}`

  beforeEach(() => {
    testDir = createTestDir()
    process.env.OPENCODE_Q_REGISTRY = join(testDir, "registry.json")
  })

  afterEach(() => {
    server?.close()
    resetServerSingleton()
    delete process.env.OPENCODE_Q_REGISTRY
    rmSync(testDir, { recursive: true, force: true })
  })

  async function boot(sdkClient?: any): Promise<number> {
    const result = await startServer({ webDir: undefined, port: 0 })
    server = result.server
    port = result.port
    result.registerProject({ baseDir: testDir, sdkClient: sdkClient ?? null, sessionId: "test-session" })
    return port
  }

  test("POST queue/next with SDK executes prompt", async () => {
    const p = await boot(createMockSdk(true))
    await request(p, "POST", pq("test-session"), { text: "hello AI" })
    const res = await request(p, "POST", `${pq("test-session")}/next`)
    expect(res.status).toBe(200)
    expect(res.json.executed).toBe(true)
    expect(res.json.item.text).toBe("hello AI")
    const getRes = await request(p, "GET", pq("test-session"))
    expect(getRes.json.items.length).toBe(0)
  })

  test("POST queue/next SDK failure reinserts (async)", async () => {
    const p = await boot(createMockSdk(false))
    await request(p, "POST", pq("test-session"), { text: "Will fail" })
    const res = await request(p, "POST", `${pq("test-session")}/next`)
    expect(res.status).toBe(200)
    expect(res.json.executed).toBe(true)
    await new Promise(r => setTimeout(r, 10))
    const getRes = await request(p, "GET", pq("test-session"))
    expect(getRes.json.items.length).toBe(1)
  })

  test("POST queue/retry after failure handles async retry", async () => {
    const p = await boot(createMockSdk(false))
    await request(p, "POST", pq("test-session"), { text: "retry me" })
    await request(p, "POST", `${pq("test-session")}/next`)
    const retryRes = await request(p, "POST", `${pq("test-session")}/retry`)
    expect(retryRes.status).toBe(200)
    expect(retryRes.json.executed).toBe(true)
  })

  test("POST queue/skip after failure skips item", async () => {
    const p = await boot(createMockSdk(false))
    await request(p, "POST", pq("test-session"), { text: "skip me" })
    await request(p, "POST", `${pq("test-session")}/next`)
    const skipRes = await request(p, "POST", `${pq("test-session")}/skip`)
    expect(skipRes.json.skipped).toBe(true)
  })

  test("POST queue/execute/:id executes specific item", async () => {
    const p = await boot(createMockSdk(true))
    await request(p, "POST", pq("test-session"), { text: "first" })
    const addRes = await request(p, "POST", pq("test-session"), { text: "second" })
    const id = addRes.json.item.id
    const res = await request(p, "POST", `${pq("test-session")}/execute/${id}`)
    expect(res.status).toBe(200)
    expect(res.json.executed).toBe(true)
    expect(res.json.item.text).toBe("second")
    const getRes = await request(p, "GET", pq("test-session"))
    expect(getRes.json.items.length).toBe(1)
    expect(getRes.json.items[0].text).toBe("first")
  })

  test("POST queue/execute/:id returns 404 for missing item", async () => {
    const p = await boot(createMockSdk(true))
    const res = await request(p, "POST", `${pq("test-session")}/execute/nonexistent`)
    expect(res.status).toBe(404)
  })

  test("POST queue/retry returns 404 when no failed item", async () => {
    const p = await boot(createMockSdk(true))
    const res = await request(p, "POST", `${pq("test-session")}/retry`)
    expect(res.status).toBe(404)
  })

  test("POST queue/skip returns 404 when no failed item", async () => {
    const p = await boot(createMockSdk(false))
    const res = await request(p, "POST", `${pq("test-session")}/skip`)
    expect(res.status).toBe(404)
  })

  test("GET session returns error status after SDK failure", async () => {
    const p = await boot(createMockSdk(false))
    await request(p, "POST", pq("test-session"), { text: "fail" })
    await request(p, "POST", `${pq("test-session")}/next`)
    const res = await request(p, "GET", sessionUrl("test-session"))
    expect(res.json.status).toBe("error")
    expect(res.json.failedItem).not.toBeNull()
  })

  test("POST queue without text returns 400", async () => {
    const p = await boot()
    const res = await request(p, "POST", pq("test-session"), {})
    expect(res.status).toBe(400)
  })
})

describe("Multi-Project Registry", () => {
  let testDir1: string
  let testDir2: string
  let server: http.Server
  let port: number
  let registryPath: string

  beforeEach(() => {
    testDir1 = createTestDir()
    testDir2 = createTestDir()
    registryPath = join(testDir1, "registry.json")
    process.env.OPENCODE_Q_REGISTRY = registryPath
  })

  afterEach(() => {
    server?.close()
    resetServerSingleton()
    delete process.env.OPENCODE_Q_REGISTRY
    rmSync(testDir1, { recursive: true, force: true })
    rmSync(testDir2, { recursive: true, force: true })
  })

  async function boot(): Promise<{ port: number; registerProject: any }> {
    const result = await startServer({ webDir: undefined, port: 0 })
    server = result.server
    port = result.port
    return { port, registerProject: result.registerProject }
  }

  test("GET /api/projects returns empty before registration", async () => {
    const { port: p } = await boot()
    const res = await request(p, "GET", "/api/projects")
    expect(res.status).toBe(200)
    expect(res.json.projects).toEqual([])
  })

  test("POST /api/projects/register adds a project", async () => {
    const { port: p } = await boot()
    await request(p, "POST", "/api/projects/register", { baseDir: testDir1 })
    const res = await request(p, "GET", "/api/projects")
    expect(res.json.projects).toHaveLength(1)
    expect(res.json.projects[0].baseDir).toBe(testDir1)
  })

  test("DELETE /api/projects/:baseDir unregisters", async () => {
    const { port: p } = await boot()
    await request(p, "POST", "/api/projects/register", { baseDir: testDir1 })
    const del = await request(p, "DELETE", `/api/projects/${encodeURIComponent(testDir1)}`)
    expect(del.status).toBe(200)
    const res = await request(p, "GET", "/api/projects")
    expect(res.json.projects).toHaveLength(0)
  })

  test("multiple projects can be registered", async () => {
    const { port: p } = await boot()
    await request(p, "POST", "/api/projects/register", { baseDir: testDir1 })
    await request(p, "POST", "/api/projects/register", { baseDir: testDir2 })
    const res = await request(p, "GET", "/api/projects")
    expect(res.json.projects).toHaveLength(2)
  })

  test("queue operations on unregistered project return 404", async () => {
    const { port: p } = await boot()
    const res = await request(p, "GET", `/api/projects/${encodeURIComponent(testDir1)}/queue/test-session`)
    expect(res.status).toBe(404)
  })

  test("registering same baseDir updates existing", async () => {
    const { port: p } = await boot()
    await request(p, "POST", "/api/projects/register", { baseDir: testDir1 })
    await request(p, "POST", "/api/projects/register", { baseDir: testDir1 })
    const res = await request(p, "GET", "/api/projects")
    expect(res.json.projects).toHaveLength(1)
  })
})
