const {
	readFileSync,
	writeFileSync,
	existsSync,
	mkdirSync,
	cpSync,
	rmSync,
} = require("node:fs");
const { join, resolve } = require("node:path");
const { homedir } = require("node:os");

const PLUGIN_NAME = "opencode-q";
const pluginsDir = join(homedir(), ".config", "opencode", "plugins");
const pluginSource = resolve(__dirname, "..", "dist", "plugin.js");
const pluginDest = join(pluginsDir, `${PLUGIN_NAME}.js`);
const webSource = resolve(__dirname, "..", "dist", "web");
const webDest = join(pluginsDir, "web");

// Copy the built plugin + web UI from dist/ into OpenCode's plugins directory,
// which is what a running OpenCode instance actually loads and serves on :4321.
// Shared by postinstall (install time) and `bun run reload` (developer loop) so
// the destination paths have a single source of truth.
// Returns { skipped: true } when dist/plugin.js is missing (build not run yet).
function syncRuntime() {
	if (!existsSync(pluginSource)) {
		return { skipped: true, reason: `${pluginSource} not found` };
	}
	if (!existsSync(pluginsDir)) mkdirSync(pluginsDir, { recursive: true });

	writeFileSync(pluginDest, readFileSync(pluginSource));

	let web = false;
	if (existsSync(webSource)) {
		if (existsSync(webDest)) rmSync(webDest, { recursive: true, force: true });
		cpSync(webSource, webDest, { recursive: true });
		web = true;
	}

	return { skipped: false, web, pluginDest, webDest };
}

module.exports = { syncRuntime, pluginsDir, pluginDest, webDest };

// Run directly (`node scripts/sync-runtime.cjs`, via `bun run reload`):
// push the current build into the runtime dir and explain what to do next.
if (require.main === module) {
	const r = syncRuntime();
	if (r.skipped) {
		console.error(`opencode-q: ${r.reason} — run \`bun run build\` first`);
		process.exit(1);
	}
	console.log(`opencode-q: synced plugin → ${r.pluginDest}`);
	if (r.web) console.log(`opencode-q: synced web UI → ${r.webDest}`);
	console.log("");
	console.log("Next:");
	console.log(
		"  • Web (UI) changes      → just refresh http://localhost:4321 in the browser",
	);
	console.log(
		"  • Plugin (server) changes → restart OpenCode to reload the plugin",
	);
}
