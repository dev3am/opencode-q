import { useEffect, useMemo, useState } from "react";
import * as api from "./api/client";
import AddPrompt from "./components/AddPrompt";
import EmptyState from "./components/EmptyState";
import ProjectSidebar from "./components/ProjectSidebar";
import QueueList from "./components/QueueList";
import QuickBar from "./components/QuickBar";
import Toast from "./components/Toast";
import { usePolling } from "./hooks/usePolling";
import { useTranslation } from "./i18n/useTranslation";

export default function App() {
	const { projects, refresh } = usePolling();
	const [selBase, setSelBase] = useState<string>("");
	const [selSession, setSelSession] = useState<string>("");
	const [toast, setToast] = useState<string>("");
	const { t } = useTranslation();

	const project = useMemo(
		() => projects.find((p) => p.baseDir === selBase) || projects[0],
		[projects, selBase],
	);
	const session = useMemo(() => {
		if (!project) return undefined;
		const found = project.sessions.find((s) => s.sessionId === selSession);
		if (found) return found;
		const sorted = [...project.sessions].sort(
			(a, b) =>
				(Date.parse(b.updatedAt ?? "") || 0) -
				(Date.parse(a.updatedAt ?? "") || 0),
		);
		return sorted[0];
	}, [project, selSession]);
	const inFlight = !!session?.items.some(
		(i) => i.status === "pending" || i.status === "sent",
	);

	async function act(fn: () => Promise<unknown>) {
		await fn();
		await refresh();
	}

	async function actSend(
		fn: () => Promise<{ ok: boolean; conflict: boolean }>,
	) {
		const r = await fn();
		if (!r.ok)
			setToast(r.conflict ? t("toast.sendConflict") : t("toast.sendFailed"));
		await refresh();
	}

	useEffect(() => {
		if (!toast) return;
		const id = setTimeout(() => setToast(""), 3000);
		return () => clearTimeout(id);
	}, [toast]);

	if (!project)
		return <div className="p-6 text-gray-500">{t("empty.noProjects")}</div>;

	return (
		<div className="flex h-screen overflow-hidden">
			<ProjectSidebar
				projects={projects}
				selectedBaseDir={project.baseDir}
				selectedSessionId={session?.sessionId ?? ""}
				onSelectProject={(b) => {
					setSelBase(b);
					setSelSession("");
				}}
				onSelectSession={setSelSession}
			/>
			<div className="flex-1 flex flex-col p-4 min-w-0">
				{session && (
					<QuickBar
						onAdd={(text) =>
							act(() => api.addItem(project.baseDir, session.sessionId, text))
						}
					/>
				)}
				<div className="flex-1 overflow-y-auto min-h-0">
					{!session || session.items.length === 0 ? (
						<EmptyState />
					) : (
						<QueueList
							items={session.items}
							inFlight={inFlight}
							online={project.online}
							onSend={(id) =>
								actSend(() =>
									api.sendItem(project.baseDir, session!.sessionId, id),
								)
							}
							onResend={(id) =>
								actSend(() =>
									api.resendItem(project.baseDir, session!.sessionId, id),
								)
							}
							onEdit={(id, text) =>
								act(() =>
									api.updateItem(project.baseDir, session!.sessionId, id, text),
								)
							}
							onRemove={(id) =>
								act(() =>
									api.removeItem(project.baseDir, session!.sessionId, id),
								)
							}
							onReorder={(from, to) =>
								act(() =>
									api.reorder(project.baseDir, session!.sessionId, from, to),
								)
							}
						/>
					)}
				</div>
				{session && (
					<AddPrompt
						onAdd={(text) =>
							act(() => api.addItem(project.baseDir, session!.sessionId, text))
						}
					/>
				)}
			</div>
			{toast && <Toast message={toast} onClose={() => setToast("")} />}
		</div>
	);
}
