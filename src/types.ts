export interface QueueItem {
  id: string
  text: string
  createdAt: string
  sessionId: string
}

export type SessionStatus =
  | "unknown"
  | "idle"
  | "busy"
  | "error"
  | "waiting-permission"
  | "waiting-question"

export interface FailedItem {
  item: QueueItem
  retryCount: number
}

export interface QueueData {
  items: QueueItem[]
  updatedAt: string
}
