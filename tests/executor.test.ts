import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExecutor } from "../src/executor";
import * as S from "../src/storage";

let d: string;
beforeEach(() => {
	d = mkdtempSync(join(tmpdir(), "oq-exec-"));
});
afterEach(() => {
	rmSync(d, { recursive: true, force: true });
});

test("tick dispatches a pending item when the session is idle, then onIdle marks it done", async () => {
	const sent: Array<{ sid: string; text: string }> = [];
	const exec = createExecutor({
		baseDir: d,
		prompt: async (sid, text) => {
			sent.push({ sid, text });
		},
	});
	exec.noteSession("ses1", "idle");
	const item = S.addItem(d, "ses1", "do it");
	S.setStatus(d, "ses1", item.id, "pending");

	await exec.tick();
	expect(sent).toEqual([{ sid: "ses1", text: "do it" }]);
	expect(S.loadQueue(d, "ses1").items[0].status).toBe("sent");

	exec.onIdle("ses1");
	expect(S.loadQueue(d, "ses1").items[0].status).toBe("done");
});

test("tick does not dispatch while the session is busy", async () => {
	const sent: string[] = [];
	const exec = createExecutor({
		baseDir: d,
		prompt: async (_s, t) => {
			sent.push(t);
		},
	});
	exec.noteSession("ses1", "busy");
	const item = S.addItem(d, "ses1", "x");
	S.setStatus(d, "ses1", item.id, "pending");
	await exec.tick();
	expect(sent).toEqual([]);
	expect(S.loadQueue(d, "ses1").items[0].status).toBe("pending");
});

test("tick does not dispatch a second item while one is in-flight (sent)", async () => {
	const sent: string[] = [];
	const exec = createExecutor({
		baseDir: d,
		prompt: async (_s, t) => {
			sent.push(t);
		},
	});
	exec.noteSession("ses1", "idle");
	const a = S.addItem(d, "ses1", "a");
	const b = S.addItem(d, "ses1", "b");
	S.setStatus(d, "ses1", a.id, "sent");
	S.setStatus(d, "ses1", b.id, "pending");
	await exec.tick();
	expect(sent).toEqual([]);
});

test("a prompt rejection marks the item failed", async () => {
	const exec = createExecutor({
		baseDir: d,
		prompt: async () => {
			throw new Error("connection refused");
		},
	});
	exec.noteSession("ses1", "idle");
	const item = S.addItem(d, "ses1", "x");
	S.setStatus(d, "ses1", item.id, "pending");
	await exec.tick();
	const cur = S.loadQueue(d, "ses1").items[0];
	expect(cur.status).toBe("failed");
	expect(cur.error).toContain("connection refused");
});

test("onError marks the in-flight sent item failed", () => {
	const exec = createExecutor({ baseDir: d, prompt: async () => {} });
	const item = S.addItem(d, "ses1", "x");
	S.setStatus(d, "ses1", item.id, "sent");
	exec.onError("ses1", "model exploded");
	const cur = S.loadQueue(d, "ses1").items[0];
	expect(cur.status).toBe("failed");
	expect(cur.error).toBe("model exploded");
});
