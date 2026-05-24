import { test, expect, beforeEach, afterEach } from "bun:test"
import { load, save, listSessionIds } from "../src/storage"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { QueueData } from "../src/types"
import { STORAGE_DIR } from "../src/constants"

let testDir: string

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "opencode-q-test-"))
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
})

function storageFile(sessionId: string) {
  return join(testDir, STORAGE_DIR, `queue-${sessionId}.json`)
}

test("load returns empty data when session file does not exist", () => {
  const data = load(testDir, "sess-1")
  expect(data.items).toEqual([])
  expect(data.updatedAt).toBeDefined()
})

test("save creates queue-{sessionId}.json in .opencode directory", () => {
  const data: QueueData = {
    items: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
  save(testDir, "sess-1", data)
  expect(existsSync(storageFile("sess-1"))).toBe(true)
})

test("different sessions have separate files", () => {
  const data1: QueueData = {
    items: [{ id: "abcd1234", text: "session one", createdAt: "2026-01-01T00:00:00.000Z", sessionId: "sess-1" }],
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
  const data2: QueueData = {
    items: [{ id: "efgh5678", text: "session two", createdAt: "2026-01-01T00:01:00.000Z", sessionId: "sess-2" }],
    updatedAt: "2026-01-01T00:01:00.000Z",
  }
  save(testDir, "sess-1", data1)
  save(testDir, "sess-2", data2)

  const loaded1 = load(testDir, "sess-1")
  const loaded2 = load(testDir, "sess-2")
  expect(loaded1.items).toHaveLength(1)
  expect(loaded1.items[0].text).toBe("session one")
  expect(loaded2.items).toHaveLength(1)
  expect(loaded2.items[0].text).toBe("session two")
})

test("load recovers from corrupted JSON", () => {
  mkdirSync(join(testDir, STORAGE_DIR), { recursive: true })
  writeFileSync(storageFile("sess-1"), "invalid json{{{")
  const data = load(testDir, "sess-1")
  expect(data.items).toEqual([])
  expect(data.updatedAt).toBeDefined()
})

test("save updates updatedAt timestamp", () => {
  const before = "2026-01-01T00:00:00.000Z"
  const data: QueueData = { items: [], updatedAt: before }
  save(testDir, "sess-1", data)
  expect(data.updatedAt).not.toBe(before)
})

test("round-trip preserves all fields including sessionId", () => {
  const original: QueueData = {
    items: [
      { id: "a1b2c3d4", text: "first prompt", createdAt: "2026-01-01T00:00:00.000Z", sessionId: "sess-1" },
      { id: "e5f6g7h8", text: "second prompt", createdAt: "2026-01-01T00:01:00.000Z", sessionId: "sess-1" },
    ],
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
  save(testDir, "sess-1", original)
  const loaded = load(testDir, "sess-1")
  expect(loaded.items).toHaveLength(2)
  expect(loaded.items[0].id).toBe("a1b2c3d4")
  expect(loaded.items[0].sessionId).toBe("sess-1")
  expect(loaded.items[1].text).toBe("second prompt")
})

test("listSessionIds returns all session IDs with queue files", () => {
  mkdirSync(join(testDir, STORAGE_DIR), { recursive: true })
  const data: QueueData = {
    items: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
  save(testDir, "alpha", data)
  save(testDir, "beta", data)

  const ids = listSessionIds(testDir)
  expect(ids.sort()).toEqual(["alpha", "beta"])
})
