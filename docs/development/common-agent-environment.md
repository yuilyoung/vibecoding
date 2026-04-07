# Common Agent Environment

## 목적

이 문서는 저장소를 `비전 + 울트론` 공용 에이전트 환경으로 확장한 기준을 정의한다.

## 설계 방식

- 전용 기능은 유지한다.
- 공용 기준은 루트 문서와 Node 스크립트로 추가한다.
- 특정 도구에 종속된 오케스트레이션은 보조 계층으로 둔다.

## 계층 구조

### 1. 공용 계층

- `AGENTS.md`
- `docs/development/agent-workspace-harness-checklist.md`
- `docs/development/active-workspace-baseline.md`
- `docs/development/claude-codex-operating-model.md`
- `plugins/openai-hud/scripts/collect-workspace-status.mjs`
- `plugins/openai-hud/scripts/collect-status.mjs`

이 계층은 `비전`, `울트론` 모두가 읽고 사용할 수 있다.

### 2. 비전 확장 계층

- `.claude/settings.json`
- `.claude/rules/`
- `.claude/agents/`
- `.claude/hooks/`

이 계층은 비전의 자동화와 오케스트레이션을 강화한다.

### 3. 울트론 실행 계층

- `codex/skills/`
- `codex/subagents/`
- `codex/hooks/`
- `docs/handoffs/`

이 계층은 울트론의 구현, 검증, handoff 수신을 표준화한다.

## 운영 원칙

- 공용 계층이 기준 계약이다.
- 비전은 공용 계층 + `.claude/` 계층을 함께 사용한다.
- 울트론은 공용 계층 + `codex/` 계층을 사용하고, `.claude/`는 참고 자료로만 본다.

## 왜 기능 축소가 필요 없는가

- 공용화의 목적은 최소 공통 기준을 만드는 것이다.
- 전용 기능을 지우는 것이 아니라, 공용 해석 가능한 표면을 추가하면 된다.
- 따라서 비전 고유 기능을 유지해도 울트론 호환성은 확보할 수 있다.

## 현재 결론

- 저장소는 현재 `비전 확장 가능 + 울트론 공용 해석 가능` 상태다.
- 아직 도구별 완전 동일 동작을 보장하는 것은 아니지만, 동일한 작업 기준과 상태 진입점은 맞춰져 있다.
