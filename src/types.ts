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

export interface ProjectState {
  baseDir: string
  sdkClient: any
  callbackUrl?: string
  sessions: Map<string, {
    status: SessionStatus
    failedItem?: FailedItem
  }>
  aliasToReal: Map<string, string>
}

export interface ProjectRegistration {
  baseDir: string
  sdkClient: any
  sessionId: string
  callbackUrl?: string
}
