const { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } = require("node:fs")
const { join, resolve } = require("node:path")

const GLOBAL_PLUGIN_DIR = join(process.env.HOME || "~", ".config", "opencode", "plugins")
const PLUGIN_NAME = "opencode-q"
const source = resolve(__dirname, "..", "dist", "plugin.js")
const dest = join(GLOBAL_PLUGIN_DIR, `${PLUGIN_NAME}.js`)

try {
  if (!existsSync(source)) {
    console.warn(`opencode-q: ${source} not found — skipping plugin install`)
    process.exit(0)
  }

  if (!existsSync(GLOBAL_PLUGIN_DIR)) {
    mkdirSync(GLOBAL_PLUGIN_DIR, { recursive: true })
  }

  const content = readFileSync(source, "utf-8")
  writeFileSync(dest, content, "utf-8")
  console.log(`opencode-q: plugin installed to ${dest}`)
  console.log(`opencode-q: Web UI will start at http://localhost:4321 when OpenCode runs`)
} catch (err) {
  console.warn(`opencode-q: could not install plugin: ${err.message}`)
  console.warn(`opencode-q: manually add to opencode.json: { "plugin": ["opencode-q"] }`)
}
