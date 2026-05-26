import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { QueueItem as QueueItemType } from "../api/client"
import QueueItemComponent from "./QueueItem"

interface QueueListProps {
  items: QueueItemType[]
  onRemove: (id: string) => void
  onUpdate: (id: string, text: string) => void
  onReorder: (from: number, to: number) => void
  onClear: () => void
  onExecute?: (id: string) => void
}

function SortableItem({ item, index, onRemove, onUpdate, onExecute }: { item: QueueItemType; index: number; onRemove: (id: string) => void; onUpdate: (id: string, text: string) => void; onExecute?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <QueueItemComponent item={item} index={index} onRemove={onRemove} onUpdate={onUpdate} onExecute={onExecute} dragHandleProps={listeners} />
    </div>
  )
}

export default function QueueList({ items, onRemove, onUpdate, onReorder, onClear, onExecute }: QueueListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: any) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) onReorder(oldIndex + 1, newIndex + 1)
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button onClick={onClear} className="bg-transparent border border-gray-300 cursor-pointer px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors">Clear all</button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1">
            {items.map((item, index) => (
              <SortableItem key={item.id} item={item} index={index} onRemove={onRemove} onUpdate={onUpdate} onExecute={onExecute} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
