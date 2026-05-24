import { test, expect, beforeEach, afterEach } from "bun:test"
import * as QM from "../src/queue-manager"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

let testDir: string

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "opencode-q-test-"))
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
})

test("add creates item with sessionId", () => {
  const item = QM.add(testDir, "sess-1", "test prompt")
  expect(item.id).toHaveLength(8)
  expect(item.text).toBe("test prompt")
  expect(item.sessionId).toBe("sess-1")
  expect(item.createdAt).toBeDefined()
})

test("add throws on empty text", () => {
  expect(() => QM.add(testDir, "sess-1", "")).toThrow("프롬프트를 입력해주세요")
  expect(() => QM.add(testDir, "sess-1", "   ")).toThrow("프롬프트를 입력해주세요")
})

test("add appends to end of session queue", () => {
  QM.add(testDir, "sess-1", "first")
  QM.add(testDir, "sess-1", "second")
  const items = QM.getAll(testDir, "sess-1")
  expect(items[0].text).toBe("first")
  expect(items[1].text).toBe("second")
})

test("different sessions are isolated", () => {
  QM.add(testDir, "sess-1", "a1")
  QM.add(testDir, "sess-1", "a2")
  QM.add(testDir, "sess-2", "b1")
  expect(QM.getAll(testDir, "sess-1")).toHaveLength(2)
  expect(QM.getAll(testDir, "sess-2")).toHaveLength(1)
  expect(QM.getAll(testDir, "sess-2")[0].text).toBe("b1")
})

test("getAll returns empty array for new session", () => {
  expect(QM.getAll(testDir, "new-session")).toEqual([])
})

test("peek returns first item of session without removing", () => {
  QM.add(testDir, "sess-1", "first")
  QM.add(testDir, "sess-1", "second")
  const item = QM.peek(testDir, "sess-1")
  expect(item!.text).toBe("first")
  expect(QM.getAll(testDir, "sess-1")).toHaveLength(2)
})

test("peek returns null on empty session", () => {
  expect(QM.peek(testDir, "sess-1")).toBeNull()
})

test("dequeue removes and returns first item of session only", () => {
  QM.add(testDir, "sess-1", "first")
  QM.add(testDir, "sess-1", "second")
  QM.add(testDir, "sess-2", "other")
  const item = QM.dequeue(testDir, "sess-1")
  expect(item!.text).toBe("first")
  expect(QM.getAll(testDir, "sess-1")).toHaveLength(1)
  expect(QM.getAll(testDir, "sess-1")[0].text).toBe("second")
  expect(QM.getAll(testDir, "sess-2")).toHaveLength(1)
})

test("dequeue returns null on empty session", () => {
  expect(QM.dequeue(testDir, "sess-1")).toBeNull()
})

test("remove deletes item by id within session only", () => {
  const item1 = QM.add(testDir, "sess-1", "first")
  const item2 = QM.add(testDir, "sess-1", "second")
  expect(QM.remove(testDir, "sess-1", item1.id)).toBe(true)
  const items = QM.getAll(testDir, "sess-1")
  expect(items).toHaveLength(1)
  expect(items[0].id).toBe(item2.id)
})

test("remove returns false for unknown id", () => {
  QM.add(testDir, "sess-1", "first")
  expect(QM.remove(testDir, "sess-1", "nonexistent")).toBe(false)
  expect(QM.getAll(testDir, "sess-1")).toHaveLength(1)
})

test("remove does not affect other sessions", () => {
  const item1 = QM.add(testDir, "sess-1", "first")
  QM.add(testDir, "sess-2", "other")
  QM.remove(testDir, "sess-1", item1.id)
  expect(QM.getAll(testDir, "sess-1")).toHaveLength(0)
  expect(QM.getAll(testDir, "sess-2")).toHaveLength(1)
})

test("clear empties only the target session", () => {
  QM.add(testDir, "sess-1", "a")
  QM.add(testDir, "sess-1", "b")
  QM.add(testDir, "sess-2", "c")
  QM.clear(testDir, "sess-1")
  expect(QM.getAll(testDir, "sess-1")).toEqual([])
  expect(QM.getAll(testDir, "sess-2")).toHaveLength(1)
})

test("reorder moves item within session", () => {
  QM.add(testDir, "sess-1", "A")
  QM.add(testDir, "sess-1", "B")
  QM.add(testDir, "sess-1", "C")
  const items = QM.reorder(testDir, "sess-1", 0, 2)
  expect(items.map((i) => i.text)).toEqual(["B", "C", "A"])
})

test("reorder does not affect other sessions", () => {
  QM.add(testDir, "sess-1", "A")
  QM.add(testDir, "sess-1", "B")
  QM.add(testDir, "sess-1", "C")
  QM.add(testDir, "sess-2", "X")
  QM.add(testDir, "sess-2", "Y")
  QM.reorder(testDir, "sess-1", 0, 2)
  expect(QM.getAll(testDir, "sess-2").map((i) => i.text)).toEqual(["X", "Y"])
})

test("reorder throws on out-of-bounds", () => {
  QM.add(testDir, "sess-1", "A")
  expect(() => QM.reorder(testDir, "sess-1", -1, 0)).toThrow("유효하지 않은 위치입니다")
  expect(() => QM.reorder(testDir, "sess-1", 5, 0)).toThrow("유효하지 않은 위치입니다")
  expect(() => QM.reorder(testDir, "sess-1", 0, -1)).toThrow("유효하지 않은 위치입니다")
  expect(() => QM.reorder(testDir, "sess-1", 0, 5)).toThrow("유효하지 않은 위치입니다")
})

test("reinsertAtFront restores item to front of queue", () => {
  const item1 = QM.add(testDir, "sess-1", "first")
  QM.add(testDir, "sess-1", "second")
  QM.add(testDir, "sess-1", "third")
  QM.remove(testDir, "sess-1", item1.id)
  QM.reinsertAtFront(testDir, "sess-1", item1)
  const items = QM.getAll(testDir, "sess-1")
  expect(items).toHaveLength(3)
  expect(items[0].id).toBe(item1.id)
  expect(items[0].text).toBe("first")
})
