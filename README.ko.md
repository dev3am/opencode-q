# opencode-q

**OpenCode용 프롬프트 큐 플러그인** — AI가 작업 중인 동안 프롬프트를 큐에 미리 등록하고, 완료 후 수동 승인으로 순차 실행합니다.

[English](README.md) | [日本語](README.ja.md) | [中文](README.zh.md)

---

## 기능

- **프롬프트 큐 등록** — AI가 작업 중에도 다음 질문을 미리 저장
- **순서 변경, 삭제, 초기화** — 큐 항목을 자유롭게 관리
- **개별 실행** — 하나씩 수동으로 실행
- **Web UI** (`http://localhost:4321`) — 시각적 큐 관리 인터페이스
- **CLI 도구** — AI 상태와 무관하게 독립적으로 동작
- **실시간 업데이트** — SSE로 Web UI에 즉시 반영
- **세션 분리** — 각 대화별 독립 큐 운영

## 설치

### 필수 조건

- [Bun](https://bun.sh) 1.x
- OpenCode 1.x

### npm (배포 후)

```bash
npm install opencode-q
```

`opencode.json`:

```json
{
  "plugin": ["opencode-q"]
}
```

## 사용법

### 슬래시 명령어 (TUI)

| 명령어 | 설명 |
|---------|------|
| `/q-add <텍스트>` | 프롬프트를 큐에 추가 |
| `/q-list` | 큐의 모든 프롬프트 조회 |
| `/q-remove <id>` | 특정 항목 삭제 |
| `/q-clear` | 큐 전체 비우기 |
| `/q-reorder <from> <to>` | 항목 순서 변경 (1-based) |
| `/q-next` | 다음 항목을 TUI 입력란에 채움 |

> 슬래시 명령어는 AI를 경유하므로 AI가 바쁘면 지연이 있을 수 있습니다.

### CLI

```bash
# 프롬프트 추가
opencode-q add "프롬프트 내용"

# 큐 조회
opencode-q list

# 항목 삭제
opencode-q remove <id>

# 큐 초기화
opencode-q clear

# 순서 변경
opencode-q reorder <from> <to>
```

> CLI는 AI 상태와 무관하게 직접 파일 I/O로 동작하므로 AI가 바쁠 때도 사용 가능합니다.

### Web UI

브라우저에서 `http://localhost:4321`을 열면:

- 드래그앤드롭으로 큐 순서 변경
- 실행 버튼으로 AI에 프롬프트 전송
- 실시간 상태 표시 (idle/busy/error)
- 실패 항목 재시도 및 건너뛰기

Web UI는 플러그인이 로드될 때 자동으로 시작됩니다.

## 설정

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

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `port` | `4321` | Web UI HTTP 서버 포트 |

## 아키텍처

개발 설정 및 상세 아키텍처는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참조하세요.

## 라이선스

MIT
