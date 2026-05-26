import type { StatusDetail } from "../hooks/useSSE"

interface HeaderProps {
  sessionId: string
  realSessionId?: string | null
  sessionStatus: string
  statusDetail: StatusDetail
  onRetry: () => void
  onSkip: () => void
}

function shortId(id: string): string {
  return id.length > 12 ? "…" + id.slice(-8) : id
}

const STATUS_COLORS: Record<string, string> = {
  idle: "#22c55e",
  busy: "#3b82f6",
  error: "#ef4444",
  "waiting-permission": "#f97316",
  "waiting-question": "#f97316",
  unknown: "#9ca3af",
}

const STATUS_LABELS: Record<string, string> = {
  idle: "idle",
  busy: "busy",
  error: "error",
  "waiting-permission": "permission",
  "waiting-question": "question",
  unknown: "unknown",
}

export default function Header({ sessionId, realSessionId, sessionStatus, statusDetail, onRetry, onSkip }: HeaderProps) {
  const color = STATUS_COLORS[sessionStatus] || STATUS_COLORS.unknown
  const label = STATUS_LABELS[sessionStatus] || sessionStatus
  const isError = sessionStatus === "error"
  const isBusy = sessionStatus === "busy"

  return (
    <div className="mb-4 pb-2 border-b border-gray-200">
      <div className="flex justify-between items-center">
        <h1 className="m-0 text-lg font-bold text-gray-800">opencode-q</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {realSessionId ? shortId(realSessionId) : sessionId}
          </span>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ background: color + "18", color }}>
            <span className={`w-1.5 h-1.5 rounded-full ${isBusy ? "animate-pulse" : ""}`} style={{ background: color }} />
            {label}
          </span>
        </div>
      </div>

      {isError && (
        <div className="mt-2 pl-2 border-l-2 border-red-500">
          <div className="text-xs text-red-600 mb-1">
            실행 실패: {statusDetail.message || "unknown error"}
          </div>
          <div className="flex gap-2">
            <button onClick={onRetry} className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors cursor-pointer">재시도</button>
            <button onClick={onSkip} className="px-3 py-1 text-xs font-medium bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors cursor-pointer">건너뛰기</button>
          </div>
        </div>
      )}
    </div>
  )
}
