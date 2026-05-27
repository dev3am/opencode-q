import { expect, test } from "bun:test";
import { globalDir, projectsDir } from "../src/constants";

test("globalDir honors OPENCODE_Q_HOME override", () => {
	const prev = process.env.OPENCODE_Q_HOME;
	process.env.OPENCODE_Q_HOME = "/tmp/oq-home";
	expect(globalDir()).toBe("/tmp/oq-home");
	expect(projectsDir()).toBe("/tmp/oq-home/projects");
	if (prev === undefined) delete process.env.OPENCODE_Q_HOME;
	else process.env.OPENCODE_Q_HOME = prev;
});
