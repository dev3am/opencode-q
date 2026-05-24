# Contributing to opencode-q

## Prerequisites

- [Bun](https://bun.sh) 1.x
- OpenCode 1.x

## Setup

```bash
git clone <repo-url>
cd opencode-q
bun install
bun run build
```

Add to your `opencode.json`:

```json
{
  "plugin": ["./dist/plugin.js"]
}
```

## Architecture

```
User → Plugin (tools/events)
         ├── SDK (client.session) → OpenCode server (execute prompts)
         └── HTTP server (:4321) → Web UI (queue management + SSE)
```

- **Plugin**: Loaded by OpenCode, provides tool hooks (`/q-add`, etc.) and event hooks (`session.status`, `session.idle`)
- **Queue Manager**: In-memory + JSON file persistence per session
- **HTTP Server**: Built with Bun's built-in HTTP server, serves the Web UI (React + Vite) and REST API
- **SSE**: Real-time broadcasts for queue updates and session status changes

## Commands

```bash
# Install dependencies
bun install

# Build all (plugin + CLI + web)
bun run build

# Run tests
bun test

# Dev mode (build only)
bun run dev
```

## Project Structure

```
src/
  plugin.ts        Plugin entry point (event hooks + custom tools + HTTP server)
  server.ts        REST API + SSE + static file server
  queue-manager.ts Queue business logic (session-aware)
  storage.ts       Per-session JSON file I/O
  types.ts         QueueItem, QueueData, SessionStatus, FailedItem
  constants.ts     Config values (SCHEMA_VERSION, DEFAULT_PORT, etc.)
cli/index.ts       Standalone CLI tool
web/               React Web UI (Vite + @dnd-kit)
tests/             bun:test (50 cases, temp dir isolation)
.opencode/commands/  Slash command definitions
```

## Key Patterns

- **Session isolation**: All queue operations take `sessionId`. Files: `.opencode/queue-{sessionId}.json`
- **SSE broadcast**: `queue-updated` on queue changes, `session-status` on state changes
- **Failure recovery**: `reinsertAtFront()` on SDK failure, max 3 retries
- **V1 migration**: `migrateV1()` runs automatically on plugin load

## License

MIT
