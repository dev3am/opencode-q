import { expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PENDING_TIMEOUT_MS } from "../src/constants";
import * as S from "../src/storage";

function tmp(): string {
	return mkdtempSync(join(tmpdir(), "oq-store-"));
}

test("addItem creates a queued item and persists atomically", () => {
	const d = tmp();
	try {
		const item = S.addItem(d, "ses1", "hello");
		expect(item.status).toBe("queued");
		expect(S.loadQueue(d, "ses1").items.map((i) => i.text)).toEqual(["hello"]);
		expect(
			readdirSync(join(d, ".opencode")).some((f) => f.endsWith(".tmp")),
		).toBe(false);
	} finally {
		rmSync(d, { recursive: true, force: true });
	}
});

test("loadQueue defaults a missing status to queued and survives corrupt json", () => {
	const d = tmp();
	try {
		mkdirSync(join(d, ".opencode"), { recursive: true });
		writeFileSync(
			join(d, ".opencode", "queue-ses1.json"),
			JSON.stringify({
				items: [{ id: "x", text: "t", createdAt: "2026-01-01T00:00:00.000Z" }],
				updatedAt: "2026-01-01T00:00:00.000Z",
			}),
		);
		expect(S.loadQueue(d, "ses1").items[0].status).toBe("queued");
		writeFileSync(join(d, ".opencode", "queue-bad.json"), "{ not json");
		expect(S.loadQueue(d, "bad").items).toEqual([]);
		expect(existsSync(join(d, ".opencode", "queue-bad.json.bak"))).toBe(true);
	} finally {
		rmSync(d, { recursive: true, force: true });
	}
});

test("setStatus transitions and records timestamps/error", () => {
	const d = tmp();
	try {
		const item = S.addItem(d, "ses1", "go");
		S.setStatus(d, "ses1", item.id, "sent", {
			sentAt: "2026-01-01T00:00:01.000Z",
		});
		let cur = S.loadQueue(d, "ses1").items[0];
		expect(cur.status).toBe("sent");
		expect(cur.sentAt).toBe("2026-01-01T00:00:01.000Z");
		S.setStatus(d, "ses1", item.id, "failed", { error: "boom" });
		cur = S.loadQueue(d, "ses1").items[0];
		expect(cur.status).toBe("failed");
		expect(cur.error).toBe("boom");
	} finally {
		rmSync(d, { recursive: true, force: true });
	}
});

test("inFlightItem returns the pending or sent item, else undefined", () => {
	const d = tmp();
	try {
		expect(S.inFlightItem(d, "ses1")).toBeUndefined();
		const a = S.addItem(d, "ses1", "a");
		S.addItem(d, "ses1", "b");
		expect(S.inFlightItem(d, "ses1")).toBeUndefined();
		S.setStatus(d, "ses1", a.id, "pending");
		expect(S.inFlightItem(d, "ses1")!.id).toBe(a.id);
	} finally {
		rmSync(d, { recursive: true, force: true });
	}
});

test("firstPending returns the earliest pending item", () => {
	const d = tmp();
	try {
		const a = S.addItem(d, "ses1", "a");
		const b = S.addItem(d, "ses1", "b");
		S.setStatus(d, "ses1", b.id, "pending");
		expect(S.firstPending(d, "ses1")!.id).toBe(b.id);
		expect(a).toBeDefined();
	} finally {
		rmSync(d, { recursive: true, force: true });
	}
});

test("reorderItems moves by 0-based index", () => {
	const d = tmp();
	try {
		S.addItem(d, "ses1", "a");
		S.addItem(d, "ses1", "b");
		S.addItem(d, "ses1", "c");
		const items = S.reorderItems(d, "ses1", 2, 0);
		expect(items.map((i) => i.text)).toEqual(["c", "a", "b"]);
	} finally {
		rmSync(d, { recursive: true, force: true });
	}
});

test("migrateLegacyDefault moves queue-default.json to the real session once", () => {
	const d = tmp();
	try {
		mkdirSync(join(d, ".opencode"), { recursive: true });
		writeFileSync(
			join(d, ".opencode", "queue-default.json"),
			JSON.stringify({
				items: [
					{ id: "old", text: "legacy", createdAt: "2026-01-01T00:00:00.000Z" },
				],
				updatedAt: "2026-01-01T00:00:00.000Z",
			}),
		);
		expect(S.migrateLegacyDefault(d, "real-1")).toBe(true);
		expect(S.loadQueue(d, "real-1").items[0].text).toBe("legacy");
		expect(S.loadQueue(d, "real-1").items[0].status).toBe("queued");
		expect(existsSync(join(d, ".opencode", "queue-default.json"))).toBe(false);
		expect(S.migrateLegacyDefault(d, "real-1")).toBe(false);
	} finally {
		rmSync(d, { recursive: true, force: true });
	}
});

// --- Task 3: New tests for pendingAt stamping and timeout/offline helpers ---

test("sendItem stamps pendingAt", () => {
	const d = tmp();
	try {
		const item = S.addItem(d, "ses1", "a");
		const sent = S.sendItem(d, "ses1", item.id)!;
		expect(sent.status).toBe("pending");
		expect(typeof sent.pendingAt).toBe("string");
	} finally {
		rmSync(d, { recursive: true, force: true });
	}
});

test("failTimedOutPending fails only pending items older than the timeout", () => {
	const d = tmp();
	try {
		const now = Date.now();
		const a = S.addItem(d, "ses1", "old");
		S.sendItem(d, "ses1", a.id);
		// manipulate pendingAt to be in the past
		const data = S.loadQueue(d, "ses1");
		data.items[0].pendingAt = new Date(
			now - PENDING_TIMEOUT_MS - 1000,
		).toISOString();
		S.saveQueue(d, "ses1", data);
		const changed = S.failTimedOutPending(d, "ses1", PENDING_TIMEOUT_MS, now);
		expect(changed).toBe(true);
		expect(S.loadQueue(d, "ses1").items[0].status).toBe("failed");
	} finally {
		rmSync(d, { recursive: true, force: true });
	}
});

test("failTimedOutPending leaves fresh pending alone", () => {
	const d = tmp();
	try {
		const a = S.addItem(d, "ses1", "fresh");
		S.sendItem(d, "ses1", a.id);
		const changed = S.failTimedOutPending(
			d,
			"ses1",
			PENDING_TIMEOUT_MS,
			Date.now(),
		);
		expect(changed).toBe(false);
		expect(S.loadQueue(d, "ses1").items[0].status).toBe("pending");
	} finally {
		rmSync(d, { recursive: true, force: true });
	}
});

test("failAllInFlight fails both pending and sent items", () => {
	const d = tmp();
	try {
		const a = S.addItem(d, "ses1", "a");
		S.setStatus(d, "ses1", a.id, "sent", { sentAt: new Date().toISOString() });
		const changed = S.failAllInFlight(d, "ses1", "offline");
		expect(changed).toBe(true);
		expect(S.loadQueue(d, "ses1").items[0].status).toBe("failed");
		expect(S.loadQueue(d, "ses1").items[0].error).toBe("offline");
	} finally {
		rmSync(d, { recursive: true, force: true });
	}
});

test("hasLiveItems true when queued/pending/sent/failed present, false for done/empty", () => {
	const d = tmp();
	try {
		expect(S.hasLiveItems(d, "ses1")).toBe(false);
		const a = S.addItem(d, "ses1", "a");
		expect(S.hasLiveItems(d, "ses1")).toBe(true);
		S.setStatus(d, "ses1", a.id, "done", {
			completedAt: new Date().toISOString(),
		});
		expect(S.hasLiveItems(d, "ses1")).toBe(false);
	} finally {
		rmSync(d, { recursive: true, force: true });
	}
});
