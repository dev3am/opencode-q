# Compound Knowledge

> Lessons from past execution-review cycles. Read before starting new work.

## 2026-05-26 — Multi-Project Support

### [Bug] CLI endpoint must exist on server
**Context:** CLI `sessions` command calls `GET /api/projects/:baseDir`
**Mistake:** Only `DELETE` handler existed for that route pattern — CLI always got 404
**Fix:** Added `GET` method handler alongside `DELETE` in the same route match block
**Rule:** Every CLI command's HTTP path must have a corresponding server route. Verify each CLI command works end-to-end.

### [Pattern] Repeated decode+lookup is a code smell
**Context:** Multi-project server has many routes that decode baseDir from URL and look up the project
**Mistake:** 8 identical 6-line blocks of `decodeURIComponent` + `getProjectState` + 404 check
**Fix:** Extracted `requireProject(encodedBaseDir)` helper returning `{ baseDir, project } | null`
**Rule:** When the same 3+ line decode+validate+error pattern appears 3+ times, extract it immediately.

### [Pattern] Repeated session ID mapping in plugin tools
**Context:** Every plugin tool execute function needs to map the session ID from context
**Mistake:** 6 identical 3-line `if (ctx?.sessionID) { setSessionIdMapping(...) }` blocks
**Fix:** Extracted `mapSession(ctx)` one-liner
**Rule:** When the same boilerplate appears in every callback, extract before writing the third instance.

### [Architecture] SSE events for cross-component sync
**Context:** Web UI sidebar project list becomes stale when projects are registered/unregistered
**Mistake:** Only fetched projects on initial mount — no mechanism to stay in sync
**Fix:** Added `projects-updated` SSE event listener that triggers `refreshProjects()` with auto-deselection of vanished projects
**Rule:** Any state that can change server-side needs an SSE event + listener. Don't rely solely on initial fetch.

### [Bug] Unused imports creep in during refactoring
**Context:** Server was importing `PREVIEW_LENGTH` but only plugin.ts uses it
**Mistake:** Import carried over from when server had preview logic — never cleaned up
**Fix:** Removed unused import
**Rule:** After extracting modules, grep for unused imports. Or run a linter.
