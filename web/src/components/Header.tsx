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

  return (
    <div style={{ marginBottom: 16, padding: "8px 0", borderBottom: "1px solid #e0e0e0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>
          opencode-q
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#666", background: "#f0f0f0", padding: "2px 8px", borderRadius: 4 }}>
            {realSessionId ? shortId(realSessionId) : sessionId}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "2px 8px", borderRadius: 4, background: color + "18", color }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", background: color,
              animation: sessionStatus === "busy" ? "pulse 1.5s infinite" : "none",
            }} />
            {label}
          </span>
        </div>
      </div>

      {isError && (
        <div style={{ marginTop: 8, fontSize: 13, color: "#555", paddingLeft: 8, borderLeft: "2px solid #ef4444" }}>
          <div style={{ color: "#ef4444", marginBottom: 6 }}>
            실행 실패: {statusDetail.message || "unknown error"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onRetry} style={{ padding: "4px 12px", fontSize: 12, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
              재시도
            </button>
            <button onClick={onSkip} style={{ padding: "4px 12px", fontSize: 12, background: "#6b7280", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
              건너뛰기
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
