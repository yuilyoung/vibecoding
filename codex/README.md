# Ultron Execution Layer

이 디렉토리는 `비전 planning + 울트론 execution` 조합에서 `울트론`이 구현과 검증을 수행할 때 참고하는 전용 계층이다.

## 구성

- `skills/`
  - handoff 기반 구현
  - baseline 기준 검토
- `subagents/`
  - 탐색, 구현, 검증 역할 분리 기준
- `hooks/`
  - 작업 전 preflight
  - 작업 후 postflight sync

## 원칙

- 공용 계약은 `AGENTS.md`와 `docs/development/*.md`를 따른다.
- 실제 구현 기준은 `work/2D-FPS-game`을 우선한다.
- `울트론`은 이 계층을 사용해 구현과 검증을 표준화한다.
