# Data Schema: opencode-q

> Updated 2026-05-27 to reflect reliability fixes (instance-per-file registry, pendingAt, sweep-based failure).

## 1. Registry Storage

**Global registry directory:**
```
~/.config/opencode/opencode-q/     (or $OPENCODE_Q_HOME)
  instances/<instanceId>.json       — one file per live plugin instance
```

**Per-session queue files (project-local):**
```
<projectDir>/.opencode/queue-<sessionId>.json
```

**Legacy path (deleted on first sweep):**
```
~/.config/opencode/opencode-q/projects/<sha1(baseDir)>.json
```
Legacy files are cleaned up by `cleanupLegacyProjectsDir()` on startup.

## 2. Data Types

```typescript
// Registry — one file per plugin instance
interface ProjectRecord {
  baseDir: string
  sessions: SessionInfo[]
  heartbeat: string   // ISO 8601; set to epoch 0 on clean dispose
  instanceId: string
}

// Aggregated by web server from all instance files
interface ProjectGroup {
  baseDir: string
  online: boolean     // true if any instance for this baseDir is live
  sessions: SessionInfo[]
}

interface SessionInfo {
  sessionId: string
  status: string
  title?: string
  createdAt?: string
  updatedAt?: string
}

// Per-session queue file
interface QueueItem {
  id: string          // 8-char hex
  text: string
  createdAt: string   // ISO 8601
  status: ItemStatus
  pendingAt?: string  // stamped when host marks pending
  sentAt?: string
  completedAt?: string
  error?: string      // present when status === "failed"
}

type ItemStatus = "queued" | "pending" | "sent" | "done" | "failed"

interface QueueData {
  items: QueueItem[]
  updatedAt: string
}
```

## 3. Status Transitions

| From | To | Trigger |
|------|----|---------|
| `queued` | `pending` | Host receives POST .../send; stamps `pendingAt` |
| `pending` | `sent` | Executor calls OpenCode `promptAsync`; stamps `sentAt` |
| `sent` | `done` | `session.idle` event received by owning process; stamps `completedAt` |
| `pending` | `failed` | Host sweep: `pendingAt` age > 20s, OR project goes offline |
| `sent` | `failed` | Host sweep: project goes offline |

**Invariant:** at most one non-terminal (`pending` | `sent`) item per session at a time.

All writes are atomic (tmp file + rename).

## 4. Liveness

| Parameter | Value |
|-----------|-------|
| Heartbeat write interval | 10s |
| Liveness timeout | 30s |
| Clean dispose signal | `server.instance.disposed` event → heartbeat set to epoch 0 immediately |
| Stale cleanup threshold | heartbeat age > 5 min AND no live items |

- **Online:** `Date.now() - Date.parse(heartbeat) < 30_000`
- **Disposed (clean):** heartbeat === `"1970-01-01T00:00:00.000Z"` (epoch 0)
- **Stale offline instance file:** removed after 5 min with no live items
