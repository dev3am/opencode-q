import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import * as http from "node:http"
import { createHandler, startServer, resetServerSingleton } from "../src/server"

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

  beforeEach(() => {
    testDir = createTestDir()
  })

  afterEach(() => {
    server?.close()
    resetServerSingleton()
    rmSync(testDir, { recursive: true, force: true })
  })

  async function boot(sdkClient?: any): Promise<number> {
    const result = await startServer({ baseDir: testDir, sdkClient: sdkClient ?? null, webDir: undefined, port: 0 })
    server = result.server
    port = result.port
    return port
  }

  test("GET /api/queue/:sessionId returns empty queue", async () => {
    const p = await boot()
    const res = await request(p, "GET", "/api/queue/test-session")
    expect(res.status).toBe(200)
    expect(res.json.items).toEqual([])
  })

  test("POST /api/queue/:sessionId adds an item", async () => {
    const p = await boot()
    const res = await request(p, "POST", "/api/queue/test-session", { text: "hello" })
    expect(res.status).toBe(201)
    expect(res.json.item.text).toBe("hello")
    expect(res.json.item.sessionId).toBe("test-session")
  })

  test("GET /api/queue/:sessionId returns items after add", async () => {
    const p = await boot()
    await request(p, "POST", "/api/queue/test-session", { text: "first" })
    await request(p, "POST", "/api/queue/test-session", { text: "second" })
    const res = await request(p, "GET", "/api/queue/test-session")
    expect(res.json.items.length).toBe(2)
    expect(res.json.items[0].text).toBe("first")
    expect(res.json.items[1].text).toBe("second")
  })

  test("DELETE /api/queue/:sessionId/:id removes an item", async () => {
    const p = await boot()
    const addRes = await request(p, "POST", "/api/queue/test-session", { text: "to remove" })
    const id = addRes.json.item.id
    const delRes = await request(p, "DELETE", `/api/queue/test-session/${id}`)
    expect(delRes.status).toBe(200)
    expect(delRes.json.removed).toBe(true)
    const getRes = await request(p, "GET", "/api/queue/test-session")
    expect(getRes.json.items.length).toBe(0)
  })

  test("DELETE /api/queue/:sessionId clears all items", async () => {
    const p = await boot()
    await request(p, "POST", "/api/queue/test-session", { text: "a" })
    await request(p, "POST", "/api/queue/test-session", { text: "b" })
    const res = await request(p, "DELETE", "/api/queue/test-session")
    expect(res.json.cleared).toBe(true)
    const getRes = await request(p, "GET", "/api/queue/test-session")
    expect(getRes.json.items.length).toBe(0)
  })

  test("PATCH /api/queue/:sessionId/reorder reorders items", async () => {
    const p = await boot()
    await request(p, "POST", "/api/queue/test-session", { text: "first" })
    await request(p, "POST", "/api/queue/test-session", { text: "second" })
    const res = await request(p, "PATCH", "/api/queue/test-session/reorder", { from: 2, to: 1 })
    expect(res.status).toBe(200)
    expect(res.json.items[0].text).toBe("second")
    expect(res.json.items[1].text).toBe("first")
  })

  test("POST /api/queue/:sessionId/next without SDK returns 503", async () => {
    const p = await boot()
    await request(p, "POST", "/api/queue/test-session", { text: "first" })
    await request(p, "POST", "/api/queue/test-session", { text: "second" })
    const res = await request(p, "POST", "/api/queue/test-session/next")
    expect(res.status).toBe(503)
    expect(res.json.error).toBe("SDK not available")
    const getRes = await request(p, "GET", "/api/queue/test-session")
    expect(getRes.json.items.length).toBe(2)
  })

  test("POST /api/queue/:sessionId/next returns 200 with executed:false when empty", async () => {
    const p = await boot()
    const res = await request(p, "POST", "/api/queue/test-session/next")
    expect(res.status).toBe(200)
    expect(res.json.executed).toBe(false)
  })

  test("GET /api/session/:sessionId returns unknown status", async () => {
    const p = await boot()
    const res = await request(p, "GET", "/api/session/test-session")
    expect(res.status).toBe(200)
    expect(res.json.status).toBe("unknown")
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

  beforeEach(() => {
    testDir = createTestDir()
  })

  afterEach(() => {
    server?.close()
    resetServerSingleton()
    rmSync(testDir, { recursive: true, force: true })
  })

  async function boot(sdkClient?: any): Promise<number> {
    const result = await startServer({ baseDir: testDir, sdkClient: sdkClient ?? null, webDir: undefined, port: 0 })
    server = result.server
    port = result.port
    return port
  }

  test("POST /api/queue/:sessionId/next with SDK executes prompt", async () => {
    const p = await boot(createMockSdk(true))
    await request(p, "POST", "/api/queue/test-session", { text: "hello AI" })
    const res = await request(p, "POST", "/api/queue/test-session/next")
    expect(res.status).toBe(200)
    expect(res.json.executed).toBe(true)
    expect(res.json.item.text).toBe("hello AI")
    const getRes = await request(p, "GET", "/api/queue/test-session")
    expect(getRes.json.items.length).toBe(0)
  })

  test("POST /api/queue/:sessionId/next SDK failure reinserts + returns 500 with canRetry", async () => {
    const p = await boot(createMockSdk(false))
    await request(p, "POST", "/api/queue/test-session", { text: "Will fail" })
    const res = await request(p, "POST", "/api/queue/test-session/next")
    expect(res.status).toBe(500)
    expect(res.json.canRetry).toBe(true)
    expect(res.json.error).toContain("SDK connection refused")
    const getRes = await request(p, "GET", "/api/queue/test-session")
    expect(getRes.json.items.length).toBe(1)
  })

  test("POST /api/queue/:sessionId/retry after failure returns 500 when SDK fails again", async () => {
    const p = await boot(createMockSdk(false))
    await request(p, "POST", "/api/queue/test-session", { text: "retry me" })
    await request(p, "POST", "/api/queue/test-session/next")
    const retryRes = await request(p, "POST", "/api/queue/test-session/retry")
    expect(retryRes.status).toBe(500)
    expect(retryRes.json.retryCount).toBe(1)
  })

  test("POST /api/queue/:sessionId/skip after failure skips item", async () => {
    const p = await boot(createMockSdk(false))
    await request(p, "POST", "/api/queue/test-session", { text: "skip me" })
    await request(p, "POST", "/api/queue/test-session/next")
    const skipRes = await request(p, "POST", "/api/queue/test-session/skip")
    expect(skipRes.json.skipped).toBe(true)
  })

  test("POST /api/queue/:sessionId/execute/:id executes specific item", async () => {
    const p = await boot(createMockSdk(true))
    await request(p, "POST", "/api/queue/test-session", { text: "first" })
    const addRes = await request(p, "POST", "/api/queue/test-session", { text: "second" })
    const id = addRes.json.item.id
    const res = await request(p, "POST", `/api/queue/test-session/execute/${id}`)
    expect(res.status).toBe(200)
    expect(res.json.executed).toBe(true)
    expect(res.json.item.text).toBe("second")
    const getRes = await request(p, "GET", "/api/queue/test-session")
    expect(getRes.json.items.length).toBe(1)
    expect(getRes.json.items[0].text).toBe("first")
  })

  test("POST /api/queue/:sessionId/execute/:id returns 404 for missing item", async () => {
    const p = await boot(createMockSdk(true))
    const res = await request(p, "POST", "/api/queue/test-session/execute/nonexistent")
    expect(res.status).toBe(404)
  })

  test("POST /api/queue/:sessionId/retry returns 404 when no failed item", async () => {
    const p = await boot(createMockSdk(true))
    const res = await request(p, "POST", "/api/queue/test-session/retry")
    expect(res.status).toBe(404)
  })

  test("POST /api/queue/:sessionId/skip returns 404 when no failed item", async () => {
    const p = await boot(createMockSdk(false))
    const res = await request(p, "POST", "/api/queue/test-session/skip")
    expect(res.status).toBe(404)
  })

  test("GET /api/session/:sessionId returns error status after SDK failure", async () => {
    const p = await boot(createMockSdk(false))
    await request(p, "POST", "/api/queue/test-session", { text: "fail" })
    await request(p, "POST", "/api/queue/test-session/next")
    const res = await request(p, "GET", "/api/session/test-session")
    expect(res.json.status).toBe("error")
    expect(res.json.failedItem).not.toBeNull()
  })

  test("POST /api/queue/:sessionId without text returns 400", async () => {
    const p = await boot()
    const res = await request(p, "POST", "/api/queue/test-session", {})
    expect(res.status).toBe(400)
  })
})
