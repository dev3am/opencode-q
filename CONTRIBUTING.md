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

### Developer mode (you installed via `npm i -g opencode-q`)

A running OpenCode loads the plugin from `~/.config/opencode/plugins/`
(`opencode-q.js` + `web/`), **not** from this repo's `dist/`. So editing the
source and rebuilding is not enough — your build has to land in that runtime
directory (or you preview it elsewhere). Two dev loops; pick whichever fits
what you're changing (it's a convenience choice):

**Option 1 — `bun run reload`** (covers everything, verifies the real artifact)

```bash
bun run reload   # build (plugin + web), then sync dist/ → ~/.config/opencode/plugins/
```

- After the sync, depending on what you changed:
  - **Web (UI) changes** → just refresh `http://localhost:4321` in the browser
    (the web host reads files from disk per request, so no restart is needed).
  - **Plugin (server) changes** → restart OpenCode to reload `opencode-q.js`
    (the plugin API has no teardown/reload hook, so this step is manual).
- It does **not** watch files and is **not** a one-time setup — re-run it after
  *every* change you want to see:
  `edit → bun run reload → refresh :4321 (web) / restart OpenCode (server) → repeat`.

**Option 2 — Vite dev server** (fast hot-reload, **frontend only**)

```bash
cd web && bunx vite   # http://localhost:5173, proxies /api → :4321
```

- Edit `web/src` and the browser updates automatically — no per-change command.
- Best for tight UI iteration. Caveats: it serves on `:5173` (not `:4321`) and
  is **not** the production bundle, and it does **not** cover plugin/server
  changes — those still need Option 1 (`bun run reload` + restart).
- Recommended even if you use this: do a final `bun run reload` check on
  `:4321` against the real built artifact before opening a PR.

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
bun run lint     # biome check (src, web/src, scripts)
bun run dev      # build only
bun run reload   # build + sync into ~/.config/opencode/plugins (see Developer mode)
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
