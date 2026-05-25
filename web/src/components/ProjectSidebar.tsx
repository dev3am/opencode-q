import type { ProjectInfo } from "../api/client"

interface Props {
  projects: ProjectInfo[]
  selectedBaseDir: string
  onSelect: (baseDir: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  idle: "#4ade80",
  busy: "#facc15",
  error: "#f87171",
  unknown: "#888",
}

export default function ProjectSidebar({ projects, selectedBaseDir, onSelect }: Props) {
  return (
    <div style={{ width: 200, borderRight: "1px solid #333", padding: 12, overflowY: "auto" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "#888", marginBottom: 8 }}>Projects</div>
      {projects.map((p) => {
        const name = p.baseDir.split("/").pop() || p.baseDir
        const isSelected = p.baseDir === selectedBaseDir
        const primaryStatus = p.sessions[0]?.status || "unknown"
        return (
          <div
            key={p.baseDir}
            onClick={() => onSelect(p.baseDir)}
            style={{
              padding: "8px 10px",
              background: isSelected ? "#2a2a3e" : "transparent",
              borderRadius: 6,
              marginBottom: 4,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[primaryStatus] || STATUS_COLORS.unknown, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.baseDir}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
