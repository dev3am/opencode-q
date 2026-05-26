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
  hasSdk?: boolean
  hasCallback?: boolean
}

function projectPath(baseDir: string, suffix: string): string {
  return `${API_BASE}/projects/${encodeURIComponent(baseDir)}${suffix}`
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchProjects(): Promise<{ projects: ProjectInfo[] }> {
  const res = await fetch(`${API_BASE}/projects`)
  return parseJson(res)
}

export async function fetchQueue(baseDir: string, sessionId: string): Promise<{ items: QueueItem[]; updatedAt: string }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}`))
  return parseJson(res)
}

export async function addItem(baseDir: string, sessionId: string, text: string): Promise<{ item: QueueItem }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
  return parseJson(res)
}

export async function removeItem(baseDir: string, sessionId: string, id: string): Promise<void> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}/${id}`), { method: "DELETE" })
  if (!res.ok) return
}

export async function updateItem(baseDir: string, sessionId: string, id: string, text: string): Promise<{ item: QueueItem }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
  return parseJson(res)
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
  return parseJson(res)
}

export async function executeNext(baseDir: string, sessionId: string): Promise<{ executed: boolean; item?: QueueItem; message?: string }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}/next`), { method: "POST" })
  return parseJson(res)
}

export async function executeById(baseDir: string, sessionId: string, id: string): Promise<{ executed: boolean; item?: QueueItem; error?: string }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}/execute/${id}`), { method: "POST" })
  return parseJson(res)
}

export function createSSE(): EventSource {
  return new EventSource(`${API_BASE}/events`)
}

export async function retryItem(baseDir: string, sessionId: string): Promise<{ executed: boolean; item?: QueueItem; error?: string }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}/retry`), { method: "POST" })
  return parseJson(res)
}

export async function skipItem(baseDir: string, sessionId: string): Promise<{ skipped: boolean; item?: QueueItem; error?: string }> {
  const res = await fetch(projectPath(baseDir, `/queue/${sessionId}/skip`), { method: "POST" })
  return parseJson(res)
}

export async function fetchSessionStatus(baseDir: string, sessionId: string): Promise<{ status: string; failedItem: QueueItem | null; retryCount: number }> {
  const res = await fetch(projectPath(baseDir, `/session/${sessionId}`))
  return parseJson(res)
}

export interface ErrorLogPayload {
  message: string
  stack?: string
  url: string
  project: string
  timestamp: string
  userAgent: string
}

export async function postError(payload: ErrorLogPayload): Promise<void> {
  await fetch(`${API_BASE}/logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {})
}

export function initGlobalErrorLogging() {
  window.addEventListener("error", (event) => {
    const project = localStorage.getItem("opencode-q-last-project") || ""
    postError({
      message: event.message || (event.error && event.error.message) || "Uncaught error",
      stack: (event.error && event.error.stack) || "",
      url: window.location.href,
      project,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    }).catch(() => {})
  });

  window.addEventListener("unhandledrejection", (event) => {
    const project = localStorage.getItem("opencode-q-last-project") || ""
    postError({
      message: event.reason?.message || String(event.reason || "Unhandled Promise Rejection"),
      stack: event.reason?.stack || "",
      url: window.location.href,
      project,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    }).catch(() => {})
  });
}
