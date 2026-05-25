import { useState, useEffect, useCallback } from "react"
import * as api from "../api/client"
import type { QueueItem } from "../api/client"
import { useSSE } from "./useSSE"

export function useQueue(baseDir: string, sessionId: string) {
  const [items, setItems] = useState<QueueItem[]>([])

  const fetchItems = useCallback(async () => {
    if (!baseDir) return
    try {
      const data = await api.fetchQueue(baseDir, sessionId)
      setItems(data.items)
    } catch {}
  }, [baseDir, sessionId])

  useEffect(() => { fetchItems() }, [fetchItems])
  const { sessionStatus, realSessionId, statusDetail } = useSSE(baseDir, sessionId, fetchItems)

  const add = useCallback(async (text: string) => {
    await api.addItem(baseDir, sessionId, text)
    await fetchItems()
  }, [baseDir, sessionId, fetchItems])

  const remove = useCallback(async (id: string) => {
    await api.removeItem(baseDir, sessionId, id)
    await fetchItems()
  }, [baseDir, sessionId, fetchItems])

  const clear = useCallback(async () => {
    await api.clearQueue(baseDir, sessionId)
    await fetchItems()
  }, [baseDir, sessionId, fetchItems])

  const reorder = useCallback(async (from: number, to: number) => {
    await api.reorderQueue(baseDir, sessionId, from, to)
    await fetchItems()
  }, [baseDir, sessionId, fetchItems])

  const executeById = useCallback(async (id: string) => {
    await api.executeById(baseDir, sessionId, id)
    await fetchItems()
  }, [baseDir, sessionId, fetchItems])

  const retry = useCallback(async () => {
    await api.retryItem(baseDir, sessionId)
    await fetchItems()
  }, [baseDir, sessionId, fetchItems])

  const skip = useCallback(async () => {
    await api.skipItem(baseDir, sessionId)
    await fetchItems()
  }, [baseDir, sessionId, fetchItems])

  return { items, add, remove, clear, reorder, executeById, retry, skip, sessionStatus, realSessionId, statusDetail }
}
