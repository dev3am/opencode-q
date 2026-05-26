import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, renameSync, rmSync } from "node:fs"
import { join } from "node:path"
import type { ProjectRecord, ProjectGroup, SessionInfo } from "./types"
import { instancesDir, legacyProjectsDir, LIVENESS_TIMEOUT_MS } from "./constants"

function fileFor(instanceId: string): string {
  return join(instancesDir(), `${instanceId}.json`)
}

export function writeProjectRecord(rec: ProjectRecord): void {
  const dir = instancesDir()
  mkdirSync(dir, { recursive: true })
  const file = fileFor(rec.instanceId)
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(rec), "utf-8")
  renameSync(tmp, file)
}

export function touchHeartbeat(baseDir: string, sessions: SessionInfo[], instanceId: string): void {
  writeProjectRecord({ baseDir, sessions, heartbeat: new Date().toISOString(), instanceId })
}

export function readAllProjects(): ProjectRecord[] {
  const dir = instancesDir()
  if (!existsSync(dir)) return []
  const records: ProjectRecord[] = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue
    try { records.push(JSON.parse(readFileSync(join(dir, f), "utf-8")) as ProjectRecord) } catch { /* skip corrupt */ }
  }
  return records
}

export function isOnline(rec: ProjectRecord, now: number = Date.now()): boolean {
  const t = Date.parse(rec.heartbeat)
  return Number.isFinite(t) && now - t <= LIVENESS_TIMEOUT_MS
}

export function groupByBaseDir(records: ProjectRecord[], now: number = Date.now()): ProjectGroup[] {
  const byDir = new Map<string, ProjectGroup>()
  for (const rec of records) {
    let g = byDir.get(rec.baseDir)
    if (!g) { g = { baseDir: rec.baseDir, online: false, sessions: [] }; byDir.set(rec.baseDir, g) }
    if (isOnline(rec, now)) g.online = true
    for (const s of rec.sessions) {
      const existing = g.sessions.find((x) => x.sessionId === s.sessionId)
      if (!existing) { g.sessions.push(s); continue }
      if ((Date.parse(s.updatedAt ?? "") || 0) >= (Date.parse(existing.updatedAt ?? "") || 0)) {
        g.sessions[g.sessions.indexOf(existing)] = s
      }
    }
  }
  return [...byDir.values()]
}

export function removeInstanceRecord(instanceId: string): void {
  const file = fileFor(instanceId)
  if (existsSync(file)) rmSync(file, { force: true })
}

export function markInstanceOffline(instanceId: string): void {
  const file = fileFor(instanceId)
  if (!existsSync(file)) return
  try {
    const rec = JSON.parse(readFileSync(file, "utf-8")) as ProjectRecord
    rec.heartbeat = new Date(0).toISOString()
    writeProjectRecord(rec)
  } catch { /* ignore */ }
}

export function cleanupLegacyProjectsDir(): void {
  const dir = legacyProjectsDir()
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}
