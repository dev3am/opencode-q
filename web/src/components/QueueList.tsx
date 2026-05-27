import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { QueueItem as Item } from "../api/client";
import QueueItem from "./QueueItem";

interface Props {
	items: Item[];
	inFlight: boolean;
	online: boolean;
	onSend: (id: string) => void;
	onResend: (id: string) => void;
	onRemove: (id: string) => void;
	onReorder: (from: number, to: number) => void;
}

export default function QueueList({
	items,
	inFlight,
	online,
	onSend,
	onResend,
	onRemove,
	onReorder,
}: Props) {
	function onDragEnd(e: DragEndEvent) {
		const { active, over } = e;
		if (!over || active.id === over.id) return;
		const from = items.findIndex((i) => i.id === active.id);
		const to = items.findIndex((i) => i.id === over.id);
		if (from !== -1 && to !== -1) onReorder(from, to);
	}
	return (
		<DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
			<SortableContext
				items={items.map((i) => i.id)}
				strategy={verticalListSortingStrategy}
			>
				<ul className="space-y-2">
					{items.map((item) => (
						<QueueItem
							key={item.id}
							item={item}
							canSend={online && !inFlight}
							onSend={onSend}
							onResend={onResend}
							onRemove={onRemove}
						/>
					))}
				</ul>
			</SortableContext>
		</DndContext>
	);
}
