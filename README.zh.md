# opencode-q

**OpenCode 的提示队列插件** — 在 AI 工作时将提示加入队列，完成后通过手动批准依次执行。

[English](https://github.com/dev3am/opencode-q/blob/main/README.md) | [한국어](https://github.com/dev3am/opencode-q/blob/main/README.ko.md) | [日本語](https://github.com/dev3am/opencode-q/blob/main/README.ja.md)

---

## 功能

- **提示入队** — AI 工作时预先保存后续问题
- **重新排序、删除、清空** — 自由管理队列项目
- **逐项执行** — 手动控制逐个执行
- **Web UI** (`http://localhost:4321`) — 可视化队列管理界面
- **CLI 工具** — 独立于 AI 状态运行
- **实时更新** — 通过 SSE 即时反映到 Web UI
- **会话隔离** — 每个对话拥有独立队列

## 安装

### 前提条件

- [Bun](https://bun.sh) 1.x
- OpenCode 1.x

### npm (发布后)

```bash
npm install opencode-q
```

`opencode.json`:

```json
{
  "plugin": ["opencode-q"]
}
```

## 使用方法

### 斜杠命令 (TUI)

| 命令 | 描述 |
|---------|------|
| `/q-add <文本>` | 将提示加入队列 |
| `/q-list` | 查看所有队列中的提示 |
| `/q-remove <id>` | 删除指定项目 |
| `/q-clear` | 清空整个队列 |
| `/q-reorder <from> <to>` | 重新排序项目（基于 1 的位置） |
| `/q-next` | 将下一个项目填入 TUI 输入框 |

> 斜杠命令通过 AI 处理，如果 AI 正忙则会有延迟。

### CLI

```bash
# 添加提示
opencode-q add "提示内容"

# 查看队列
opencode-q list

# 删除项目
opencode-q remove <id>

# 清空队列
opencode-q clear

# 重新排序
opencode-q reorder <from> <to>
```

> CLI 独立于 AI 状态运行，直接进行文件 I/O 操作，AI 繁忙时也可使用。

### Web UI

在浏览器中打开 `http://localhost:4321`:

- 拖拽排序队列
- 点击执行按钮向 AI 发送提示
- 实时状态显示 (idle/busy/error)
- 失败项目的重试与跳过

Web UI 在插件加载时自动启动。

## 配置

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

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `port` | `4321` | Web UI 的 HTTP 服务器端口 |

## 架构

开发设置和详细架构请参阅 [CONTRIBUTING.md](https://github.com/dev3am/opencode-q/blob/main/CONTRIBUTING.md)。

## 许可证

MIT
