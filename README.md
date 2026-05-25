# opencode-q

<p align="center">
  <img src="https://raw.githubusercontent.com/dev3am/opencode-q/main/assets/readme_hero_pixel.png" alt="opencode-q" width="600" />
</p>

**Prompt queue plugin for OpenCode** — Queue up prompts while AI is working and execute them sequentially with manual approval.

[한국어](https://github.com/dev3am/opencode-q/blob/main/README.ko.md) | [日本語](https://github.com/dev3am/opencode-q/blob/main/README.ja.md) | [中文](https://github.com/dev3am/opencode-q/blob/main/README.zh.md)

---

## Features

- **Queue prompts** while AI is processing, without interrupting the current task
- **Reorder, remove, or clear** queued items
- **Execute** items one by one with manual control
- **Web UI** at `http://localhost:4321` for visual queue management
- **CLI** tool that works independently of AI state
- **Real-time updates** via SSE (Web UI reflects changes instantly)
- **Session isolation** — each conversation has its own independent queue

## Installation

### Prerequisites

- [Bun](https://bun.sh) 1.x
- OpenCode 1.x

### npm (once published)

```bash
npm install opencode-q
```

Add to your `opencode.json`:

```json
{
  "plugin": ["opencode-q"]
}
```

## Usage

### Slash commands (TUI)

| Command | Description |
|---------|-------------|
| `/q-add <text>` | Add a prompt to the queue |
| `/q-list` | List all queued prompts |
| `/q-remove <id>` | Remove a specific item |
| `/q-clear` | Clear the entire queue |
| `/q-reorder <from> <to>` | Reorder items (1-based positions) |
| `/q-next` | Pull the next item into the TUI prompt input |

> Note: Slash commands go through the AI — if the AI is busy, there will be a delay.

### CLI

```bash
# Add a prompt
opencode-q add "your prompt here"

# List queue
opencode-q list

# Remove item
opencode-q remove <id>

# Clear queue
opencode-q clear

# Reorder
opencode-q reorder <from> <to>
```

> The CLI works independently of AI state — it reads/writes queue data directly.

### Web UI

Open `http://localhost:4321` in your browser. The Web UI provides:

- Visual list of queued prompts with drag-and-drop reordering
- Execute buttons to send prompts to the AI
- Real-time status indicator (idle/busy/error)
- Retry and skip controls for failed items

The Web UI starts automatically when the plugin loads.

## Configuration

**opencode.json:**

```json
{
  "plugin": ["./dist/plugin.js"],
  "settings": {
    "opencode-q": {
      "port": 4321
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `port` | `4321` | HTTP server port for the Web UI |

## Architecture

For development setup and detailed architecture, see [CONTRIBUTING.md](https://github.com/dev3am/opencode-q/blob/main/CONTRIBUTING.md).

## License

MIT
