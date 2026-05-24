import { useState, useEffect, useCallback } from "react"
import * as api from "../api/client"
import type { QueueItem } from "../api/client"
import { useSSE } from "./useSSE"

export function useQueue(sessionId: string) {
  const [items, setItems] = useState<QueueItem[]>([])

  const fetchItems = useCallback(async () => {
    try {
      const data = await api.fetchQueue(sessionId)
      setItems(data.items)
    } catch {}
  }, [sessionId])

  useEffect(() => { fetchItems() }, [fetchItems])
  const { sessionStatus, realSessionId, statusDetail } = useSSE(sessionId, fetchItems)

  const add = useCallback(async (text: string) => {
    await api.addItem(sessionId, text)
    await fetchItems()
  }, [sessionId, fetchItems])

  const remove = useCallback(async (id: string) => {
    await api.removeItem(sessionId, id)
    await fetchItems()
  }, [sessionId, fetchItems])

  const clear = useCallback(async () => {
    await api.clearQueue(sessionId)
    await fetchItems()
  }, [sessionId, fetchItems])

  const reorder = useCallback(async (from: number, to: number) => {
    await api.reorderQueue(sessionId, from, to)
    await fetchItems()
  }, [sessionId, fetchItems])

  const executeNext = useCallback(async () => {
    await api.executeNext(sessionId)
    await fetchItems()
  }, [sessionId, fetchItems])

  const executeById = useCallback(async (id: string) => {
    await api.executeById(sessionId, id)
    await fetchItems()
  }, [sessionId, fetchItems])

  const retry = useCallback(async () => {
    await api.retryItem(sessionId)
    await fetchItems()
  }, [sessionId, fetchItems])

  const skip = useCallback(async () => {
    await api.skipItem(sessionId)
    await fetchItems()
  }, [sessionId, fetchItems])

  return { items, add, remove, clear, reorder, executeById, retry, skip, sessionStatus, realSessionId, statusDetail }
}
