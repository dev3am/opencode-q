import { useState } from "react"
import { useQueue } from "./hooks/useQueue"
import Header from "./components/Header"
import QueueList from "./components/QueueList"
import AddPrompt from "./components/AddPrompt"
import EmptyState from "./components/EmptyState"

export default function App() {
  const [sessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get("session") || "default"
  })
  const { items, add, remove, clear, reorder, executeById, retry, skip, sessionStatus, realSessionId, statusDetail } = useQueue(sessionId)

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <Header sessionId={sessionId} realSessionId={realSessionId} sessionStatus={sessionStatus} statusDetail={statusDetail} onRetry={retry} onSkip={skip} />
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <QueueList items={items} onRemove={remove} onReorder={reorder} onClear={clear} onExecute={executeById} />
      )}
      <AddPrompt onAdd={add} />
    </div>
  )
}
