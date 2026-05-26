import { useState, useEffect, useCallback, useRef } from "react"
import { useQueue } from "./hooks/useQueue"
import { fetchProjects, createSSE, type ProjectInfo } from "./api/client"
import Header from "./components/Header"
import QueueList from "./components/QueueList"
import AddPrompt from "./components/AddPrompt"
import EmptyState from "./components/EmptyState"
import ProjectSidebar from "./components/ProjectSidebar"

const MIN_WIDTH = 160
const MAX_WIDTH = 400

export default function App() {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [selectedBaseDir, setSelectedBaseDir] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get("project") || ""
  })
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("opencode-q-sidebar-width")
    return saved ? parseInt(saved, 10) : 192
  })
  const dragging = useRef(false)
  const widthRef = useRef(sidebarWidth)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const resizeActive = useRef(false)
  const sessionId = "default"

  const refreshProjects = useCallback(() => {
    fetchProjects().then((data) => {
      const active = data.projects.filter((p) => p.hasSdk || p.hasCallback)
      setProjects((prev) => {
        setSelectedBaseDir((cur) => {
          if (!cur && active.length > 0) return active[0].baseDir
          if (cur && !active.some((p) => p.baseDir === cur)) {
            return active.length > 0 ? active[0].baseDir : ""
          }
          return cur
        })
        return active
      })
    })
  }, [])

  useEffect(() => { refreshProjects() }, [refreshProjects])

  useEffect(() => {
    if (selectedBaseDir) {
      localStorage.setItem("opencode-q-last-project", selectedBaseDir)
    }
  }, [selectedBaseDir])

  useEffect(() => {
    const es = createSSE()
    es.addEventListener("projects-updated", () => { refreshProjects() })
    es.addEventListener("session-status", ((e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        setProjects((prev) =>
          prev.map((p) =>
            p.baseDir === data.baseDir
              ? { ...p, sessions: p.sessions.map((s) => s.sessionId === data.sessionId ? { ...s, status: data.status } : s) }
              : p
          )
        )
      } catch {}
    }) as EventListener)
    return () => es.close()
  }, [refreshProjects])

  const { items, add, remove, update, clear, reorder, executeById, retry, skip, sessionStatus, realSessionId, statusDetail } = useQueue(selectedBaseDir, sessionId)
  const currentProject = projects.find((p) => p.baseDir === selectedBaseDir)
  const canExecute = (currentProject?.hasSdk || currentProject?.hasCallback) ?? false

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragging.current) return
      const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX))
      widthRef.current = w
      if (sidebarRef.current) sidebarRef.current.style.width = w + "px"
      if (handleRef.current) handleRef.current.style.left = (w - 10) + "px"
    }
    function handleMouseUp() {
      if (!dragging.current) return
      dragging.current = false
      resizeActive.current = false
      deactivateBorder()
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      localStorage.setItem("opencode-q-sidebar-width", String(widthRef.current))
      setSidebarWidth(widthRef.current)
    }
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [])

  function activateBorder() {
    if (!sidebarRef.current) return
    sidebarRef.current.classList.add("border-blue-300")
    sidebarRef.current.classList.remove("border-gray-200")
  }

  function deactivateBorder() {
    if (!sidebarRef.current) return
    if (resizeActive.current) return
    sidebarRef.current.classList.remove("border-blue-300")
    sidebarRef.current.classList.add("border-gray-200")
  }

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    dragging.current = true
    resizeActive.current = true
    activateBorder()
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  function handleResizeEnter() {
    resizeActive.current = true
    activateBorder()
  }

  function handleResizeLeave() {
    if (dragging.current) return
    resizeActive.current = false
    deactivateBorder()
  }

  return (
    <div className="flex min-h-screen relative">
      {projects.length > 0 && (
        <div ref={sidebarRef} className="shrink-0 border-r border-gray-200 transition-colors" style={{ width: sidebarWidth }}>
          <ProjectSidebar projects={projects} selectedBaseDir={selectedBaseDir} onSelect={setSelectedBaseDir} />
        </div>
      )}
      {projects.length > 0 && (
        <div
          ref={handleRef}
          onMouseDown={handleResizeMouseDown}
          onMouseEnter={handleResizeEnter}
          onMouseLeave={handleResizeLeave}
          className="absolute top-1/2 -translate-y-1/2 w-5 h-9 bg-white border border-gray-200 rounded-md shadow-sm flex items-center justify-center cursor-col-resize z-50 group hover:border-blue-300 hover:shadow-md active:border-blue-300 active:shadow-md transition-[border-color,box-shadow]"
          style={{ left: sidebarWidth - 10 }}
        >
          <div className="flex flex-col items-center gap-[2px]">
            <div className="flex gap-[2px]">
              <div className="w-[3px] h-[3px] rounded-full bg-gray-300 group-hover:bg-blue-500 group-active:bg-blue-600 transition-colors" />
              <div className="w-[3px] h-[3px] rounded-full bg-gray-300 group-hover:bg-blue-500 group-active:bg-blue-600 transition-colors" />
            </div>
            <div className="flex gap-[2px]">
              <div className="w-[3px] h-[3px] rounded-full bg-gray-300 group-hover:bg-blue-500 group-active:bg-blue-600 transition-colors" />
              <div className="w-[3px] h-[3px] rounded-full bg-gray-300 group-hover:bg-blue-500 group-active:bg-blue-600 transition-colors" />
            </div>
            <div className="flex gap-[2px]">
              <div className="w-[3px] h-[3px] rounded-full bg-gray-300 group-hover:bg-blue-500 group-active:bg-blue-600 transition-colors" />
              <div className="w-[3px] h-[3px] rounded-full bg-gray-300 group-hover:bg-blue-500 group-active:bg-blue-600 transition-colors" />
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 p-4">
        <Header sessionId={sessionId} realSessionId={realSessionId} sessionStatus={sessionStatus} statusDetail={statusDetail} onRetry={retry} onSkip={skip} />
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <QueueList items={items} onRemove={remove} onUpdate={update} onReorder={reorder} onClear={clear} onExecute={canExecute ? executeById : undefined} />
        )}
        <AddPrompt onAdd={add} />
      </div>
    </div>
  )
}
