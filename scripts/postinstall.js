const { writeFileSync, existsSync, mkdirSync, symlinkSync, unlinkSync, readlinkSync } = require("node:fs")
const { join, resolve } = require("node:path")

const GLOBAL_PLUGIN_DIR = join(process.env.HOME || "~", ".config", "opencode", "plugins")
const PLUGIN_NAME = "opencode-q"
const target = resolve(__dirname, "..", "plugin.js")
const linkPath = join(GLOBAL_PLUGIN_DIR, `${PLUGIN_NAME}.js`)

try {
  if (!existsSync(GLOBAL_PLUGIN_DIR)) {
    mkdirSync(GLOBAL_PLUGIN_DIR, { recursive: true })
  }

  if (existsSync(linkPath) || existsSync(linkPath + ".ts")) {
    console.log(`opencode-q: plugin already linked at ${linkPath}`)
    process.exit(0)
  }

  const content = `export { default } from "${target.replace(/\\/g, "\\\\")}";\n`
  writeFileSync(linkPath, content, "utf-8")
  console.log(`opencode-q: plugin installed globally to ${linkPath}`)
  console.log(`opencode-q: Web UI will start at http://localhost:4321 when OpenCode runs`)
} catch (err) {
  console.warn(`opencode-q: could not auto-install plugin: ${err.message}`)
  console.warn(`opencode-q: manually add to opencode.json: { "plugin": ["opencode-q"] }`)
}
