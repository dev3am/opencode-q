import { expect, test } from "bun:test";
import { nextInterval } from "../web/src/hooks/usePolling";

test("nextInterval is fast when any item is in-flight, slow otherwise", () => {
	expect(nextInterval(true)).toBe(500);
	expect(nextInterval(false)).toBe(2000);
});
