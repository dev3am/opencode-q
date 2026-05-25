const API_BASE = "/api"

export interface QueueItem {
  id: string
  text: string
  createdAt: string
  sessionId: string
}

export interface ProjectInfo {
  baseDir: string
  sessions: Array<{ sessionId: string; status: string }>
}

function projectPath(baseDir: string, suffix: string): string {
  return `${API_BASE}/projects/${encodeURIComponent(baseDir)}${suffix}`
}

export async function fetchProjects(): Promise<{ projects: ProjectInfo[] }> {
  const res = await fetch(`${API_BASE}/projects`)
  return res.json()
}

export async function fetchQueue(baseDir: string, sessionId: string): Promise<{ items: QueueItem[]; updatedAt: string }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}`))
  return res.json()
}

export async function addItem(baseDir: string, sessionId: string, text: string): Promise<{ item: QueueItem }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}

export async function removeItem(baseDir: string, sessionId: string, id: string): Promise<void> {
  await fetch(projectPath(baseDir, `/queue/${sessionId}/${id}`), { method: "DELETE" })
}

export async function clearQueue(baseDir: string, sessionId: string): Promise<void> {
  await fetch(projectPath(baseDir, `/queue/${sessionId}`), { method: "DELETE" })
}

export async function reorderQueue(baseDir: string, sessionId: string, from: number, to: number): Promise<{ items: QueueItem[] }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}/reorder`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  })
  return res.json()
}

export async function executeNext(baseDir: string, sessionId: string): Promise<{ executed: boolean; item?: QueueItem; message?: string }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}/next`), { method: "POST" })
  return res.json()
}

export async function executeById(baseDir: string, sessionId: string, id: string): Promise<{ executed: boolean; item?: QueueItem; error?: string }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}/execute/${id}`), { method: "POST" })
  return res.json()
}

export function createSSE(): EventSource {
  return new EventSource(`${API_BASE}/events`)
}

export async function retryItem(baseDir: string, sessionId: string): Promise<{ executed: boolean; item?: QueueItem; error?: string }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}/retry`), { method: "POST" })
  return res.json()
}

export async function skipItem(baseDir: string, sessionId: string): Promise<{ skipped: boolean; item?: QueueItem; error?: string }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}/skip`), { method: "POST" })
  return res.json()
}

export async function fetchSessionStatus(baseDir: string, sessionId: string): Promise<{ status: string; failedItem: QueueItem | null; retryCount: number }> {
  const res = await fetch(projectPath(baseDir, `/session/${sessionId}`))
  return res.json()
}
