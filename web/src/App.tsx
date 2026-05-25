import { useState, useEffect, useCallback } from "react"
import { useQueue } from "./hooks/useQueue"
import { fetchProjects, createSSE, type ProjectInfo } from "./api/client"
import Header from "./components/Header"
import QueueList from "./components/QueueList"
import AddPrompt from "./components/AddPrompt"
import EmptyState from "./components/EmptyState"
import ProjectSidebar from "./components/ProjectSidebar"

export default function App() {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [selectedBaseDir, setSelectedBaseDir] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get("project") || ""
  })
  const sessionId = "default"

  const refreshProjects = useCallback(() => {
    fetchProjects().then((data) => {
      setProjects((prev) => {
        const next = data.projects
        setSelectedBaseDir((cur) => {
          if (!cur && next.length > 0) return next[0].baseDir
          if (cur && !next.some((p) => p.baseDir === cur)) {
            return next.length > 0 ? next[0].baseDir : ""
          }
          return cur
        })
        return next
      })
    })
  }, [])

  useEffect(() => { refreshProjects() }, [refreshProjects])

  useEffect(() => {
    const es = createSSE()
    es.addEventListener("projects-updated", () => { refreshProjects() })
    return () => es.close()
  }, [refreshProjects])

  const { items, add, remove, clear, reorder, executeById, retry, skip, sessionStatus, realSessionId, statusDetail } = useQueue(selectedBaseDir, sessionId)
  const currentProject = projects.find((p) => p.baseDir === selectedBaseDir)
  const canExecute = currentProject?.hasSdk ?? false

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {projects.length > 1 && (
        <ProjectSidebar projects={projects} selectedBaseDir={selectedBaseDir} onSelect={setSelectedBaseDir} />
      )}
      <div style={{ flex: 1, maxWidth: 600, margin: "0 auto", padding: 16 }}>
        <Header sessionId={sessionId} realSessionId={realSessionId} sessionStatus={sessionStatus} statusDetail={statusDetail} onRetry={retry} onSkip={skip} />
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <QueueList items={items} onRemove={remove} onReorder={reorder} onClear={clear} onExecute={canExecute ? executeById : undefined} />
        )}
        <AddPrompt onAdd={add} />
      </div>
    </div>
  )
}
