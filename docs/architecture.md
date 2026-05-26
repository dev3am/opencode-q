# Architecture: opencode-q

> Updated 2026-05-27 to reflect reliability fixes (instance-per-file registry, pendingAt sweep, session metadata, web helpers).

## 1. Components

### Core modules (`src/`)

| Module | Responsibility |
|--------|----------------|
| `constants.ts` | Paths, timeouts, port, helpers. Exports `instancesDir()`, `legacyProjectsDir()`, `isExcludedBaseDir()`. `OPENCODE_Q_HOME` overrides the global dir. |
| `types.ts` | `ItemStatus`, `QueueItem`, `QueueData`, `SessionInfo`, `ProjectRecord`, `ProjectGroup` |
| `registry.ts` | Per-instance file I/O (`writeInstance`, `readAllInstances`), `groupByBaseDir` aggregation, `markInstanceOffline` (sets heartbeat to epoch 0), `cleanupLegacyProjectsDir` |
| `storage.ts` | Per-session queue atomic I/O, item ops (`addItem`, `updateItemStatus`, `failPendingItems`), `isLiveStatus` helper |
| `server.ts` | HTTP handler: REST API + static web + `/health`. `buildState` reads all instance files and groups by `baseDir` (includes both online and offline projects with live items). `runSweep` marks timed-out pending items failed and cleans stale offline instances. Host-only. |
| `executor.ts` | Queue execution: tracks active sessions, picks up `pending` items, calls OpenCode `promptAsync`, handles `session.idle` → `done` |
| `plugin.ts` | OpenCode plugin entry point. `createPluginRuntime` (used in tests). Handles host election (bind :4321), re-election every 5s, heartbeat timer (10s), `discoverSessions` on startup, event routing to executor. |

### Web (`web/src/`)

| Module | Responsibility |
|--------|----------------|
| `api/client.ts` | HTTP client for the :4321 server (typed wrappers around fetch) |
| `lib/sessions.ts` | Pure helpers: `sortSessionsByRecent`, `formatRelativeTime` |
| `components/ProjectSidebar.tsx` | Session list with title, relative timestamp, sorted by recency |
| `App.tsx` | Root component; shows toast on send failure |

## 2. Architecture Overview (Approach C — disk as single source of truth)

```
Browser ──HTTP/poll──▶ Web host (:4321) ──read/write──▶  DISK  ◀──write── Session owner process
  (web UI)             (stateless server)                  ▲                │ promptAsync()
                                                           └────────────────┘ session.idle event
```

Three roles cooperate **only through disk**:

1. **Web host** — the process that bound :4321. Stateless: reads disk and serves web UI + REST. Replaceable at any time.
2. **Session owner process** — the plugin instance that owns a session (holds the SDK client). Polls disk for `pending` items and sends them via `promptAsync`.
3. **Disk** — persistent truth: `instances/<instanceId>.json` (heartbeat + session list) and `<project>/.opencode/queue-<sessionId>.json` (item states).

No HTTP callbacks between processes. Typically one process is both host and owner.

## 3. Host Election

- On load: try to bind :4321.
  - **Success** → become host, start `runSweep()` every 2s.
  - **Failure** → check `/health` signature to verify it's an opencode-q host.
- **Re-election:** non-host checks port liveness every 5s. If port is free, re-attempt bind.
- Host is stateless → re-election is lossless (same disk, same data).
- External port occupant: warning logged, no port hopping.

## 4. Registration & Session Discovery

- **Excluded base dirs:** home directory and filesystem root are skipped (`isExcludedBaseDir`). Plugin still participates in host election for excluded dirs.
- **Child/subagent filtering:** sessions with a `parentID` are not registered.
- **`discoverSessions`:** called on startup with up to 3 retries. Finds existing sessions, registers `SessionInfo` with `title`, `createdAt`, `updatedAt`.
- **Live events:** `session.created` / `session.updated` keep `SessionInfo` current.

## 5. Liveness

| Event | Effect |
|-------|--------|
| Plugin loads | Writes `instances/<instanceId>.json` with current heartbeat |
| Heartbeat timer (10s) | Updates `heartbeat` in instance file |
| `server.instance.disposed` | Sets `heartbeat` to epoch 0 immediately (clean shutdown signal) |
| Heartbeat timeout (30s) | Backstop for crashes / unclean exits |
| Host sweep | Removes stale offline instance files (>5 min old, no live items) |

## 6. Testing

`bun:test`. Tests use `mkdtemp` + `OPENCODE_Q_HOME` for isolation.
Layers: storage → registry → executor → server → plugin → web (pure functions).
Web components: build + manual verification.
