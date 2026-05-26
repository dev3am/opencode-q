const { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, cpSync, rmSync } = require("node:fs")
const { join, resolve } = require("node:path")

const GLOBAL_PLUGIN_DIR = join(process.env.HOME || "~", ".config", "opencode", "plugins")
const PLUGIN_NAME = "opencode-q"
const source = resolve(__dirname, "..", "dist", "plugin.js")
const dest = join(GLOBAL_PLUGIN_DIR, `${PLUGIN_NAME}.js`)
const webSource = resolve(__dirname, "..", "dist", "web")
const webDest = join(GLOBAL_PLUGIN_DIR, "web")

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

  if (existsSync(webSource)) {
    if (existsSync(webDest)) {
      rmSync(webDest, { recursive: true, force: true })
    }
    cpSync(webSource, webDest, { recursive: true })
    console.log(`opencode-q: web UI copied to ${webDest}`)
  }

  console.log(`opencode-q: Web UI will start at http://localhost:4321 when OpenCode runs`)
} catch (err) {
  console.warn(`opencode-q: could not install plugin: ${err.message}`)
  console.warn(`opencode-q: manually add to opencode.json: { "plugin": ["opencode-q"] }`)
}
