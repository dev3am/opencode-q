import type { QueueItem as QueueItemType } from "../api/client"

interface QueueItemProps {
  item: QueueItemType
  index: number
  onRemove: (id: string) => void
  onExecute?: (id: string) => void
  dragHandleProps?: any
}

export default function QueueItem({ item, index, onRemove, onExecute, dragHandleProps }: QueueItemProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #f0f0f0", gap: 8 }}>
      <span {...dragHandleProps} style={{ cursor: "grab", color: "#999", userSelect: "none" }} title="Drag to reorder">≡</span>
      <span style={{ color: "#999", minWidth: 20, textAlign: "right" }}>{index + 1}</span>
      <span style={{ color: "#aaa", fontSize: 12 }}>[{item.id}]</span>
      <span style={{ flex: 1 }}>{item.text}</span>
      {onExecute && (
        <button onClick={() => onExecute(item.id)} style={{ background: "#3b82f6", border: "none", cursor: "pointer", color: "white", fontSize: 12, padding: "4px 10px", borderRadius: 4 }} title="Execute">▶</button>
      )}
      <button onClick={() => onRemove(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 16 }} title="Remove">✕</button>
    </div>
  )
}
