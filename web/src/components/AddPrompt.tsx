import { useState } from "react";
import { useTranslation } from "../i18n/useTranslation";

interface AddPromptProps {
	onAdd: (text: string) => Promise<void>;
}

export default function AddPrompt({ onAdd }: AddPromptProps) {
	const { t } = useTranslation();
	const [text, setText] = useState("");
	const [submitting, setSubmitting] = useState(false);

	async function submit() {
		if (!text.trim() || submitting) return;
		setSubmitting(true);
		try {
			await onAdd(text);
			setText("");
		} finally {
			setSubmitting(false);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey && !submitting) {
			e.preventDefault();
			submit();
		}
	}

	const hasText = text.trim().length > 0;

	return (
		<div className="mt-2 shrink-0">
			<div className="border border-gray-200 rounded-xl bg-white shadow-sm transition-all focus-within:border-gray-300 focus-within:shadow-md">
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={t("prompt.placeholder")}
					rows={2}
					disabled={submitting}
					className="w-full px-4 pt-3 pb-1 border-none outline-none text-sm resize-none bg-transparent disabled:opacity-50"
				/>
				<div className="flex justify-end items-center px-3 pb-2">
					<button
						onClick={submit}
						disabled={!hasText || submitting}
						className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-gray-800 text-white hover:bg-gray-700"
					>
						{t("prompt.add")} →
					</button>
				</div>
			</div>
		</div>
	);
}
