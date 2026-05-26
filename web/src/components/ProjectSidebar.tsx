import type { ProjectInfo } from "../api/client"

interface Props {
  projects: ProjectInfo[]
  selectedBaseDir: string
  onSelect: (baseDir: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  idle: "#22c55e",
  busy: "#3b82f6",
  error: "#ef4444",
  "waiting-permission": "#f97316",
  "waiting-question": "#f97316",
  unknown: "#9ca3af",
}

export default function ProjectSidebar({ projects, selectedBaseDir, onSelect }: Props) {
  return (
    <div className="w-48 border-r border-gray-200 p-3 overflow-y-auto bg-gray-50 min-h-screen shrink-0">
      <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Projects</div>
      {projects.map((p) => {
        const name = p.baseDir.split("/").pop() || p.baseDir
        const isSelected = p.baseDir === selectedBaseDir
        const primaryStatus = p.sessions[0]?.status || "unknown"
        return (
          <div
            key={p.baseDir}
            onClick={() => onSelect(p.baseDir)}
            className={`p-2 rounded-md mb-1 cursor-pointer text-sm transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-100"}`}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[primaryStatus] || STATUS_COLORS.unknown }} />
              <div className="min-w-0">
                <div className="font-semibold text-gray-800 truncate">{name}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 truncate">{p.baseDir}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
