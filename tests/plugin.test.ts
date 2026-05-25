import { test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createHandler } from "../src/server"
import * as QM from "../src/queue-manager"

let testDir: string
let capturedBroadcasts: Array<{ event: string; data: any }>
let plugin: any

beforeEach(async () => {
  testDir = mkdtempSync(join(tmpdir(), "opencode-q-plugin-test-"))
  process.env.OPENCODE_Q_REGISTRY = join(testDir, "registry.json")
  capturedBroadcasts = []

  const mockClient = {
    tui: {
      showToast: async () => {},
      appendPrompt: async () => {},
    },
  }

  const { broadcast, setSessionIdMapping, setSessionStatus, registerProject } = createHandler({ webDir: undefined })
  registerProject({ baseDir: testDir, sdkClient: null, sessionId: "default" })
  setSessionIdMapping(testDir, "default", "test-session")
  const _ref = { broadcast, setSessionStatus }

  plugin = {
    event: async ({ event }: any) => {
      if (event.type === "session.status") {
        const statusType = event.properties?.status?.type
        const STATUS_MAP: Record<string, string> = {
          busy: "busy",
          idle: "idle",
          retry: "error",
        }
        const sseStatus = STATUS_MAP[statusType]
        if (sseStatus) {
          capturedBroadcasts.push({
            event: "session-status",
            data: { status: sseStatus, sessionId: "default", baseDir: testDir },
          })
          _ref.setSessionStatus(testDir, "default", sseStatus)
        }
        return
      }

      if (event.type === "session.idle") {
        const sid = event.properties?.sessionID || "test-session"
        const items = QM.getAll(testDir, sid)
        if (items.length > 0) {
          capturedBroadcasts.push({ event: "queue-updated", data: { baseDir: testDir, sessionId: sid, count: items.length } })
        }
      }
    },
    get _broadcast() { return _ref.broadcast },
    set _broadcast(fn: any) { _ref.broadcast = fn },
    get _setSessionStatus() { return _ref.setSessionStatus },
    set _setSessionStatus(fn: any) { _ref.setSessionStatus = fn },
  }
})

afterEach(() => {
  delete process.env.OPENCODE_Q_REGISTRY
  rmSync(testDir, { recursive: true, force: true })
})

test("session.status busy broadcasts session-status busy", async () => {
  await plugin.event({ event: { type: "session.status", properties: { sessionID: "test-session", status: { type: "busy" } } } })
  const found = capturedBroadcasts.find((b) => b.event === "session-status")
  expect(found).toBeDefined()
  expect(found!.data.status).toBe("busy")
  expect(found!.data.sessionId).toBe("default")
})

test("session.status idle broadcasts session-status idle", async () => {
  await plugin.event({ event: { type: "session.status", properties: { sessionID: "test-session", status: { type: "idle" } } } })
  const found = capturedBroadcasts.find((b) => b.event === "session-status")
  expect(found).toBeDefined()
  expect(found!.data.status).toBe("idle")
  expect(found!.data.sessionId).toBe("default")
})

test("session.status retry broadcasts session-status error", async () => {
  await plugin.event({ event: { type: "session.status", properties: { sessionID: "test-session", status: { type: "retry", attempt: 1, message: "API error", next: 5 } } } })
  const found = capturedBroadcasts.find((b) => b.event === "session-status")
  expect(found).toBeDefined()
  expect(found!.data.status).toBe("error")
  expect(found!.data.sessionId).toBe("default")
})

test("session.idle with pending items broadcasts queue-updated", async () => {
  QM.add(testDir, "test-session", "pending item")
  await plugin.event({ event: { type: "session.idle", properties: { sessionID: "test-session" } } })
  const queueEvent = capturedBroadcasts.find((b) => b.event === "queue-updated")
  expect(queueEvent).toBeDefined()
  expect(queueEvent!.data.count).toBe(1)
})

test("session.idle without pending items does not broadcast queue-updated", async () => {
  await plugin.event({ event: { type: "session.idle", properties: { sessionID: "test-session" } } })
  const queueEvent = capturedBroadcasts.find((b) => b.event === "queue-updated")
  expect(queueEvent).toBeUndefined()
})

test("session.status with unknown status type does not broadcast", async () => {
  await plugin.event({ event: { type: "session.status", properties: { sessionID: "test-session", status: { type: "unknown" } } } })
  const found = capturedBroadcasts.find((b) => b.event === "session-status")
  expect(found).toBeUndefined()
})

test("unknown event type does not broadcast session-status", async () => {
  await plugin.event({ event: { type: "something_else", properties: { sessionID: "test-session" } } })
  const found = capturedBroadcasts.find((b) => b.event === "session-status")
  expect(found).toBeUndefined()
})
