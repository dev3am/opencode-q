import { useEffect, useRef, useState } from "react";
import { fetchState, type ProjectState } from "../api/client";

export function nextInterval(hasInFlight: boolean): number {
	return hasInFlight ? 500 : 2000;
}

export function usePolling() {
	const [projects, setProjects] = useState<ProjectState[]>([]);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	async function refresh(): Promise<ProjectState[]> {
		try {
			const { projects } = await fetchState();
			setProjects(projects);
			return projects;
		} catch {
			return [];
		}
	}

	useEffect(() => {
		let cancelled = false;
		async function loop() {
			const ps = await refresh();
			if (cancelled) return;
			const hasInFlight = ps.some((p) =>
				p.sessions.some((s) =>
					s.items.some((i) => i.status === "pending" || i.status === "sent"),
				),
			);
			timer.current = setTimeout(loop, nextInterval(hasInFlight));
		}
		loop();
		return () => {
			cancelled = true;
			if (timer.current) clearTimeout(timer.current);
		};
	}, []);

	return { projects, refresh };
}
