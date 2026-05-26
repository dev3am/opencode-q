# Contributing to opencode-q

## Prerequisites

- [Bun](https://bun.sh) 1.x
- [OpenCode](https://opencode.ai) 1.x

## Setup

```bash
git clone <repo-url>
cd opencode-q
bun install
bun run build
```

For local development, point your `opencode.json` at the built plugin:

```json
{
  "plugin": ["./dist/plugin.js"]
}
```

Then start OpenCode and open `http://localhost:4321`.

## Architecture (web-only, disk-as-truth)

opencode-q is a **web-only** plugin. There is no CLI and no TUI command surface. State lives entirely on disk; the `:4321` web host is stateless.

```
Browser ──HTTP/poll──▶ Web host (:4321) ──read/write──▶  DISK  ◀──poll── Session owner process
   (web UI)            (stateless, any process)            ▲                │ client.session.prompt()
                                                           └────────────────┘ session.idle / session.error
```

- **Web host** — whichever process binds `:4321`; serves the web UI + REST over disk. Holds no authoritative state, so it can be replaced (re-election) at any time.
- **Session owner** — every process executes the queued prompts for its own sessions: it polls disk for `pending` items, dispatches via the SDK, and resolves `done`/`failed` from session events.
- **Disk** — the single source of truth: per-project registry files with heartbeats, plus per-session queue files with item statuses. No cross-process HTTP callbacks.

## Commands

```bash
bun install      # install dependencies
bun run build    # build all (plugin + web)
bun test         # run tests
bun run dev      # build only
```

## Project Structure

```
src/
  constants.ts   paths, port, intervals; globalDir()/projectsDir() (OPENCODE_Q_HOME override)
  types.ts       ItemStatus, QueueItem, QueueData, SessionInfo, ProjectRecord
  storage.ts     atomic per-session queue I/O, item ops, status transitions, legacy migration
  registry.ts    per-project record file + heartbeat read/write, liveness (isOnline)
  executor.ts    per-process: track sessions, poll pending, dispatch, onIdle/onError
  server.ts      stateless web host: REST over disk + static + /health; listen helpers
  plugin.ts      entry: host election + re-election, heartbeat, event wiring; createPluginRuntime
web/             React Web UI (Vite + @dnd-kit): sidebar / session tabs / status badges / send-resend
scripts/         postinstall.cjs (copy plugin.js + web), preuninstall.cjs
tests/           bun:test, mkdtemp + OPENCODE_Q_HOME isolation
```

## Key Patterns

- **Disk source of truth**: `<project>/.opencode/queue-<realSessionId>.json` (queues), `~/.config/opencode/opencode-q/projects/<sha1(baseDir)>.json` (registry, one writer per file). All writes atomic (tmp+rename).
- **Item lifecycle**: `queued → pending → sent → done | failed`. Manual, one in-flight item per session (server returns 409 otherwise).
- **Host election**: bind `:4321` or, if taken, verify via `/health` signature; non-hosts re-check and take over a dead port (lossless, since host is stateless).
- **Liveness**: heartbeat (~10s) + `/health` polling; offline past ~30s. The OpenCode plugin API has no teardown hook, so liveness is polling-only.
- **Real-time**: no SSE — the web uses adaptive polling (~500ms in-flight / ~2s idle) and refetches immediately after user actions.

## Design docs

Detailed design lives in `docs/` (local-only, gitignored): the authoritative spec is
`docs/superpowers/specs/2026-05-26-web-only-disk-truth-redesign-design.md` and the implementation plan is
`docs/superpowers/plans/2026-05-26-web-only-disk-truth-redesign.md`.

## License

MIT
