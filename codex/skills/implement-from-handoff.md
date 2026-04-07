# Skill: Implement From Handoff

## 목적

`비전`이 만든 계획과 handoff 패킷을 받아 `울트론`이 바로 구현에 들어갈 수 있게 하는 기준이다.

## 입력

- `docs/handoffs/current-handoff.json`
- `AGENTS.md`
- `docs/development/active-workspace-baseline.md`
- `work/2D-FPS-game/docs/development/harness-checklist.md`

## 절차

1. handoff의 `scope`, `constraints`, `acceptance`, `files`를 읽는다.
2. 활성 실행 베이스라인이 `work/2D-FPS-game`인지 확인한다.
3. 구현 전 `npm run workspace-status`와 `npm run project-status`를 확인한다.
4. 필요한 코드 수정 후 `type-check`, `lint`, `test`, `build`를 수행한다.
5. 결과를 `docs/handoffs/current-execution-report.md`에 기록한다.

## 출력

- 구현된 코드
- 검증 결과
- 실행 리포트
