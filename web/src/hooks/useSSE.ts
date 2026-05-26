import { useEffect, useState } from "react"
import { createSSE } from "../api/client"

export interface StatusDetail {
  prompt?: string
  message?: string
}

export function useSSE(baseDir: string, sessionId: string, onUpdate: () => void) {
  const [sessionStatus, setSessionStatus] = useState<string>("idle")
  const [realSessionId, setRealSessionId] = useState<string | null>(null)
  const [statusDetail, setStatusDetail] = useState<StatusDetail>({})

  useEffect(() => {
    if (!baseDir) return
    const es = createSSE()
    es.addEventListener("queue-updated", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data)
        if (data.baseDir === baseDir && (!data.sessionId || data.sessionId === sessionId)) onUpdate()
      } catch {}
    })
    es.addEventListener("session-status", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data)
        if (data.baseDir === baseDir && data.sessionId === sessionId) {
          setSessionStatus(data.status)
          setStatusDetail({ prompt: data.prompt, message: data.message })
          if (data.realSessionId) setRealSessionId(data.realSessionId)
        }
      } catch {}
    })
    return () => es.close()
  }, [baseDir, sessionId, onUpdate])

  return { sessionStatus, realSessionId, statusDetail }
}
