import { useEffect, useState } from "react"
import { createSSE } from "../api/client"

export interface StatusDetail {
  prompt?: string
  message?: string
}

export function useSSE(sessionId: string, onUpdate: () => void) {
  const [sessionStatus, setSessionStatus] = useState<string>("unknown")
  const [realSessionId, setRealSessionId] = useState<string | null>(null)
  const [statusDetail, setStatusDetail] = useState<StatusDetail>({})

  useEffect(() => {
    const es = createSSE()
    es.addEventListener("queue-updated", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data)
        if (!data.sessionId || data.sessionId === sessionId) onUpdate()
      } catch {}
    })
    es.addEventListener("session-status", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data)
        if (data.sessionId === sessionId) {
          setSessionStatus(data.status)
          setStatusDetail({ prompt: data.prompt, message: data.message })
          if (data.realSessionId) setRealSessionId(data.realSessionId)
        }
      } catch {}
    })
    return () => es.close()
  }, [sessionId, onUpdate])

  return { sessionStatus, realSessionId, statusDetail }
}
