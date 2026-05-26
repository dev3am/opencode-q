import * as S from "./storage"
import { POLL_PENDING_MS } from "./constants"

export interface ExecutorDeps {
  baseDir: string
  prompt: (sessionId: string, text: string) => Promise<void>
}

export function createExecutor(deps: ExecutorDeps) {
  const { baseDir, prompt } = deps
  const sessionStatus = new Map<string, string>()
  let timer: ReturnType<typeof setInterval> | null = null

  function noteSession(sessionId: string, status: string): void {
    sessionStatus.set(sessionId, status)
  }

  async function dispatchFor(sessionId: string): Promise<void> {
    if (S.sentItem(baseDir, sessionId)) return
    if (sessionStatus.get(sessionId) !== "idle") return
    const pending = S.firstPending(baseDir, sessionId)
    if (!pending) return
    S.setStatus(baseDir, sessionId, pending.id, "sent", { sentAt: new Date().toISOString() })
    try {
      await prompt(sessionId, pending.text)
    } catch (err) {
      if (S.sentItem(baseDir, sessionId)?.status === "sent") {
        S.setStatus(baseDir, sessionId, pending.id, "failed", { error: String((err as Error)?.message ?? err) })
      }
    }
  }

  async function tick(): Promise<void> {
    for (const sid of sessionStatus.keys()) await dispatchFor(sid)
  }

  function onIdle(sessionId: string): void {
    sessionStatus.set(sessionId, "idle")
    const inflight = S.sentItem(baseDir, sessionId)
    if (inflight) S.setStatus(baseDir, sessionId, inflight.id, "done", { completedAt: new Date().toISOString() })
  }

  function onError(sessionId: string, message: string): void {
    const inflight = S.sentItem(baseDir, sessionId)
    if (inflight) S.setStatus(baseDir, sessionId, inflight.id, "failed", { error: message })
  }

  function start(): void {
    if (!timer) timer = setInterval(() => { void tick() }, POLL_PENDING_MS)
  }
  function stop(): void {
    if (timer) { clearInterval(timer); timer = null }
  }

  return { noteSession, tick, onIdle, onError, start, stop }
}
