# Flow: opencode-q

> Updated 2026-05-27 to reflect reliability fixes (instance-per-file registry, pendingAt, sweep failures, disposed event).

## 1. Startup

1. Plugin loads; receives `baseDir` from OpenCode.
2. If `isExcludedBaseDir(baseDir)` → skip registration (home/root dirs). Still participate in host election.
3. `discoverSessions(baseDir)` with up to 3 retries:
   - Lists existing OpenCode sessions.
   - Skips sessions with `parentID` (child/subagent sessions).
   - Registers `SessionInfo` (title, createdAt, updatedAt) into instance file.
4. Writes `instances/<instanceId>.json` to disk. Starts heartbeat timer (10s interval).
5. Tries to bind :4321:
   - **Success** → host. Starts `runSweep()` every 2s.
   - **Failure** → non-host. Polls port liveness every 5s for re-election.

## 2. Queue Flow

```
1. User types in web UI → POST /api/projects/:b/sessions/:s/items {text}
   → Host appends item {status: "queued"} to queue-<s>.json → 201

2. User clicks Send → POST /api/projects/:b/sessions/:s/items/:id/send
   → Host checks: project online? (409 if offline)
   → Host checks: session has in-flight item? (409 if yes)
   → Host sets status="pending", stamps pendingAt → 200

3. Executor (owning process, polls ~750ms):
   → Finds pending item in queue
   → Sets status="sent", stamps sentAt
   → Calls client.session.promptAsync({sessionID, text})

4. session.idle event fires in owning process:
   → Finds in-flight "sent" item for that session
   → Sets status="done", stamps completedAt

5. Web UI polls GET /api/state (~500ms when in-flight, ~2s otherwise)
   → Reflects updated status to user
```

## 3. Sweep-Based Failure (Host Only)

The host runs `runSweep()` every 2s:

- **Pending timeout:** if `Date.now() - Date.parse(pendingAt) > 20_000` → set `status="failed"`, `error="timed out"`.
- **Offline project:** if instance heartbeat expired (>30s) → `markInstanceOffline` → all `pending` and `sent` items for that project → `status="failed"`, `error="instance offline"`.
- **Stale cleanup:** offline instance file older than 5 min with no live items → deleted from `instances/`.

## 4. Offline Handling

| Scenario | Detection | Effect |
|----------|-----------|--------|
| Clean shutdown | `server.instance.disposed` event | `heartbeat` set to epoch 0 immediately; web shows gray on next poll |
| Crash / kill | Heartbeat stops updating | After 30s timeout, host sweep marks project offline |
| Empty offline project | Heartbeat age > 5 min, no live items | Instance file deleted; project disappears from web |
| Offline with live items | Heartbeat expired, items in `pending`/`sent` | Sweep sets items to `failed`; project stays visible (gray) until user resolves |

## 5. State Query (Web)

```
GET /api/state
→ Host reads all instances/<instanceId>.json files
→ Groups by baseDir (groupByBaseDir)
→ For each group: includes online=true if any instance has live heartbeat
→ For each session in group: loads queue-<sessionId>.json items
→ Returns ProjectGroup[] (includes offline projects with live items)

Polling intervals:
  - In-flight item present: ~500ms
  - No in-flight items:     ~2s
  - After user action:       immediate refetch
```

## 6. Host Re-election

```
Non-host plugin process, every 5s:
  → Check if :4321 is reachable with valid /health signature
  → If dead: attempt bind
    → Success: become host, start runSweep()
    → Failure (race): stay non-host

Host exit (clean): server.instance.disposed → markInstanceOffline → process exits
Host exit (crash): port becomes free → first non-host to detect wins re-election
Re-election is lossless: new host reads same disk state
```

## 7. Session Metadata Updates

```
session.created / session.updated events:
  → Extract title, createdAt, updatedAt from event properties
  → Update SessionInfo in instances/<instanceId>.json
  → Web sidebar shows title + relative time, sorted by recency (most recent first)
```
