const { existsSync, unlinkSync, rmSync } = require("node:fs")
const { join } = require("node:path")

const GLOBAL_PLUGIN_DIR = join(process.env.HOME || "~", ".config", "opencode", "plugins")
const PLUGIN_NAME = "opencode-q"
const dest = join(GLOBAL_PLUGIN_DIR, `${PLUGIN_NAME}.js`)
const webDest = join(GLOBAL_PLUGIN_DIR, "web")

try {
  if (existsSync(dest)) {
    unlinkSync(dest)
    console.log(`opencode-q: plugin removed from ${dest}`)
  }
  if (existsSync(webDest)) {
    rmSync(webDest, { recursive: true, force: true })
    console.log(`opencode-q: web UI removed from ${webDest}`)
  }
} catch (err) {
  console.warn(`opencode-q: could not remove plugin: ${err.message}`)
}
