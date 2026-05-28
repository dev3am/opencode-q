import { useCallback, useState } from "react";

export interface QuickButton {
	id: string;
	label: string;
}

const STORAGE_KEY = "opencode-q-quick-buttons";
const MAX_BUTTONS = 8;

function generateId(): string {
	return Math.random().toString(36).slice(2, 10);
}

function loadButtons(): QuickButton[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed;
	} catch {
		return [];
	}
}

function saveButtons(buttons: QuickButton[]): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(buttons));
}

export function useQuickButtons() {
	const [buttons, setButtons] = useState<QuickButton[]>(loadButtons);

	const addButton = useCallback((label: string) => {
		if (!label.trim()) return;
		setButtons((prev) => {
			if (prev.length >= MAX_BUTTONS) return prev;
			const next = [...prev, { id: generateId(), label }];
			saveButtons(next);
			return next;
		});
	}, []);

	const removeButton = useCallback((id: string) => {
		setButtons((prev) => {
			const next = prev.filter((b) => b.id !== id);
			saveButtons(next);
			return next;
		});
	}, []);

	const updateButton = useCallback((id: string, label: string) => {
		if (!label.trim()) return;
		setButtons((prev) => {
			const next = prev.map((b) => (b.id === id ? { ...b, label } : b));
			saveButtons(next);
			return next;
		});
	}, []);

	const canAdd = buttons.length < MAX_BUTTONS;

	return { buttons, addButton, removeButton, updateButton, canAdd };
}
