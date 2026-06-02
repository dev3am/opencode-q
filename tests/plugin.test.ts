import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERSION } from "../src/constants";
import { createExecutor } from "../src/executor";
import { createPluginRuntime } from "../src/plugin";
import * as R from "../src/registry";
import * as S from "../src/storage";

let home: string, proj: string;
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "oq-plug-home-"));
	proj = mkdtempSync(join(tmpdir(), "oq-plug-proj-"));
	process.env.OPENCODE_Q_HOME = home;
});
afterEach(() => {
	delete process.env.OPENCODE_Q_HOME;
	rmSync(home, { recursive: true, force: true });
	rmSync(proj, { recursive: true, force: true });
});

function makeRuntime(prompt = async () => {}) {
	const executor = createExecutor({ baseDir: proj, prompt });
	const rt = createPluginRuntime(
		{ baseDir: proj, instanceId: "i1", executor },
		new Set(),
	);
	return { rt, executor };
}

test("a session.created event registers the session in the registry", async () => {
	const { rt } = makeRuntime();
	await rt.event({
		event: {
			type: "session.created",
			properties: {
				info: { id: "ses1", title: "t", time: { created: 1, updated: 2 } },
			},
		},
	});
	const rec = R.readAllProjects().find((r) => r.baseDir === proj)!;
	expect(rec.sessions.map((s) => s.sessionId)).toContain("ses1");
});

test("session.idle completes the in-flight sent item", async () => {
	const { rt } = makeRuntime();
	await rt.event({
		event: {
			type: "session.created",
			properties: {
				info: { id: "ses1", title: "t", time: { created: 1, updated: 2 } },
			},
		},
	});
	const item = S.addItem(proj, "ses1", "x");
	S.setStatus(proj, "ses1", item.id, "sent");
	await rt.event({
		event: { type: "session.idle", properties: { sessionID: "ses1" } },
	});
	expect(S.loadQueue(proj, "ses1").items[0].status).toBe("done");
});

test("session.error marks the in-flight item failed", async () => {
	const { rt } = makeRuntime();
	await rt.event({
		event: {
			type: "session.created",
			properties: {
				info: { id: "ses1", title: "t", time: { created: 1, updated: 2 } },
			},
		},
	});
	const item = S.addItem(proj, "ses1", "x");
	S.setStatus(proj, "ses1", item.id, "sent");
	await rt.event({
		event: {
			type: "session.error",
			properties: { sessionID: "ses1", error: { name: "ProviderError" } },
		},
	});
	expect(S.loadQueue(proj, "ses1").items[0].status).toBe("failed");
});

test("first sight of a session migrates legacy queue-default.json", async () => {
	S.addItem(proj, "default", "legacy");
	const { rt } = makeRuntime();
	await rt.event({
		event: {
			type: "session.created",
			properties: {
				info: {
					id: "ses-real",
					title: "t",
					time: { created: 1, updated: 2 },
				},
			},
		},
	});
	expect(S.loadQueue(proj, "ses-real").items.map((i) => i.text)).toEqual([
		"legacy",
	]);
});

test("an excluded baseDir (home/root) does NOT write a registry record", async () => {
	const executor = createExecutor({ baseDir: proj, prompt: async () => {} });
	const rt = createPluginRuntime(
		{
			baseDir: proj,
			instanceId: "i1",
			executor,
			registerable: false,
		},
		new Set(),
	);
	await rt.event({
		event: { type: "session.idle", properties: { sessionID: "ses1" } },
	});
	rt.persist();
	expect(R.readAllProjects()).toHaveLength(0);
});

test("a registerable runtime DOES write a record", async () => {
	const executor = createExecutor({ baseDir: proj, prompt: async () => {} });
	const rt = createPluginRuntime(
		{
			baseDir: proj,
			instanceId: "i1",
			executor,
			registerable: true,
		},
		new Set(),
	);
	await rt.event({
		event: {
			type: "session.created",
			properties: {
				info: { id: "ses1", title: "t", time: { created: 1, updated: 2 } },
			},
		},
	});
	expect(R.readAllProjects()).toHaveLength(1);
});

test("a registerable runtime writes pid cwd startedAt and version", async () => {
	const executor = createExecutor({ baseDir: proj, prompt: async () => {} });
	const rt = createPluginRuntime(
		{
			baseDir: proj,
			instanceId: "i1",
			executor,
			registerable: true,
			cwd: proj,
			pid: 4321,
			startedAt: "2026-06-02T00:00:00.000Z",
		},
		new Set(),
	);
	rt.persist();
	const rec = R.readAllProjects()[0];
	expect(rec.pid).toBe(4321);
	expect(rec.cwd).toBe(proj);
	expect(rec.startedAt).toBe("2026-06-02T00:00:00.000Z");
	expect(rec.version).toBe(VERSION);
});

test("session.updated captures title and times into the registry", async () => {
	const { rt } = makeRuntime();
	await rt.event({
		event: {
			type: "session.updated",
			properties: {
				info: {
					id: "ses1",
					title: "Fix the parser",
					parentID: undefined,
					time: { created: 1_700_000_000_000, updated: 1_700_000_500_000 },
				},
			},
		},
	});
	const s = R.readAllProjects()[0].sessions.find(
		(x) => x.sessionId === "ses1",
	)!;
	expect(s.title).toBe("Fix the parser");
	expect(s.createdAt).toBe(new Date(1_700_000_000_000).toISOString());
	expect(s.updatedAt).toBe(new Date(1_700_000_500_000).toISOString());
});

test("child sessions (with parentID) are NOT registered", async () => {
	const { rt } = makeRuntime();
	await rt.event({
		event: {
			type: "session.created",
			properties: {
				info: {
					id: "child1",
					title: "subagent",
					parentID: "ses1",
					time: { created: 1, updated: 2 },
				},
			},
		},
	});
	expect(
		R.readAllProjects().some((r) =>
			r.sessions.some((s) => s.sessionId === "child1"),
		),
	).toBe(false);
});

test("server.instance.disposed marks this instance offline immediately", async () => {
	const { rt } = makeRuntime();
	await rt.event({
		event: {
			type: "session.created",
			properties: {
				info: { id: "ses1", title: "t", time: { created: 1, updated: 2 } },
			},
		},
	});
	expect(R.isOnline(R.readAllProjects()[0])).toBe(true);
	await rt.event({
		event: {
			type: "server.instance.disposed",
			properties: { directory: proj },
		},
	});
	const rec = R.readAllProjects()[0];
	expect(R.isOnline(rec)).toBe(false);
	expect(rec.sessions.map((s) => s.sessionId)).toContain("ses1");
});

test("discoverSessions retries on failure then succeeds", async () => {
	const seen: string[] = [];
	let calls = 0;
	const client = {
		session: {
			list: async () => {
				calls++;
				if (calls < 2) throw new Error("boom");
				return {
					data: [{ id: "ses1", title: "t", time: { created: 1, updated: 2 } }],
				};
			},
			status: async () => ({ data: {} }),
		},
	};
	const { discoverSessions } = await import("../src/plugin");
	const ok = await discoverSessions(
		client as any,
		(id: string, meta: any) => seen.push(id),
		() => {},
		new Set(),
		{ attempts: 3, delayMs: 0 },
	);
	expect(ok).toBe(true);
	expect(seen).toEqual(["ses1"]);
});
