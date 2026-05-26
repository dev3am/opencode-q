const API_BASE = "/api"

export type ItemStatus = "queued" | "pending" | "sent" | "done" | "failed"
export interface QueueItem { id: string; text: string; createdAt: string; status: ItemStatus; sentAt?: string; completedAt?: string; error?: string }
export interface SessionState { sessionId: string; status: string; title?: string; createdAt?: string; updatedAt?: string; items: QueueItem[] }
export interface ProjectState { baseDir: string; online: boolean; sessions: SessionState[] }

async function ok<T>(res: Response): Promise<T> { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() }
function base(b: string, s: string, suffix = ""): string { return `${API_BASE}/projects/${encodeURIComponent(b)}/sessions/${encodeURIComponent(s)}${suffix}` }

export async function fetchState(): Promise<{ projects: ProjectState[] }> { return ok(await fetch(`${API_BASE}/state`)) }
export async function addItem(b: string, s: string, text: string) { return ok(await fetch(base(b, s, "/items"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })) }
export async function updateItem(b: string, s: string, id: string, text: string) { return ok(await fetch(base(b, s, `/items/${id}`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })) }
export async function removeItem(b: string, s: string, id: string) { await fetch(base(b, s, `/items/${id}`), { method: "DELETE" }) }
export async function reorder(b: string, s: string, from: number, to: number) { return ok(await fetch(base(b, s, "/reorder"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from, to }) })) }
export async function sendItem(b: string, s: string, id: string): Promise<{ ok: boolean; conflict: boolean }> {
  const res = await fetch(base(b, s, `/items/${id}/send`), { method: "POST" })
  return { ok: res.ok, conflict: res.status === 409 }
}
export async function resendItem(b: string, s: string, id: string): Promise<{ ok: boolean; conflict: boolean }> {
  const res = await fetch(base(b, s, `/items/${id}/resend`), { method: "POST" })
  return { ok: res.ok, conflict: res.status === 409 }
}
