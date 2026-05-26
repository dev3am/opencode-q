import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { QueueData, QueueItem, ItemStatus } from "./types"
import { STORAGE_DIR, QUEUE_PREFIX, QUEUE_EXT, ID_LENGTH, ID_CHARSET } from "./constants"

function queueFile(baseDir: string, sessionId: string): string {
  return join(baseDir, STORAGE_DIR, `${QUEUE_PREFIX}${sessionId}${QUEUE_EXT}`)
}

function generateId(): string {
  let id = ""
  for (let i = 0; i < ID_LENGTH; i++) id += ID_CHARSET[Math.floor(Math.random() * ID_CHARSET.length)]
  return id
}

function emptyData(): QueueData {
  return { items: [], updatedAt: new Date().toISOString() }
}

export function loadQueue(baseDir: string, sessionId: string): QueueData {
  const file = queueFile(baseDir, sessionId)
  if (!existsSync(file)) return emptyData()
  try {
    const data = JSON.parse(readFileSync(file, "utf-8")) as QueueData
    if (!Array.isArray(data.items)) data.items = []
    for (const item of data.items) if (!item.status) item.status = "queued"
    return data
  } catch {
    renameSync(file, file + ".bak")
    return emptyData()
  }
}

export function saveQueue(baseDir: string, sessionId: string, data: QueueData): void {
  const dir = join(baseDir, STORAGE_DIR)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const now = new Date()
  if (now.toISOString() === data.updatedAt) now.setTime(now.getTime() + 1)
  data.updatedAt = now.toISOString()
  const file = queueFile(baseDir, sessionId)
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8")
  renameSync(tmp, file)
}

export function hasQueue(baseDir: string, sessionId: string): boolean {
  return existsSync(queueFile(baseDir, sessionId))
}

export function addItem(baseDir: string, sessionId: string, text: string): QueueItem {
  if (!text.trim()) throw new Error("프롬프트를 입력해주세요")
  const data = loadQueue(baseDir, sessionId)
  const item: QueueItem = { id: generateId(), text, createdAt: new Date().toISOString(), status: "queued" }
  data.items.push(item)
  saveQueue(baseDir, sessionId, data)
  return item
}

export function removeItem(baseDir: string, sessionId: string, id: string): boolean {
  const data = loadQueue(baseDir, sessionId)
  const idx = data.items.findIndex((i) => i.id === id)
  if (idx === -1) return false
  data.items.splice(idx, 1)
  saveQueue(baseDir, sessionId, data)
  return true
}

export function updateItem(baseDir: string, sessionId: string, id: string, text: string): QueueItem | null {
  if (!text.trim()) throw new Error("프롬프트를 입력해주세요")
  const data = loadQueue(baseDir, sessionId)
  const item = data.items.find((i) => i.id === id)
  if (!item) return null
  item.text = text
  saveQueue(baseDir, sessionId, data)
  return item
}

export function reorderItems(baseDir: string, sessionId: string, from: number, to: number): QueueItem[] {
  const data = loadQueue(baseDir, sessionId)
  if (from < 0 || from >= data.items.length || to < 0 || to >= data.items.length) {
    throw new Error("유효하지 않은 위치입니다")
  }
  const [moved] = data.items.splice(from, 1)
  data.items.splice(to, 0, moved)
  saveQueue(baseDir, sessionId, data)
  return data.items
}

export function setStatus(
  baseDir: string, sessionId: string, id: string, status: ItemStatus,
  extra?: { sentAt?: string; completedAt?: string; error?: string },
): QueueItem | null {
  const data = loadQueue(baseDir, sessionId)
  const item = data.items.find((i) => i.id === id)
  if (!item) return null
  item.status = status
  if (extra?.sentAt) item.sentAt = extra.sentAt
  if (extra?.completedAt) item.completedAt = extra.completedAt
  if (extra?.error !== undefined) item.error = extra.error
  saveQueue(baseDir, sessionId, data)
  return item
}

export function sendItem(baseDir: string, sessionId: string, id: string): QueueItem | null {
  const data = loadQueue(baseDir, sessionId)
  if (data.items.some((i) => (i.status === "pending" || i.status === "sent") && i.id !== id)) return null
  const item = data.items.find((i) => i.id === id)
  if (!item) return null
  item.status = "pending"
  item.pendingAt = new Date().toISOString()
  saveQueue(baseDir, sessionId, data)
  return item
}

export function inFlightItem(baseDir: string, sessionId: string): QueueItem | undefined {
  return loadQueue(baseDir, sessionId).items.find((i) => i.status === "pending" || i.status === "sent")
}

export function firstPending(baseDir: string, sessionId: string): QueueItem | undefined {
  return loadQueue(baseDir, sessionId).items.find((i) => i.status === "pending")
}

export function sentItem(baseDir: string, sessionId: string): QueueItem | undefined {
  return loadQueue(baseDir, sessionId).items.find((i) => i.status === "sent")
}

export function listSessionIds(baseDir: string): string[] {
  const dir = join(baseDir, STORAGE_DIR)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.startsWith(QUEUE_PREFIX) && f.endsWith(QUEUE_EXT))
    .map((f) => f.slice(QUEUE_PREFIX.length, f.length - QUEUE_EXT.length))
}

export function migrateLegacyDefault(baseDir: string, realSessionId: string): boolean {
  if (realSessionId === "default") return false
  if (!hasQueue(baseDir, "default")) return false
  if (hasQueue(baseDir, realSessionId)) return false
  const data = loadQueue(baseDir, "default")
  for (const item of data.items) { if (!item.status) item.status = "queued" }
  saveQueue(baseDir, realSessionId, data)
  renameSync(queueFile(baseDir, "default"), queueFile(baseDir, "default") + ".migrated")
  return true
}

const LIVE_STATUSES: ReadonlySet<ItemStatus> = new Set(["queued", "pending", "sent", "failed"])

export function isLiveStatus(status: ItemStatus): boolean {
  return LIVE_STATUSES.has(status)
}

export function hasLiveItems(baseDir: string, sessionId: string): boolean {
  return loadQueue(baseDir, sessionId).items.some((i) => isLiveStatus(i.status))
}

export function failTimedOutPending(baseDir: string, sessionId: string, timeoutMs: number, now: number = Date.now()): boolean {
  const data = loadQueue(baseDir, sessionId)
  let changed = false
  for (const item of data.items) {
    if (item.status !== "pending") continue
    const t = item.pendingAt ? Date.parse(item.pendingAt) : NaN
    if (Number.isFinite(t) && now - t > timeoutMs) {
      item.status = "failed"
      item.error = "소유 인스턴스가 응답하지 않습니다"
      changed = true
    }
  }
  if (changed) saveQueue(baseDir, sessionId, data)
  return changed
}

export function failAllInFlight(baseDir: string, sessionId: string, reason: string): boolean {
  const data = loadQueue(baseDir, sessionId)
  let changed = false
  for (const item of data.items) {
    if (item.status === "pending" || item.status === "sent") {
      item.status = "failed"
      item.error = reason
      changed = true
    }
  }
  if (changed) saveQueue(baseDir, sessionId, data)
  return changed
}
