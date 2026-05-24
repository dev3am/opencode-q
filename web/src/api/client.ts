const API_BASE = "/api"

export interface QueueItem {
  id: string
  text: string
  createdAt: string
  sessionId: string
}

export async function fetchQueue(sessionId: string): Promise<{ items: QueueItem[]; updatedAt: string }> {
  const res = await fetch(`${API_BASE}/queue/${sessionId}`)
  return res.json()
}

export async function addItem(sessionId: string, text: string): Promise<{ item: QueueItem }> {
  const res = await fetch(`${API_BASE}/queue/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}

export async function removeItem(sessionId: string, id: string): Promise<void> {
  await fetch(`${API_BASE}/queue/${sessionId}/${id}`, { method: "DELETE" })
}

export async function clearQueue(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/queue/${sessionId}`, { method: "DELETE" })
}

export async function reorderQueue(sessionId: string, from: number, to: number): Promise<{ items: QueueItem[] }> {
  const res = await fetch(`${API_BASE}/queue/${sessionId}/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  })
  return res.json()
}

export async function executeNext(sessionId: string): Promise<{ executed: boolean; item?: QueueItem; message?: string }> {
  const res = await fetch(`${API_BASE}/queue/${sessionId}/next`, { method: "POST" })
  return res.json()
}

export async function executeById(sessionId: string, id: string): Promise<{ executed: boolean; item?: QueueItem; error?: string }> {
  const res = await fetch(`${API_BASE}/queue/${sessionId}/execute/${id}`, { method: "POST" })
  return res.json()
}

export function createSSE(): EventSource {
  return new EventSource(`${API_BASE}/events`)
}

export async function retryItem(sessionId: string): Promise<{ executed: boolean; item?: QueueItem; error?: string }> {
  const res = await fetch(`${API_BASE}/queue/${sessionId}/retry`, { method: "POST" })
  return res.json()
}

export async function skipItem(sessionId: string): Promise<{ skipped: boolean; item?: QueueItem; error?: string }> {
  const res = await fetch(`${API_BASE}/queue/${sessionId}/skip`, { method: "POST" })
  return res.json()
}

export async function fetchSessionStatus(sessionId: string): Promise<{ status: string; failedItem: QueueItem | null; retryCount: number }> {
  const res = await fetch(`${API_BASE}/session/${sessionId}`)
  return res.json()
}
