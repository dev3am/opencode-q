import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import type { QueueItem as Item } from "../api/client";
import { useTranslation } from "../i18n/useTranslation";

const BADGE: Record<string, string> = {
	queued: "bg-gray-200 text-gray-700",
	pending: "bg-amber-200 text-amber-800",
	sent: "bg-blue-200 text-blue-800",
	done: "bg-green-200 text-green-800",
	failed: "bg-red-200 text-red-800",
};

interface Props {
	item: Item;
	canSend: boolean;
	onSend: (id: string) => void;
	onResend: (id: string) => void;
	onEdit: (id: string, text: string) => void;
	onRemove: (id: string) => void;
}

export default function QueueItem({
	item,
	canSend,
	onSend,
	onResend,
	onEdit,
	onRemove,
}: Props) {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({ id: item.id });
	const style = { transform: CSS.Transform.toString(transform), transition };
	const { t } = useTranslation();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(item.text);

	const editable = item.status === "queued" || item.status === "failed";

	function startEdit() {
		setDraft(item.text);
		setEditing(true);
	}

	function save() {
		const text = draft.trim();
		if (!text) return;
		if (text !== item.text) onEdit(item.id, draft);
		setEditing(false);
	}

	function cancel() {
		setDraft(item.text);
		setEditing(false);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			save();
		} else if (e.key === "Escape") {
			e.preventDefault();
			cancel();
		}
	}

	return (
		<li
			ref={setNodeRef}
			style={style}
			className="flex items-start gap-2 rounded border border-gray-200 p-2 bg-white"
		>
			<span
				{...attributes}
				{...listeners}
				className="cursor-grab text-gray-400 pt-0.5 shrink-0"
			>
				⠿
			</span>
			<span
				className={`text-xs px-2 py-0.5 rounded shrink-0 mt-0.5 ${BADGE[item.status] || "bg-gray-100"}`}
			>
				{t(`item.status.${item.status}`)}
			</span>
			{editing ? (
				<div className="flex-1 min-w-0">
					<textarea
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={handleKeyDown}
						autoFocus
						rows={Math.min(8, Math.max(2, draft.split("\n").length))}
						className="w-full px-2 py-1 border border-gray-300 rounded outline-none text-sm resize-y focus:border-gray-400"
					/>
					<div className="flex justify-end gap-2 mt-1">
						<button
							onClick={cancel}
							className="text-sm text-gray-400 hover:text-gray-600"
						>
							{t("queue.cancel")}
						</button>
						<button
							onClick={save}
							disabled={!draft.trim()}
							className="text-sm text-blue-600 disabled:text-gray-300"
						>
							{t("queue.save")}
						</button>
					</div>
				</div>
			) : (
				<>
					<span className="flex-1 min-w-0 whitespace-pre-wrap break-words">
						{item.text}
					</span>
					{editable && (
						<button
							onClick={startEdit}
							className="text-sm text-gray-400 hover:text-gray-700 shrink-0"
						>
							{t("queue.edit")}
						</button>
					)}
					{item.status === "queued" && (
						<button
							disabled={!canSend}
							onClick={() => onSend(item.id)}
							className="text-sm text-blue-600 disabled:text-gray-300 shrink-0"
						>
							{t("item.send")}
						</button>
					)}
					{item.status === "failed" && (
						<button
							disabled={!canSend}
							onClick={() => onResend(item.id)}
							className="text-sm text-red-600 disabled:text-gray-300 shrink-0"
						>
							{t("item.resend")}
						</button>
					)}
					<button
						onClick={() => onRemove(item.id)}
						className="text-sm text-gray-400 hover:text-red-500 shrink-0"
					>
						{t("queue.remove")}
					</button>
				</>
			)}
		</li>
	);
}
