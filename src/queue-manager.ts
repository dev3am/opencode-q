import * as Storage from "./storage"
import type { QueueItem, QueueData } from "./types"
import { ID_LENGTH, ID_CHARSET } from "./constants"

function generateId(): string {
  let id = ""
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ID_CHARSET[Math.floor(Math.random() * ID_CHARSET.length)]
  }
  return id
}

export function add(baseDir: string, sessionId: string, text: string): QueueItem {
  if (!text.trim()) {
    throw new Error("프롬프트를 입력해주세요")
  }
  const data: QueueData = Storage.load(baseDir, sessionId)
  const item: QueueItem = {
    id: generateId(),
    text,
    createdAt: new Date().toISOString(),
    sessionId,
  }
  data.items.push(item)
  Storage.save(baseDir, sessionId, data)
  return item
}

export function getAll(baseDir: string, sessionId: string): QueueItem[] {
  return Storage.load(baseDir, sessionId).items
}

export function peek(baseDir: string, sessionId: string): QueueItem | null {
  const data = Storage.load(baseDir, sessionId)
  return data.items.length > 0 ? data.items[0] : null
}

export function dequeue(baseDir: string, sessionId: string): QueueItem | null {
  const data = Storage.load(baseDir, sessionId)
  if (data.items.length === 0) return null
  const item = data.items.shift()!
  Storage.save(baseDir, sessionId, data)
  return item
}

export function reinsertAtFront(baseDir: string, sessionId: string, item: QueueItem): void {
  const data = Storage.load(baseDir, sessionId)
  data.items.unshift(item)
  Storage.save(baseDir, sessionId, data)
}

export function remove(baseDir: string, sessionId: string, id: string): boolean {
  const data = Storage.load(baseDir, sessionId)
  const index = data.items.findIndex((item) => item.id === id)
  if (index === -1) return false
  data.items.splice(index, 1)
  Storage.save(baseDir, sessionId, data)
  return true
}

export function clear(baseDir: string, sessionId: string): void {
  const data = Storage.load(baseDir, sessionId)
  data.items = []
  Storage.save(baseDir, sessionId, data)
}

export function reorder(baseDir: string, sessionId: string, fromIndex: number, toIndex: number): QueueItem[] {
  const data = Storage.load(baseDir, sessionId)
  if (fromIndex < 0 || fromIndex >= data.items.length) {
    throw new Error("유효하지 않은 위치입니다")
  }
  if (toIndex < 0 || toIndex >= data.items.length) {
    throw new Error("유효하지 않은 위치입니다")
  }
  const [item] = data.items.splice(fromIndex, 1)
  data.items.splice(toIndex, 0, item)
  Storage.save(baseDir, sessionId, data)
  return data.items
}
