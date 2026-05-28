import { useState } from "react";
import { useQuickButtons } from "../hooks/useQuickButtons";
import { useTranslation } from "../i18n/useTranslation";

interface QuickBarProps {
	onAdd: (text: string) => Promise<void>;
}

export default function QuickBar({ onAdd }: QuickBarProps) {
	const { t } = useTranslation();
	const { buttons, addButton, removeButton, updateButton, canAdd } =
		useQuickButtons();
	const [editing, setEditing] = useState(false);
	const [adding, setAdding] = useState(false);
	const [newLabel, setNewLabel] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editLabel, setEditLabel] = useState("");

	async function handleClick(label: string) {
		if (editing) return;
		await onAdd(label);
	}

	function startAdd() {
		setNewLabel("");
		setAdding(true);
	}

	function confirmAdd() {
		if (!newLabel.trim()) return;
		addButton(newLabel.trim());
		setAdding(false);
		setNewLabel("");
	}

	function cancelAdd() {
		setAdding(false);
		setNewLabel("");
	}

	function startEditButton(id: string, label: string) {
		setEditingId(id);
		setEditLabel(label);
	}

	function confirmEdit(id: string) {
		if (!editLabel.trim()) return;
		updateButton(id, editLabel.trim());
		setEditingId(null);
	}

	function cancelEdit() {
		setEditingId(null);
		setEditLabel("");
	}

	function finishEditing() {
		setEditing(false);
		setAdding(false);
		setEditingId(null);
	}

	if (buttons.length === 0 && !editing) {
		return (
			<div className="flex items-center gap-1.5 shrink-0 mb-3 px-1 py-2 rounded-lg border bg-gray-50 border-gray-200">
				<span className="text-[10px] uppercase tracking-wide mr-1 text-gray-400">
					{t("quickbar.label")}
				</span>
				<button
					onClick={() => setEditing(true)}
					className="px-2 py-1 text-xs rounded-md border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500"
				>
					+ {t("quickbar.add")}
				</button>
			</div>
		);
	}

	return (
		<div
			className={`flex items-center gap-1.5 flex-wrap shrink-0 mb-3 px-1 py-2 rounded-lg border transition-colors ${editing ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"}`}
		>
			<span
				className={`text-[10px] uppercase tracking-wide mr-1 ${editing ? "text-amber-700" : "text-gray-400"}`}
			>
				{t("quickbar.label")}
			</span>

			{buttons.map((btn) =>
				editingId === btn.id ? (
					<div key={btn.id} className="flex items-center gap-1">
						<input
							value={editLabel}
							onChange={(e) => setEditLabel(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") confirmEdit(btn.id);
								if (e.key === "Escape") cancelEdit();
							}}
							autoFocus
							className="px-2 py-1 text-xs border-2 border-amber-400 rounded-md outline-none bg-white w-24"
						/>
						<button
							onClick={() => confirmEdit(btn.id)}
							disabled={!editLabel.trim()}
							className="px-2 py-1 text-xs rounded-md bg-green-500 text-white disabled:opacity-30"
						>
							{t("quickbar.save")}
						</button>
						<button
							onClick={cancelEdit}
							className="px-2 py-1 text-xs rounded-md border border-gray-300 bg-white"
						>
							{t("quickbar.cancel")}
						</button>
					</div>
				) : (
					<div key={btn.id} className="relative group">
						<button
							onClick={() => handleClick(btn.label)}
							onDoubleClick={() =>
								editing && startEditButton(btn.id, btn.label)
							}
							className={`px-3 py-1 text-xs rounded-md border transition-colors ${
								editing
									? "border-amber-300 bg-white hover:border-amber-400"
									: "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
							}`}
						>
							{btn.label}
						</button>
						{editing && (
							<button
								onClick={() => removeButton(btn.id)}
								className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center leading-none hover:bg-red-600"
							>
								×
							</button>
						)}
					</div>
				),
			)}

			{adding && (
				<div className="flex items-center gap-1">
					<input
						value={newLabel}
						onChange={(e) => setNewLabel(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") confirmAdd();
							if (e.key === "Escape") cancelAdd();
						}}
						autoFocus
						placeholder={t("quickbar.placeholder")}
						className="px-2 py-1 text-xs border-2 border-amber-400 rounded-md outline-none bg-white w-24"
					/>
					<button
						onClick={confirmAdd}
						disabled={!newLabel.trim()}
						className="px-2 py-1 text-xs rounded-md bg-green-500 text-white disabled:opacity-30"
					>
						{t("quickbar.save")}
					</button>
					<button
						onClick={cancelAdd}
						className="px-2 py-1 text-xs rounded-md border border-gray-300 bg-white"
					>
						{t("quickbar.cancel")}
					</button>
				</div>
			)}

			{editing && canAdd && !adding && (
				<button
					onClick={startAdd}
					className="px-3 py-1 text-xs rounded-md border border-dashed border-amber-300 text-amber-700 hover:border-amber-400"
				>
					+ {t("quickbar.add")}
				</button>
			)}

			{!editing && canAdd && (
				<button
					onClick={startAdd}
					className="px-2 py-1 text-xs rounded-md border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500"
				>
					+ {t("quickbar.add")}
				</button>
			)}

			<div className="ml-auto flex items-center">
				{editing ? (
					<button
						onClick={finishEditing}
						className="px-2.5 py-1 text-xs rounded-md border border-amber-300 bg-white text-amber-700 hover:bg-amber-50"
					>
						{t("quickbar.done")}
					</button>
				) : (
					<button
						onClick={() => setEditing(true)}
						className="px-1.5 py-1 text-xs text-gray-400 hover:text-gray-600 rounded"
						title={t("quickbar.editMode")}
					>
						✏️
					</button>
				)}
			</div>
		</div>
	);
}
