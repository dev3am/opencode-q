import { useState } from "react"
import type { QueueItem as QueueItemType } from "../api/client"

interface QueueItemProps {
  item: QueueItemType
  index: number
  onRemove: (id: string) => void
  onUpdate: (id: string, text: string) => void
  onExecute?: (id: string) => void
  dragHandleProps?: any
}

export default function QueueItem({ item, index, onRemove, onUpdate, onExecute, dragHandleProps }: QueueItemProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.text)

  function handleSave() {
    const trimmed = text.trim()
    if (trimmed && trimmed !== item.text) {
      onUpdate(item.id, trimmed)
    }
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave()
    if (e.key === "Escape") { setText(item.text); setEditing(false) }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #f0f0f0", gap: 8 }}>
      <span {...dragHandleProps} style={{ cursor: "grab", color: "#999", userSelect: "none" }} title="Drag to reorder">≡</span>
      <span style={{ color: "#999", minWidth: 20, textAlign: "right" }}>{index + 1}</span>
      <span style={{ color: "#aaa", fontSize: 12 }}>[{item.id}]</span>
      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          rows={Math.max(1, text.split("\n").length)}
          style={{ flex: 1, padding: "4px 8px", border: "1px solid #3b82f6", borderRadius: 4, fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical" }}
        />
      ) : (
        <span style={{ flex: 1, cursor: "text", whiteSpace: "pre-wrap" }} onDoubleClick={() => setEditing(true)} title="더블클릭하여 수정">{item.text}</span>
      )}
      {!editing && (
        <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 13 }} title="Edit">✎</button>
      )}
      {onExecute && (
        <button onClick={() => onExecute(item.id)} style={{ background: "#3b82f6", border: "none", cursor: "pointer", color: "white", fontSize: 12, padding: "4px 10px", borderRadius: 4 }} title="Execute">▶</button>
      )}
      <button onClick={() => onRemove(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 16 }} title="Remove">✕</button>
    </div>
  )
}
