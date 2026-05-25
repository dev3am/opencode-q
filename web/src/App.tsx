import { useState, useEffect } from "react"
import { useQueue } from "./hooks/useQueue"
import { fetchProjects, type ProjectInfo } from "./api/client"
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

  useEffect(() => {
    fetchProjects().then((data) => {
      setProjects(data.projects)
      if (!selectedBaseDir && data.projects.length > 0) {
        setSelectedBaseDir(data.projects[0].baseDir)
      }
    })
  }, [])

  const { items, add, remove, clear, reorder, executeById, retry, skip, sessionStatus, realSessionId, statusDetail } = useQueue(selectedBaseDir, sessionId)

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
          <QueueList items={items} onRemove={remove} onReorder={reorder} onClear={clear} onExecute={executeById} />
        )}
        <AddPrompt onAdd={add} />
      </div>
    </div>
  )
}
