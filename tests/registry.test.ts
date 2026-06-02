import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LIVENESS_TIMEOUT_MS } from "../src/constants";
import * as R from "../src/registry";

let home: string;
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "oq-reg-"));
	process.env.OPENCODE_Q_HOME = home;
});
afterEach(() => {
	delete process.env.OPENCODE_Q_HOME;
	rmSync(home, { recursive: true, force: true });
});

test("touchHeartbeat writes a per-instance file; readAllProjects round-trips", () => {
	R.touchHeartbeat("/p/a", [{ sessionId: "s1", status: "idle" }], "i1");
	const all = R.readAllProjects();
	expect(all).toHaveLength(1);
	expect(all[0].instanceId).toBe("i1");
	expect(all[0].baseDir).toBe("/p/a");
});

test("touchHeartbeat writes runtime diagnostics", () => {
	R.touchHeartbeat(
		"/p/a",
		[{ sessionId: "s1", status: "idle" }],
		"i1",
		{
			pid: 1234,
			cwd: "/p/a",
			startedAt: "2026-06-02T00:00:00.000Z",
			version: "1.1.4",
		},
	);
	const rec = R.readAllProjects()[0];
	expect(rec.pid).toBe(1234);
	expect(rec.cwd).toBe("/p/a");
	expect(rec.startedAt).toBe("2026-06-02T00:00:00.000Z");
	expect(rec.version).toBe("1.1.4");
});

test("two instances of the SAME baseDir keep distinct files (no clobber)", () => {
	R.touchHeartbeat("/p/a", [{ sessionId: "s1", status: "idle" }], "i1");
	R.touchHeartbeat("/p/a", [{ sessionId: "s2", status: "idle" }], "i2");
	expect(R.readAllProjects()).toHaveLength(2);
});

test("groupByBaseDir merges sessions and is online if any instance is fresh", () => {
	const now = Date.now();
	R.writeProjectRecord({
		baseDir: "/p/a",
		sessions: [{ sessionId: "s1", status: "idle" }],
		heartbeat: new Date(now).toISOString(),
		instanceId: "i1",
	});
	R.writeProjectRecord({
		baseDir: "/p/a",
		sessions: [{ sessionId: "s2", status: "idle" }],
		heartbeat: new Date(now - LIVENESS_TIMEOUT_MS - 5000).toISOString(),
		instanceId: "i2",
	});
	const groups = R.groupByBaseDir(R.readAllProjects(), now);
	expect(groups).toHaveLength(1);
	expect(groups[0].online).toBe(true);
	expect(groups[0].sessions.map((s) => s.sessionId).sort()).toEqual([
		"s1",
		"s2",
	]);
});

test("groupByBaseDir dedupes same sessionId keeping the latest updatedAt", () => {
	const now = Date.now();
	R.writeProjectRecord({
		baseDir: "/p/a",
		sessions: [
			{
				sessionId: "s1",
				status: "idle",
				title: "old",
				updatedAt: new Date(now - 10000).toISOString(),
			},
		],
		heartbeat: new Date(now).toISOString(),
		instanceId: "i1",
	});
	R.writeProjectRecord({
		baseDir: "/p/a",
		sessions: [
			{
				sessionId: "s1",
				status: "busy",
				title: "new",
				updatedAt: new Date(now).toISOString(),
			},
		],
		heartbeat: new Date(now).toISOString(),
		instanceId: "i2",
	});
	const g = R.groupByBaseDir(R.readAllProjects(), now)[0];
	expect(g.sessions).toHaveLength(1);
	expect(g.sessions[0].title).toBe("new");
});

test("groupVisibleByBaseDir excludes fresh records with dead pid", () => {
	const now = Date.now();
	R.writeProjectRecord({
		baseDir: "/p/a",
		sessions: [{ sessionId: "s1", status: "idle" }],
		heartbeat: new Date(now).toISOString(),
		instanceId: "i1",
		pid: 111,
		cwd: "/p/a",
		startedAt: new Date(now).toISOString(),
		version: "1.1.4",
	});
	const groups = R.groupVisibleByBaseDir(R.readAllProjects(), now, {
		resolveProcessCwd: () => ({ ok: false, reason: "dead" }),
	});
	expect(groups).toHaveLength(0);
});

test("groupVisibleByBaseDir excludes records whose live cwd differs from baseDir", () => {
	const now = Date.now();
	R.writeProjectRecord({
		baseDir: "/p/a",
		sessions: [{ sessionId: "s1", status: "idle" }],
		heartbeat: new Date(now).toISOString(),
		instanceId: "i1",
		pid: 111,
		cwd: "/p/a",
		startedAt: new Date(now).toISOString(),
		version: "1.1.4",
	});
	const groups = R.groupVisibleByBaseDir(R.readAllProjects(), now, {
		resolveProcessCwd: () => ({ ok: true, cwd: "/p/other" }),
	});
	expect(groups).toHaveLength(0);
});

test("groupVisibleByBaseDir includes only live-cwd matching records", () => {
	const now = Date.now();
	R.writeProjectRecord({
		baseDir: "/p/a",
		sessions: [{ sessionId: "s1", status: "idle" }],
		heartbeat: new Date(now).toISOString(),
		instanceId: "i1",
		pid: 111,
		cwd: "/p/a",
		startedAt: new Date(now).toISOString(),
		version: "1.1.4",
	});
	R.writeProjectRecord({
		baseDir: "/p/a",
		sessions: [{ sessionId: "old", status: "idle" }],
		heartbeat: new Date(now - LIVENESS_TIMEOUT_MS - 5000).toISOString(),
		instanceId: "old",
		pid: 222,
		cwd: "/p/a",
		startedAt: new Date(now).toISOString(),
		version: "1.1.4",
	});
	const groups = R.groupVisibleByBaseDir(R.readAllProjects(), now, {
		resolveProcessCwd: (pid) =>
			pid === 111 ? { ok: true, cwd: "/p/a" } : { ok: false, reason: "dead" },
	});
	expect(groups).toHaveLength(1);
	expect(groups[0].online).toBe(true);
	expect(groups[0].sessions.map((s) => s.sessionId)).toEqual(["s1"]);
});

test("groupVisibleByBaseDir merges duplicate valid records deterministically", () => {
	const now = Date.now();
	R.writeProjectRecord({
		baseDir: "/p/a",
		sessions: [
			{
				sessionId: "s1",
				status: "idle",
				title: "old",
				updatedAt: new Date(now - 1000).toISOString(),
			},
		],
		heartbeat: new Date(now).toISOString(),
		instanceId: "i1",
		pid: 111,
		cwd: "/p/a",
		startedAt: new Date(now).toISOString(),
		version: "1.1.4",
	});
	R.writeProjectRecord({
		baseDir: "/p/a",
		sessions: [
			{
				sessionId: "s1",
				status: "busy",
				title: "new",
				updatedAt: new Date(now).toISOString(),
			},
		],
		heartbeat: new Date(now).toISOString(),
		instanceId: "i2",
		pid: 222,
		cwd: "/p/a",
		startedAt: new Date(now).toISOString(),
		version: "1.1.4",
	});
	const groups = R.groupVisibleByBaseDir(R.readAllProjects(), now, {
		resolveProcessCwd: () => ({ ok: true, cwd: "/p/a" }),
	});
	expect(groups).toHaveLength(1);
	expect(groups[0].sessions).toHaveLength(1);
	expect(groups[0].sessions[0].title).toBe("new");
});

test("groupVisibleByBaseDir excludes diagnostics-free records by default", () => {
	const now = Date.now();
	R.writeProjectRecord({
		baseDir: "/p/a",
		sessions: [{ sessionId: "s1", status: "idle" }],
		heartbeat: new Date(now).toISOString(),
		instanceId: "legacy",
	});
	const groups = R.groupVisibleByBaseDir(R.readAllProjects(), now, {
		resolveProcessCwd: () => ({ ok: false, reason: "unavailable" }),
		allowUnavailableFallback: true,
	});
	expect(groups).toHaveLength(0);
});

test("groupVisibleByBaseDir can fallback when cwd validation is unavailable", () => {
	const now = Date.now();
	R.writeProjectRecord({
		baseDir: "/p/a",
		sessions: [{ sessionId: "s1", status: "idle" }],
		heartbeat: new Date(now).toISOString(),
		instanceId: "i1",
		pid: 111,
		cwd: "/p/a",
		startedAt: new Date(now).toISOString(),
		version: "1.1.4",
	});
	const groups = R.groupVisibleByBaseDir(R.readAllProjects(), now, {
		resolveProcessCwd: () => ({ ok: false, reason: "unavailable" }),
		allowUnavailableFallback: true,
	});
	expect(groups).toHaveLength(1);
	expect(groups[0].baseDir).toBe("/p/a");
});

test("groupVisibleByBaseDir does not fallback on dead pid", () => {
	const now = Date.now();
	R.writeProjectRecord({
		baseDir: "/p/a",
		sessions: [{ sessionId: "s1", status: "idle" }],
		heartbeat: new Date(now).toISOString(),
		instanceId: "i1",
		pid: 111,
		cwd: "/p/a",
		startedAt: new Date(now).toISOString(),
		version: "1.1.4",
	});
	const groups = R.groupVisibleByBaseDir(R.readAllProjects(), now, {
		resolveProcessCwd: () => ({ ok: false, reason: "dead" }),
		allowUnavailableFallback: true,
	});
	expect(groups).toHaveLength(0);
});

test("removeInstanceRecord deletes one instance file by id", () => {
	R.touchHeartbeat("/p/a", [], "i1");
	R.touchHeartbeat("/p/b", [], "i2");
	R.removeInstanceRecord("i1");
	const remaining = R.readAllProjects().map((r) => r.instanceId);
	expect(remaining).toHaveLength(1);
	expect(remaining).toContain("i2");
});

test("markInstanceOffline keeps the record but makes it offline immediately", () => {
	R.touchHeartbeat("/p/a", [{ sessionId: "s1", status: "idle" }], "i1");
	R.markInstanceOffline("i1");
	const rec = R.readAllProjects()[0];
	expect(rec.sessions).toHaveLength(1);
	expect(R.isOnline(rec)).toBe(false);
});

test("isOnline true for fresh, false past the timeout", () => {
	const now = Date.now();
	expect(
		R.isOnline(
			{
				baseDir: "/a",
				sessions: [],
				heartbeat: new Date(now).toISOString(),
				instanceId: "i",
			},
			now,
		),
	).toBe(true);
	expect(
		R.isOnline(
			{
				baseDir: "/a",
				sessions: [],
				heartbeat: new Date(now - LIVENESS_TIMEOUT_MS - 1000).toISOString(),
				instanceId: "i",
			},
			now,
		),
	).toBe(false);
});

test("cleanupLegacyProjectsDir removes the old projects/ directory", () => {
	const { mkdirSync, writeFileSync, existsSync } = require("node:fs");
	const legacy = join(home, "projects");
	mkdirSync(legacy, { recursive: true });
	writeFileSync(join(legacy, "deadbeef.json"), "{}");
	R.cleanupLegacyProjectsDir();
	expect(existsSync(legacy)).toBe(false);
});
