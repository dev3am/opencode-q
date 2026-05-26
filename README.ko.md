# opencode-q

**OpenCode용 프롬프트 큐 플러그인** — OpenCode를 실행하고 `http://localhost:4321`에 접속해, 세션별 프롬프트 큐를 할 일 목록처럼 관리합니다. 프롬프트를 미리 쌓아두고 AI에게 하나씩 전송하며, 상태를 실시간으로 추적합니다.

[English](https://github.com/dev3am/opencode-q/blob/main/README.md) | [日本語](https://github.com/dev3am/opencode-q/blob/main/README.ja.md) | [中文](https://github.com/dev3am/opencode-q/blob/main/README.zh.md)

---

## 무엇을 하나요

opencode-q는 **웹 전용** OpenCode 플러그인입니다. CLI도, TUI 명령어도 없습니다 — 모든 조작은 하나의 웹 UI에서 합니다.

- **모든 프로젝트를 한 웹에서** — `http://localhost:4321`에 실행 중인 모든 OpenCode 인스턴스가 한곳에 모입니다.
- **프로젝트별·세션별 큐** — 각 대화(세션)가 독립된 큐를 가집니다.
- **할 일 스타일 상태 추적** — 모든 항목은 `queued → pending → sent → done`(또는 `failed`)을 거칩니다.
- **수동·한 번에 하나** — 큐에 쌓인 프롬프트를 직접 전송하고, 이전 것이 끝나야 다음을 보냅니다. 항상 사용자가 흐름을 제어합니다.
- 큐 항목 **순서 변경·편집·삭제**, 실패 항목 **재전송**.
- **견고한 설계** — 모든 상태가 디스크에 저장되어, OpenCode 창이 열리고 닫혀도 시스템이 계속 동작합니다.

## 설치

### 필수 조건

- [OpenCode](https://opencode.ai) 1.x ([Bun](https://bun.sh) 위에서 동작하며 플러그인도 Bun을 사용합니다)

### npm

```bash
npm install -g opencode-q
```

설치 시 postinstall 단계에서 자동으로 `~/.config/opencode/plugins/`에 등록됩니다. OpenCode를 재시작하면 바로 사용 가능합니다.

> **참고:** 플러그인이 전역 경로(`~/.config/opencode/plugins/`)에 등록되므로 반드시 글로벌 설치(`-g`)가 필요합니다. 프로젝트별 설치는 지원하지 않습니다.

## 사용법

1. 아무 프로젝트에서 OpenCode를 실행합니다 (여러 프로젝트에서 동시에 실행해도 됩니다).
2. 브라우저에서 **`http://localhost:4321`**을 엽니다.
3. 사이드바에서 프로젝트를 고르고, 세션 탭을 선택한 뒤:
   - 프롬프트 **추가** — `queued` 상태로 나타납니다.
   - 큐 항목 **전송** — `pending` → AI 작업 중 `sent` → AI 완료 시 `done`으로 바뀝니다. 전송 중인 항목이 있으면 보내기 버튼이 비활성화되어 프롬프트가 겹치지 않습니다.
   - 큐 항목 **순서 변경**(드래그)·**편집**·**삭제**.
   - 항목이 `failed`가 되면 **재전송**을 누릅니다.

OpenCode 인스턴스가 더 이상 실행 중이지 않은 프로젝트는 **오프라인**(회색)으로 표시되며, 큐는 보존되어 재시작 시 그대로 남아 있습니다.

## 웹 UI 한눈에 보기

| 요소 | 용도 |
|------|------|
| 사이드바 | 실행 중인 모든 프로젝트 (오프라인은 회색) |
| 세션 탭 | 프로젝트의 세션 간 전환 |
| 상태 배지 | 항목별 `queued` / `pending` / `sent` / `done` / `failed` |
| 보내기 / 재전송 | 큐 항목 전송, 실패 항목 재시도 (세션당 한 번에 하나) |

웹 서버는 플러그인이 로드될 때 자동으로 시작되며, 항상 `4321` 포트를 사용합니다.

## 문제 해결

- OpenCode 인스턴스가 하나 이상 실행 중인지 확인하세요 — 웹 UI는 플러그인이 제공하므로 OpenCode가 켜져 있을 때만 `http://localhost:4321`에 접속할 수 있습니다.
- 페이지가 안 열리면, 다른 프로그램이 `4321` 포트를 이미 쓰고 있지 않은지 확인하세요.
- 버그를 발견하셨나요? 재현 단계와 함께 [GitHub Issue](https://github.com/dev3am/opencode-q/issues)를 열어주시면 큰 도움이 됩니다.

## 아키텍처

opencode-q는 **디스크를 유일한 진실원**으로 사용합니다. 각 OpenCode 인스턴스가 플러그인을 로드하고, `4321` 포트를 잡은 인스턴스가 (무상태) 웹 UI를 제공하며, 각 인스턴스는 자기 세션의 큐 프롬프트를 실행합니다. 프로세스 간 네트워크 콜백이 없어, 어떤 인스턴스가 켜지고 꺼지든 나머지에 영향을 주지 않습니다.

개발 설정 및 상세 내용은 [CONTRIBUTING.md](https://github.com/dev3am/opencode-q/blob/main/CONTRIBUTING.md)를 참조하세요.

## 라이선스

MIT
