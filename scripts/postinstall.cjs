const { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync } = require("node:fs")
const { join, resolve } = require("node:path")
const { homedir } = require("node:os")

const PLUGIN_NAME = "opencode-q"
const configDir = join(homedir(), ".config", "opencode")
const pluginsDir = join(configDir, "plugins")
const source = resolve(__dirname, "..", "dist", "plugin.js")
const dest = join(pluginsDir, `${PLUGIN_NAME}.js`)
const webSource = resolve(__dirname, "..", "dist", "web")
const webDest = join(pluginsDir, "web")

try {
  if (!existsSync(source)) {
    console.warn(`opencode-q: ${source} not found — skipping plugin install`)
    process.exit(0)
  }

  if (!existsSync(pluginsDir)) mkdirSync(pluginsDir, { recursive: true })

  writeFileSync(dest, readFileSync(source, "utf-8"), "utf-8")
  console.log(`opencode-q: plugin installed to ${dest}`)

  if (existsSync(webSource)) {
    if (existsSync(webDest)) rmSync(webDest, { recursive: true, force: true })
    cpSync(webSource, webDest, { recursive: true })
    console.log(`opencode-q: web UI copied to ${webDest}`)
  }

  const cmdDir = join(process.cwd(), ".opencode", "commands")
  if (existsSync(join(cmdDir, "q-add.md"))) {
    rmSync(cmdDir, { recursive: true, force: true })
    console.log(`opencode-q: removed legacy .opencode/commands/ in current directory`)
  }
} catch (err) {
  console.warn(`opencode-q: could not install plugin: ${err.message}`)
}
