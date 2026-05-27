import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
	onRemove: (id: string) => void;
}

export default function QueueItem({
	item,
	canSend,
	onSend,
	onResend,
	onRemove,
}: Props) {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({ id: item.id });
	const style = { transform: CSS.Transform.toString(transform), transition };
	const { t } = useTranslation();
	return (
		<li
			ref={setNodeRef}
			style={style}
			className="flex items-center gap-2 rounded border border-gray-200 p-2 bg-white"
		>
			<span
				{...attributes}
				{...listeners}
				className="cursor-grab text-gray-400"
			>
				⠿
			</span>
			<span
				className={`text-xs px-2 py-0.5 rounded ${BADGE[item.status] || "bg-gray-100"}`}
			>
				{t(`item.status.${item.status}`)}
			</span>
			<span className="flex-1 truncate" title={item.text}>
				{item.text}
			</span>
			{item.status === "queued" && (
				<button
					disabled={!canSend}
					onClick={() => onSend(item.id)}
					className="text-sm text-blue-600 disabled:text-gray-300"
				>
					{t("item.send")}
				</button>
			)}
			{item.status === "failed" && (
				<button
					disabled={!canSend}
					onClick={() => onResend(item.id)}
					className="text-sm text-red-600 disabled:text-gray-300"
				>
					{t("item.resend")}
				</button>
			)}
			<button
				onClick={() => onRemove(item.id)}
				className="text-sm text-gray-400 hover:text-red-500"
			>
				{t("queue.remove")}
			</button>
		</li>
	);
}
