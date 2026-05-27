import { expect, test } from "bun:test";
import {
	formatRelativeTime,
	sortSessionsByRecent,
} from "../web/src/lib/sessions";

test("sortSessionsByRecent orders by updatedAt desc, undefined last", () => {
	const a = {
		sessionId: "a",
		status: "idle",
		updatedAt: "2026-05-26T10:00:00.000Z",
	};
	const b = {
		sessionId: "b",
		status: "idle",
		updatedAt: "2026-05-26T12:00:00.000Z",
	};
	const c = { sessionId: "c", status: "idle" };
	expect(
		sortSessionsByRecent([a, b, c] as any).map((s) => s.sessionId),
	).toEqual(["b", "a", "c"]);
});

test("formatRelativeTime returns a non-empty label for a past time", () => {
	const now = Date.parse("2026-05-26T12:05:00.000Z");
	const out = formatRelativeTime("2026-05-26T12:00:00.000Z", "en", now);
	expect(typeof out).toBe("string");
	expect(out.length).toBeGreaterThan(0);
});

test("formatRelativeTime returns empty string for missing input", () => {
	expect(formatRelativeTime(undefined, "en", Date.now())).toBe("");
});
