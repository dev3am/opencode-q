const { existsSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { syncRuntime } = require("./sync-runtime.cjs");

try {
	const r = syncRuntime();
	if (r.skipped) {
		console.warn(`opencode-q: ${r.reason} — skipping plugin install`);
		process.exit(0);
	}
	console.log(`opencode-q: plugin installed to ${r.pluginDest}`);
	if (r.web) console.log(`opencode-q: web UI copied to ${r.webDest}`);

	const cmdDir = join(process.cwd(), ".opencode", "commands");
	if (existsSync(join(cmdDir, "q-add.md"))) {
		rmSync(cmdDir, { recursive: true, force: true });
		console.log(
			`opencode-q: removed legacy .opencode/commands/ in current directory`,
		);
	}
} catch (err) {
	console.warn(`opencode-q: could not install plugin: ${err.message}`);
}
