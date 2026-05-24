# opencode-q

**OpenCode用プロンプトキュープラグイン** — AIが作業中のプロンプトをキューに登録し、完了後に手動承認で順次実行します。

[English](README.md) | [한국어](README.ko.md) | [中文](README.zh.md)

---

## 機能

- **プロンプトのキュー登録** — AI稼働中でも次の質問を事前に保存
- **順序変更、削除、クリア** — キュー項目を自由に管理
- **個別実行** — 手動で一つずつ実行
- **Web UI** (`http://localhost:4321`) — 視覚的なキュー管理インターフェース
- **CLIツール** — AIの状態に依存せず独立して動作
- **リアルタイム更新** — SSEでWeb UIに即時反映
- **セッション分離** — 会話ごとに独立したキュー

## インストール

### 前提条件

- [Bun](https://bun.sh) 1.x
- OpenCode 1.x

### npm (公開後)

```bash
npm install opencode-q
```

`opencode.json`:

```json
{
  "plugin": ["opencode-q"]
}
```

## 使い方

### スラッシュコマンド (TUI)

| コマンド | 説明 |
|---------|------|
| `/q-add <テキスト>` | プロンプトをキューに追加 |
| `/q-list` | キューの全プロンプトを表示 |
| `/q-remove <id>` | 特定の項目を削除 |
| `/q-clear` | キューを全削除 |
| `/q-reorder <from> <to>` | 項目の順序を変更 (1-based) |
| `/q-next` | 次の項目をTUI入力欄にセット |

> スラッシュコマンドはAIを経由するため、AIがビジー状態の場合は遅延が発生します。

### CLI

```bash
# プロンプト追加
opencode-q add "プロンプト内容"

# キュー表示
opencode-q list

# 項目削除
opencode-q remove <id>

# キュー初期化
opencode-q clear

# 順序変更
opencode-q reorder <from> <to>
```

> CLIはAIの状態に関係なく直接ファイルI/Oで動作するため、AIがビジーでも使用可能です。

### Web UI

ブラウザで `http://localhost:4321` を開くと:

- ドラッグ＆ドロップで並び替え
- 実行ボタンでAIにプロンプト送信
- リアルタイムステータス表示 (idle/busy/error)
- 失敗項目のリトライとスキップ

Web UIはプラグインロード時に自動起動します。

## 設定

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

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `port` | `4321` | Web UIのHTTPサーバーポート |

## アーキテクチャ

開発セットアップと詳細なアーキテクチャについては [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

MIT
