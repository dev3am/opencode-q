# opencode-q

<p align="center">
  <img src="https://raw.githubusercontent.com/dev3am/opencode-q/main/assets/readme_hero_pixel.png" alt="opencode-q" width="600" />
</p>

**Prompt queue plugin for OpenCode** — run OpenCode, open `http://localhost:4321`, and manage a per-session prompt queue like a todo list: stage prompts ahead of time and send them to the AI one at a time, with live status tracking.

[한국어](https://github.com/dev3am/opencode-q/blob/main/README.ko.md) | [日本語](https://github.com/dev3am/opencode-q/blob/main/README.ja.md) | [中文](https://github.com/dev3am/opencode-q/blob/main/README.zh.md)

---

## What it does

opencode-q is a **web-only** OpenCode plugin. There is no CLI and there are no TUI commands — you drive everything from one web UI.

- **One web UI for every project** at `http://localhost:4321` — all running OpenCode instances show up in one place.
- **Per-project, per-session queues** — each conversation (session) has its own independent queue.
- **Todo-style status tracking** — every item moves through `queued → pending → sent → done` (or `failed`).
- **Manual, one at a time** — you send a queued prompt explicitly; the next one is sent only after the previous finishes. You stay in control.
- **Reorder, edit, delete** queued items; **resend** failed ones.
- **Robust by design** — all state lives on disk, so the system keeps working even as OpenCode windows open and close.

## Installation

### Prerequisites

- [OpenCode](https://opencode.ai) 1.x (it runs on [Bun](https://bun.sh), which the plugin uses too)

### npm

```bash
npm install -g opencode-q
```

The plugin auto-installs to `~/.config/opencode/plugins/` via a postinstall step. Restart OpenCode and it works.

> **Note:** Global install (`-g`) is required because the plugin registers globally at `~/.config/opencode/plugins/`. Per-project install is not supported.

## Usage

1. Start OpenCode in any project (start it in several projects if you like).
2. Open **`http://localhost:4321`** in your browser.
3. In the sidebar, pick a project; pick a session tab; then:
   - **Add** a prompt — it appears as `queued`.
   - **Send** a queued prompt — it goes to `pending`, then `sent` while the AI works, then `done` when the AI finishes. Send is disabled while an item is in flight, so prompts never overlap.
   - **Reorder** (drag), **edit**, or **delete** queued items.
   - If an item ends up `failed`, click **resend**.

Projects whose OpenCode instance is no longer running are shown as **offline** (greyed out); their queues are preserved for when you restart.

## Web UI at a glance

| Element | Purpose |
|---------|---------|
| Sidebar | All running projects (offline ones greyed) |
| Session tabs | Switch between a project's sessions |
| Status badge | `queued` / `pending` / `sent` / `done` / `failed` per item |
| Send / Resend | Dispatch a queued item, or retry a failed one (one at a time per session) |

The web server starts automatically when the plugin loads. It always listens on port `4321`.

## Troubleshooting

- Make sure at least one OpenCode instance is running — the web UI is served by the plugin, so `http://localhost:4321` is only available while OpenCode is open.
- If the page does not load, confirm nothing else on your machine is already using port `4321`.
- Found a bug? Please open a [GitHub Issue](https://github.com/dev3am/opencode-q/issues) with steps to reproduce — it helps a lot.

## Architecture

opencode-q uses **disk as the single source of truth**. Each OpenCode instance loads the plugin; whichever instance grabs port `4321` serves the (stateless) web UI, and every instance executes the queued prompts for its own sessions. There are no cross-process network callbacks, so any instance can come and go without breaking the others.

For development setup and details, see [CONTRIBUTING.md](https://github.com/dev3am/opencode-q/blob/main/CONTRIBUTING.md).

## License

MIT
