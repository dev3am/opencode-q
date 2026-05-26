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
    if (e.key === "Enter" && editing) handleSave()
    if (e.key === "Escape") { setText(item.text); setEditing(false) }
  }

  return (
    <div className="flex items-center px-3 py-2.5 border-b border-gray-100 gap-2 group">
      <span {...dragHandleProps} className="cursor-grab text-gray-300 select-none hover:text-gray-500 transition-colors" title="Drag to reorder">≡</span>
      <span className="text-gray-300 min-w-5 text-right text-xs font-mono">{index + 1}</span>
      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          rows={Math.max(1, text.split("\n").length)}
          className="flex-1 px-2 py-1 border border-blue-400 rounded text-sm outline-none resize-y"
        />
      ) : (
        <span className="flex-1 cursor-text whitespace-pre-wrap text-sm text-gray-800 leading-relaxed" onDoubleClick={() => setEditing(true)} title="더블클릭하여 수정">{item.text}</span>
      )}
      {!editing && (
        <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 bg-transparent border-none cursor-pointer text-gray-300 hover:text-gray-500 text-sm transition-all" title="Edit">✎</button>
      )}
      {onExecute && (
        <button onClick={() => onExecute(item.id)} className="bg-transparent border-none cursor-pointer text-gray-300 hover:text-blue-500 hover:bg-blue-50 text-xs px-1.5 py-1 rounded transition-all" title="Execute">▶</button>
      )}
      <button onClick={() => onRemove(item.id)} className="opacity-0 group-hover:opacity-100 bg-transparent border-none cursor-pointer text-gray-300 hover:text-red-400 text-sm transition-all" title="Remove">✕</button>
    </div>
  )
}
