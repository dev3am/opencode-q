import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
	instancesDir,
	LIVENESS_TIMEOUT_MS,
	legacyProjectsDir,
} from "./constants";
import type {
	ProcessCwdResult,
	ProjectGroup,
	ProjectRecord,
	SessionInfo,
	VisibleRecordOptions,
} from "./types";

export type { ProcessCwdResult, VisibleRecordOptions };

function fileFor(instanceId: string): string {
	return join(instancesDir(), `${instanceId}.json`);
}

export interface RuntimeDiagnostics {
	pid: number;
	cwd: string;
	startedAt: string;
	version: string;
}

export function writeProjectRecord(rec: ProjectRecord): void {
	const dir = instancesDir();
	mkdirSync(dir, { recursive: true });
	const file = fileFor(rec.instanceId);
	const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
	writeFileSync(tmp, JSON.stringify(rec), "utf-8");
	renameSync(tmp, file);
}

export function touchHeartbeat(
	baseDir: string,
	sessions: SessionInfo[],
	instanceId: string,
	diagnostics?: RuntimeDiagnostics,
): void {
	writeProjectRecord({
		baseDir,
		sessions,
		heartbeat: new Date().toISOString(),
		instanceId,
		...diagnostics,
	});
}

export function readAllProjects(): ProjectRecord[] {
	const dir = instancesDir();
	if (!existsSync(dir)) return [];
	const records: ProjectRecord[] = [];
	for (const f of readdirSync(dir)) {
		if (!f.endsWith(".json")) continue;
		try {
			records.push(
				JSON.parse(readFileSync(join(dir, f), "utf-8")) as ProjectRecord,
			);
		} catch {
			/* skip corrupt */
		}
	}
	return records;
}

export function isOnline(
	rec: ProjectRecord,
	now: number = Date.now(),
): boolean {
	const t = Date.parse(rec.heartbeat);
	return Number.isFinite(t) && now - t <= LIVENESS_TIMEOUT_MS;
}

export function defaultResolveProcessCwd(pid: number): ProcessCwdResult {
	if (!Number.isInteger(pid) || pid <= 0) return { ok: false, reason: "error" };
	try {
		process.kill(pid, 0);
	} catch {
		return { ok: false, reason: "dead" };
	}
	try {
		const out = execFileSync(
			"lsof",
			["-a", "-p", String(pid), "-d", "cwd", "-Fn"],
			{
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "ignore"],
			},
		);
		const cwdLine = out
			.split("\n")
			.find((line) => line.startsWith("n") && line.length > 1);
		if (!cwdLine) return { ok: false, reason: "unavailable" };
		return { ok: true, cwd: cwdLine.slice(1) };
	} catch {
		return { ok: false, reason: "unavailable" };
	}
}

function samePath(a: string, b: string): boolean {
	return resolve(a) === resolve(b);
}

export function isVisibleRecord(
	rec: ProjectRecord,
	now: number = Date.now(),
	opts: VisibleRecordOptions = {},
): boolean {
	if (!isOnline(rec, now)) return false;
	if (!rec.pid || !rec.cwd) return false;
	const resolveProcessCwd = opts.resolveProcessCwd ?? defaultResolveProcessCwd;
	const resolved = resolveProcessCwd(rec.pid);
	if (resolved.ok) return samePath(resolved.cwd, rec.baseDir);
	if (resolved.reason !== "unavailable" || !opts.allowUnavailableFallback)
		return false;
	return samePath(rec.cwd, rec.baseDir);
}

function addSession(group: ProjectGroup, session: SessionInfo): void {
	const existing = group.sessions.find(
		(x) => x.sessionId === session.sessionId,
	);
	if (!existing) {
		group.sessions.push(session);
		return;
	}
	if (
		(Date.parse(session.updatedAt ?? "") || 0) >=
		(Date.parse(existing.updatedAt ?? "") || 0)
	) {
		group.sessions[group.sessions.indexOf(existing)] = session;
	}
}

export function groupVisibleByBaseDir(
	records: ProjectRecord[],
	now: number = Date.now(),
	opts: VisibleRecordOptions = {},
): ProjectGroup[] {
	const byDir = new Map<string, ProjectGroup>();
	for (const rec of records) {
		if (!isVisibleRecord(rec, now, opts)) continue;
		let g = byDir.get(rec.baseDir);
		if (!g) {
			g = { baseDir: rec.baseDir, online: true, sessions: [] };
			byDir.set(rec.baseDir, g);
		}
		for (const s of rec.sessions) addSession(g, s);
	}
	return [...byDir.values()];
}

export function groupByBaseDir(
	records: ProjectRecord[],
	now: number = Date.now(),
): ProjectGroup[] {
	const byDir = new Map<string, ProjectGroup>();
	for (const rec of records) {
		let g = byDir.get(rec.baseDir);
		if (!g) {
			g = { baseDir: rec.baseDir, online: false, sessions: [] };
			byDir.set(rec.baseDir, g);
		}
		if (isOnline(rec, now)) g.online = true;
		for (const s of rec.sessions) addSession(g, s);
	}
	return [...byDir.values()];
}

export function removeInstanceRecord(instanceId: string): void {
	const file = fileFor(instanceId);
	if (existsSync(file)) rmSync(file, { force: true });
}

export function markInstanceOffline(instanceId: string): void {
	const file = fileFor(instanceId);
	if (!existsSync(file)) return;
	try {
		const rec = JSON.parse(readFileSync(file, "utf-8")) as ProjectRecord;
		rec.heartbeat = new Date(0).toISOString();
		writeProjectRecord(rec);
	} catch {
		/* ignore */
	}
}

export function cleanupLegacyProjectsDir(): void {
	const dir = legacyProjectsDir();
	if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}
