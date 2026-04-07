# Cross-Agent Quickstart

## 목적

`비전`과 `울트론`이 동일한 진입 명령으로 현재 작업환경과 프로젝트 상태를 볼 수 있게 하는 빠른 가이드입니다.

## 루트 명령

```bash
npm run workspace-status
npm run project-status
npm run next-tasks
```

## 의미

- `workspace-status`
  - 루트 작업환경 하네스 상태
  - 활성 실행 베이스라인
  - 장기 로드맵 기준

- `project-status`
  - 현재 프로젝트 하네스 상태
  - `work/2D-FPS-game` 기준 readiness

- `next-tasks`
  - 루트 PM 보고서에서 즉시 착수 태스크를 추출

## 공용 해석 규칙

- `AGENTS.md`를 먼저 읽습니다.
- 루트 `docs/development/` 문서를 공용 계약으로 봅니다.
- 실제 실행과 검증은 `work/2D-FPS-game` 기준입니다.
- `.claude/`는 비전 확장 계층이며 공용 계층 위에 추가됩니다.
- `codex/`는 울트론 실행 계층입니다.
