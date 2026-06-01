import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import type * as http from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "@opencode-ai/plugin";
import {
	DEFAULT_PORT,
	HEARTBEAT_MS,
	isExcludedBaseDir,
	REELECTION_MS,
	SWEEP_MS,
	VERSION,
} from "./constants";
import { createExecutor } from "./executor";
import { markInstanceOffline, touchHeartbeat } from "./registry";
import {
	createRequestHandler,
	isOpencodeQHost,
	isPortInUse,
	runSweep,
	tryListen,
} from "./server";
import { migrateLegacyDefault } from "./storage";
import type { SessionInfo } from "./types";

export interface PluginRuntimeDeps {
	baseDir: string;
	instanceId: string;
	executor: ReturnType<typeof createExecutor>;
	registerable?: boolean;
	pid?: number;
	cwd?: string;
	startedAt?: string;
}

export function createPluginRuntime(
	deps: PluginRuntimeDeps,
	validSessionIds: Set<string>,
) {
	const { baseDir, instanceId, executor } = deps;
	const registerable = deps.registerable !== false;
	const diagnostics = {
		pid: deps.pid ?? process.pid,
		cwd: deps.cwd ?? process.cwd(),
		startedAt: deps.startedAt ?? new Date().toISOString(),
		version: VERSION,
	};
	const sessions = new Map<string, SessionInfo>();

	function persist() {
		if (!registerable) return;
		touchHeartbeat(baseDir, [...sessions.values()], instanceId, diagnostics);
	}

	function seeSession(
		sid: string,
		meta?: { title?: string; createdAt?: string; updatedAt?: string },
	) {
		if (!registerable) return;
		const existing = sessions.get(sid);
		if (!existing) {
			sessions.set(sid, {
				sessionId: sid,
				status: "idle",
				title: meta?.title ?? "",
				createdAt: meta?.createdAt ?? new Date().toISOString(),
				updatedAt: meta?.updatedAt ?? new Date().toISOString(),
			});
			migrateLegacyDefault(baseDir, sid);
			validSessionIds.add(sid);
		} else if (meta) {
			sessions.set(sid, {
				...existing,
				title: meta.title ?? existing.title,
				createdAt: meta.createdAt ?? existing.createdAt,
				updatedAt: meta.updatedAt ?? existing.updatedAt,
			});
			validSessionIds.add(sid);
		}
		executor.noteSession(sid, sessions.get(sid)!.status);
	}

	function setSessionStatus(sid: string, status: string) {
		const s = sessions.get(sid);
		if (s) sessions.set(sid, { ...s, status });
	}

	return {
		persist,
		seeSession,
		event: async ({ event }: any) => {
			if (event?.type === "server.instance.disposed") {
				if (!registerable) return;
				if (event.properties?.directory === baseDir)
					markInstanceOffline(instanceId);
				return;
			}
			const info = event?.properties?.info;
			if (info?.parentID) return;

			const sid: string | undefined = event?.properties?.sessionID ?? info?.id;
			if (!sid) return;
			if (!info && !validSessionIds.has(sid)) return;

			const meta = info
				? {
						title: info.title ?? "",
						createdAt:
							info.time?.created != null
								? new Date(info.time.created).toISOString()
								: undefined,
						updatedAt:
							info.time?.updated != null
								? new Date(info.time.updated).toISOString()
								: undefined,
					}
				: undefined;
			seeSession(sid, meta);

			if (event.type === "session.status") {
				const busy = event.properties?.status?.type === "busy";
				setSessionStatus(sid, busy ? "busy" : "idle");
				executor.noteSession(sid, busy ? "busy" : "idle");
				persist();
				return;
			}
			if (event.type === "session.idle") {
				setSessionStatus(sid, "idle");
				executor.noteSession(sid, "idle");
				executor.onIdle(sid);
				persist();
				return;
			}
			if (event.type === "session.error") {
				const err = event.properties?.error;
				setSessionStatus(sid, "error");
				executor.onError(
					sid,
					err ? err.name || JSON.stringify(err) : "session error",
				);
				persist();
				return;
			}
			// session.created/updated: seeSession has already updated meta, just persist
			persist();
		},
	};
}

export interface DiscoverOpts {
	attempts?: number;
	delayMs?: number;
	log?: (msg: string) => void;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function discoverSessions(
	client: any,
	seeSession: (
		id: string,
		meta?: { title?: string; createdAt?: string; updatedAt?: string },
	) => void,
	noteBusy: (id: string) => void,
	validSessionIds: Set<string>,
	opts: DiscoverOpts = {},
): Promise<boolean> {
	const attempts = opts.attempts ?? 3;
	const delayMs = opts.delayMs ?? 500;
	for (let i = 0; i < attempts; i++) {
		try {
			const [list, status] = await Promise.all([
				client.session.list().then((r: any) => r.data ?? []),
				client.session.status().then((r: any) => r.data ?? {}),
			]);
			for (const s of list) {
				if (!s.id || s.parentID) continue;
				validSessionIds.add(s.id);
				seeSession(s.id, {
					title: s.title ?? "",
					createdAt:
						s.time?.created != null
							? new Date(s.time.created).toISOString()
							: undefined,
					updatedAt:
						s.time?.updated != null
							? new Date(s.time.updated).toISOString()
							: undefined,
				});
				if (status[s.id]?.type === "busy") noteBusy(s.id);
			}
			return true;
		} catch (e) {
			opts.log?.(`discoverSessions attempt ${i + 1} failed: ${String(e)}`);
			if (i < attempts - 1) await sleep(delayMs);
		}
	}
	return false;
}

function resolveWebDir(): string | undefined {
	const here = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		join(homedir(), ".config", "opencode", "plugins", "web"),
		join(here, "web"),
		join(here, "..", "..", "web", "dist"),
		join(process.cwd(), "web", "dist"),
	];
	for (const dir of candidates)
		if (existsSync(join(dir, "index.html"))) return dir;
	return undefined;
}

export const OpenCodeQ = (async ({ client, directory }: any) => {
	const baseDir = directory;
	const instanceId = randomUUID();
	const registerable = !isExcludedBaseDir(baseDir);
	const executor = createExecutor({
		baseDir,
		prompt: async (sessionId, text) => {
			await client.session.promptAsync({
				path: { id: sessionId },
				body: { parts: [{ type: "text", text }] },
			});
		},
	});
	if (registerable) executor.start();

	const validSessionIds = new Set<string>();

	const runtime = createPluginRuntime(
		{
			baseDir,
			instanceId,
			executor,
			registerable,
		},
		validSessionIds,
	);

	// Run session discovery asynchronously to avoid blocking OpenCode startup deadlock
	if (registerable) {
		void discoverSessions(
			client,
			(id, meta) => runtime.seeSession(id, meta),
			(id) => executor.noteSession(id, "busy"),
			validSessionIds,
		).then((ok) => {
			if (ok) runtime.persist();
		});

		runtime.persist();
		setInterval(() => runtime.persist(), HEARTBEAT_MS);
	}

	const handler = createRequestHandler({ webDir: resolveWebDir() });
	let server: http.Server | null = await tryListen(
		DEFAULT_PORT,
		handler as http.RequestListener,
	);

	setInterval(async () => {
		if (server) return;
		if (await isPortInUse(DEFAULT_PORT)) {
			if (await isOpencodeQHost(DEFAULT_PORT)) return;
			return;
		}
		server = await tryListen(DEFAULT_PORT, handler as http.RequestListener);
	}, REELECTION_MS);

	setInterval(() => {
		if (server) {
			try {
				runSweep();
			} catch {
				/* host sweep best-effort */
			}
		}
	}, SWEEP_MS);

	return runtime;
}) satisfies Plugin;
