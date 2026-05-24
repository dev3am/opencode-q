import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { QueueData } from "./types"
import {
  STORAGE_DIR,
  STORAGE_FILE_PREFIX,
  STORAGE_FILE_EXT,
} from "./constants"

function sessionFilePath(baseDir: string, sessionId: string): string {
  return join(baseDir, STORAGE_DIR, `${STORAGE_FILE_PREFIX}${sessionId}${STORAGE_FILE_EXT}`)
}

function createEmptyData(): QueueData {
  return {
    items: [],
    updatedAt: new Date().toISOString(),
  }
}

export function load(baseDir: string, sessionId: string): QueueData {
  const filePath = sessionFilePath(baseDir, sessionId)
  if (!existsSync(filePath)) {
    return createEmptyData()
  }
  try {
    const raw = readFileSync(filePath, "utf-8")
    const data = JSON.parse(raw) as QueueData
    if (!Array.isArray(data.items)) {
      data.items = []
    }
    return data
  } catch {
    const bakPath = filePath + ".bak"
    if (existsSync(filePath)) {
      renameSync(filePath, bakPath)
    }
    return createEmptyData()
  }
}

export function save(baseDir: string, sessionId: string, data: QueueData): void {
  const dir = join(baseDir, STORAGE_DIR)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const now = new Date()
  if (now.toISOString() === data.updatedAt) {
    now.setTime(now.getTime() + 1)
  }
  data.updatedAt = now.toISOString()
  const filePath = sessionFilePath(baseDir, sessionId)
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8")
}

export function listSessionIds(baseDir: string): string[] {
  const dir = join(baseDir, STORAGE_DIR)
  if (!existsSync(dir)) {
    return []
  }
  const prefix = STORAGE_FILE_PREFIX
  const ext = STORAGE_FILE_EXT
  return readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(ext))
    .map((f) => f.slice(prefix.length, f.length - ext.length))
}
