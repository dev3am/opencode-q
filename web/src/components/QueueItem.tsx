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
    <div className="flex items-start gap-2 group py-1.5">
      <div className="flex flex-col items-center pt-3 gap-1 min-w-[18px]">
        <span {...dragHandleProps} className="cursor-grab text-gray-300 select-none hover:text-gray-500 transition-colors text-sm leading-none" title="Drag to reorder">≡</span>
        <span className="text-gray-300 text-[11px] font-mono">{index + 1}</span>
      </div>

      {editing ? (
        <div className="flex-1 flex items-start gap-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            autoFocus
            rows={Math.max(1, text.split("\n").length)}
            className="flex-1 px-4 py-3 border border-blue-400 rounded-2xl text-sm outline-none resize-y bg-white shadow-sm"
          />
          <button onClick={() => onRemove(item.id)} className="bg-transparent border-none cursor-pointer text-gray-300 hover:text-red-400 text-xs pt-3 transition-colors" title="Remove">✕</button>
        </div>
      ) : (
        <div className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 pb-8 pr-7 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed cursor-text border border-transparent hover:border-gray-200 transition-colors relative"
          onDoubleClick={() => setEditing(true)}
          title="더블클릭하여 수정"
        >
          {item.text}
          {onExecute && (
            <button
              onClick={(e) => { e.stopPropagation(); onExecute(item.id) }}
              className="absolute top-1/2 -translate-y-1/2 right-2 bg-transparent border-none cursor-pointer text-gray-300 hover:text-blue-500 text-xs transition-colors"
              title="Execute"
            >▶</button>
          )}
          {!editing && (
            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); setEditing(true) }} className="bg-transparent border-none cursor-pointer text-gray-300 hover:text-gray-500 text-xs transition-colors" title="Edit">✎</button>
              <button onClick={(e) => { e.stopPropagation(); onRemove(item.id) }} className="bg-transparent border-none cursor-pointer text-gray-300 hover:text-red-400 text-xs transition-colors" title="Remove">✕</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
