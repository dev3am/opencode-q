const { existsSync, unlinkSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { homedir } = require("node:os");

const PLUGIN_NAME = "opencode-q";
const pluginsDir = join(homedir(), ".config", "opencode", "plugins");
const dest = join(pluginsDir, `${PLUGIN_NAME}.js`);
const webDest = join(pluginsDir, "web");

try {
	if (existsSync(dest)) {
		unlinkSync(dest);
		console.log(`opencode-q: plugin removed from ${dest}`);
	}
	if (existsSync(webDest)) {
		rmSync(webDest, { recursive: true, force: true });
		console.log(`opencode-q: web UI removed from ${webDest}`);
	}
} catch (err) {
	console.warn(`opencode-q: could not remove plugin: ${err.message}`);
}
