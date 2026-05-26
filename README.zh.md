# opencode-q

**OpenCode 的提示队列插件** — 运行 OpenCode，打开 `http://localhost:4321`，像管理待办清单一样管理每个会话的提示队列：提前暂存提示，逐个发送给 AI，并实时追踪状态。

[English](https://github.com/dev3am/opencode-q/blob/main/README.md) | [한국어](https://github.com/dev3am/opencode-q/blob/main/README.ko.md) | [日本語](https://github.com/dev3am/opencode-q/blob/main/README.ja.md)

---

## 它能做什么

opencode-q 是一个 **纯 Web** 的 OpenCode 插件。没有 CLI，也没有 TUI 命令 — 所有操作都在一个 Web UI 中完成。

- **一个 Web 管理所有项目** — `http://localhost:4321` 汇集所有正在运行的 OpenCode 实例。
- **按项目、按会话的队列** — 每个对话（会话）拥有独立的队列。
- **待办式状态追踪** — 每个项目经历 `queued → pending → sent → done`（或 `failed`）。
- **手动、逐个发送** — 显式发送队列中的提示，上一个完成后才发送下一个。始终由用户掌控流程。
- 队列项目的 **重新排序、编辑、删除**，失败项目的 **重新发送**。
- **稳健的设计** — 所有状态保存在磁盘上，因此即使 OpenCode 窗口开关，系统也能持续工作。

## 安装

### 前提条件

- [OpenCode](https://opencode.ai) 1.x（运行于 [Bun](https://bun.sh) 之上，插件也使用 Bun）

### npm

```bash
npm install -g opencode-q
```

安装时通过 postinstall 步骤自动注册到 `~/.config/opencode/plugins/`。重启 OpenCode 即可使用。

> **注意：** 由于插件注册到全局路径（`~/.config/opencode/plugins/`），因此必须使用全局安装（`-g`）。不支持按项目安装。

## 使用方法

1. 在任意项目中启动 OpenCode（也可以在多个项目中同时启动）。
2. 在浏览器中打开 **`http://localhost:4321`**。
3. 在侧边栏选择项目，选择会话标签，然后：
   - **添加** 提示 — 显示为 `queued`。
   - **发送** 队列项目 — 变为 `pending` → AI 工作时为 `sent` → AI 完成时为 `done`。有项目正在发送时按钮会被禁用，避免提示重叠。
   - 队列项目的 **重新排序**（拖拽）、**编辑**、**删除**。
   - 项目变为 `failed` 时，点击 **重新发送**。

OpenCode 实例已不再运行的项目会显示为 **离线**（灰色），其队列会被保留，重启时仍然存在。

## Web UI 一览

| 元素 | 用途 |
|------|------|
| 侧边栏 | 所有正在运行的项目（离线为灰色） |
| 会话标签 | 在项目的会话间切换 |
| 状态徽章 | 每个项目的 `queued` / `pending` / `sent` / `done` / `failed` |
| 发送 / 重新发送 | 发送队列项目，重试失败项目（每个会话一次一个） |

Web 服务器在插件加载时自动启动，始终使用端口 `4321`。

## 问题排查

- 确认至少有一个 OpenCode 实例正在运行 — Web UI 由插件提供，因此只有在 OpenCode 打开时才能访问 `http://localhost:4321`。
- 如果页面无法打开，请确认没有其他程序已占用端口 `4321`。
- 发现 Bug？请附上复现步骤开一个 [GitHub Issue](https://github.com/dev3am/opencode-q/issues)，这会很有帮助。

## 架构

opencode-q 以 **磁盘作为唯一可信来源**。每个 OpenCode 实例加载插件，抢到端口 `4321` 的实例提供（无状态的）Web UI，每个实例执行自身会话的队列提示。进程间没有网络回调，因此任何实例的启动或关闭都不会影响其他实例。

开发设置和详细信息请参阅 [CONTRIBUTING.md](https://github.com/dev3am/opencode-q/blob/main/CONTRIBUTING.md)。

## 许可证

MIT
