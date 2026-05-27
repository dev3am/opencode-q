import { useState } from "react";
import { useTranslation } from "../i18n/useTranslation";

interface AddPromptProps {
	onAdd: (text: string) => Promise<void>;
}

export default function AddPrompt({ onAdd }: AddPromptProps) {
	const { t } = useTranslation();
	const [text, setText] = useState("");

	async function submit() {
		if (!text.trim()) return;
		await onAdd(text);
		setText("");
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}

	const hasText = text.trim().length > 0;

	return (
		<div className="mt-4">
			<div className="border border-gray-200 rounded-xl bg-white shadow-sm transition-all focus-within:border-gray-300 focus-within:shadow-md">
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={t("prompt.placeholder")}
					rows={2}
					className="w-full px-4 pt-3 pb-1 border-none outline-none text-sm resize-none bg-transparent"
				/>
				<div className="flex justify-end items-center px-3 pb-2">
					<button
						onClick={submit}
						disabled={!hasText}
						className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-gray-800 text-white hover:bg-gray-700"
					>
						{t("prompt.add")} →
					</button>
				</div>
			</div>
		</div>
	);
}
