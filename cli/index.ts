import * as QM from "../src/queue-manager"
import * as Storage from "../src/storage"
import { listSessionIds } from "../src/storage"
import { PREVIEW_LENGTH } from "../src/constants"

const args = process.argv.slice(2)
const baseDir = process.env.OPENCODE_Q_DIR || process.cwd()

function parseSessionFlag(args: string[]): { session: string | null; rest: string[] } {
  const rest: string[] = []
  let session: string | null = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--session" || args[i] === "-s") {
      session = args[i + 1] || null
      i++
    } else {
      rest.push(args[i])
    }
  }
  return { session, rest }
}

function resolveSession(explicitSession: string | null, baseDir: string): string {
  if (explicitSession) return explicitSession
  const sessions = listSessionIds(baseDir)
  if (sessions.length === 0) return "default"
  if (sessions.length === 1) return sessions[0]
  console.error("Multiple sessions found. Specify one with --session <id>:")
  for (const s of sessions) {
    const count = QM.getAll(baseDir, s).length
    console.error(`  ${s} (${count} items)`)
  }
  process.exit(1)
}

function showHelp() {
  console.log(`opencode-q — Prompt queue manager for OpenCode

Usage:
  opencode-q add <text> [--session <id>]     Add prompt (default: auto-detect session)
  opencode-q list [--session <id>]            List queue
  opencode-q remove <id> [--session <id>]     Remove by ID
  opencode-q clear [--session <id>]           Clear queue
  opencode-q reorder <from> <to> [-s <id>]    Reorder (1-based)
  opencode-q peek [--session <id>]            Show next prompt
  opencode-q next [--session <id>]            Execute next (dequeue and print)
  opencode-q sessions                         List sessions with queues
  opencode-q help                             Show this help

Options:
  --session, -s <id>   Target session ID

Environment:
  OPENCODE_Q_DIR   Base directory (default: current working directory)`)
}

const { session: rawSession, rest: positional } = parseSessionFlag(args)
const command = positional[0]

switch (command) {
  case "add": {
    const text = positional.slice(1).join(" ")
    if (!text) {
      console.error("Error: prompt text required")
      process.exit(1)
    }
    const sessionId = resolveSession(rawSession, baseDir)
    try {
      const item = QM.add(baseDir, sessionId, text)
      console.log(`Added #${item.id} [session: ${sessionId}]`)
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`)
      process.exit(1)
    }
    break
  }

  case "list": {
    const sessionId = resolveSession(rawSession, baseDir)
    const items = QM.getAll(baseDir, sessionId)
    if (items.length === 0) {
      console.log(`Queue is empty [session: ${sessionId}]`)
      break
    }
    console.log(`Session: ${sessionId}`)
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const preview =
        item.text.length > PREVIEW_LENGTH
          ? item.text.slice(0, PREVIEW_LENGTH) + "..."
          : item.text
      console.log(`${i + 1}. [${item.id}] ${preview}`)
    }
    break
  }

  case "remove": {
    const id = positional[1]
    if (!id) {
      console.error("Error: ID required")
      process.exit(1)
    }
    const sessionId = resolveSession(rawSession, baseDir)
    const removed = QM.remove(baseDir, sessionId, id)
    if (removed) {
      console.log(`Removed (${id}) [session: ${sessionId}]`)
    } else {
      console.error(`Not found (${id}) [session: ${sessionId}]`)
      process.exit(1)
    }
    break
  }

  case "clear": {
    const sessionId = resolveSession(rawSession, baseDir)
    QM.clear(baseDir, sessionId)
    console.log(`Queue cleared [session: ${sessionId}]`)
    break
  }

  case "reorder": {
    const from = parseInt(positional[1], 10)
    const to = parseInt(positional[2], 10)
    if (isNaN(from) || isNaN(to)) {
      console.error("Error: from and to positions required (numbers)")
      process.exit(1)
    }
    const sessionId = resolveSession(rawSession, baseDir)
    try {
      const items = QM.reorder(baseDir, sessionId, from - 1, to - 1)
      console.log(`Reordered [session: ${sessionId}]:`)
      for (let i = 0; i < items.length; i++) {
        console.log(`  ${i + 1}. [${items[i].id}]`)
      }
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`)
      process.exit(1)
    }
    break
  }

  case "peek": {
    const sessionId = resolveSession(rawSession, baseDir)
    const item = QM.peek(baseDir, sessionId)
    if (!item) {
      console.log(`Queue is empty [session: ${sessionId}]`)
      break
    }
    console.log(`[${item.id}] ${item.text} [session: ${sessionId}]`)
    break
  }

  case "next": {
    const sessionId = resolveSession(rawSession, baseDir)
    const item = QM.dequeue(baseDir, sessionId)
    if (!item) {
      console.log(`Queue is empty [session: ${sessionId}]`)
      break
    }
    console.log(item.text)
    break
  }

  case "sessions": {
    const sessions = listSessionIds(baseDir)
    if (sessions.length === 0) {
      console.log("No sessions found")
      break
    }
    for (const s of sessions) {
      const count = QM.getAll(baseDir, s).length
      console.log(`  ${s} (${count} items)`)
    }
    break
  }

  case "help":
  case "--help":
  case "-h": {
    showHelp()
    break
  }

  default: {
    console.error(`Unknown command: ${command || "(none)"}`)
    showHelp()
    process.exit(1)
  }
}
