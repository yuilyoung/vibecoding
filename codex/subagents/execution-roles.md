# Ultron Subagent Roles

## Explorer

- 코드 구조 파악
- 변경 범위 계산
- 의존성 확인

## Worker

- 실제 코드 구현
- 테스트 수정
- 설정 파일 보완

## Verifier

- `type-check`
- `lint`
- `test`
- `build`

## Specialist Briefs

- `game-specialist-phase7.md`
  - Phase 7 Tactical Combat Depth 전용 실행 브리프
  - `docs/handoffs/current-handoff.json`과 `work/2D-FPS-game/docs/planning/phase7-wbs.md`, `phase7-tasks.json`을 먼저 읽고 시작
  - 소유 범위: `game-balance.json`, `src/domain/ai/*`, `src/domain/combat/*`, tactical HUD/debug, 관련 테스트
- `game-specialist-phase8.md`
  - Phase 8 Environment Audio Polish 전용 실행 브리프
  - `docs/handoffs/current-handoff.json`과 `work/2D-FPS-game/docs/planning/phase8-wbs.md`, `phase8-tasks.json`을 먼저 읽고 시작
  - 소유 범위: `src/domain/audio/*`, `src/audio/*`, `src/scenes/audio-feedback-controller.ts`, HUD/debug audio visibility, 관련 테스트

## 운영 원칙

- Explorer는 읽기 중심
- Worker는 명시된 파일 범위 안에서 구현
- Verifier는 구현 완료 후 결과를 검증
- Specialist는 handoff와 phase task 문서를 기준으로 게임플레이 도메인 변경을 집행
- 결과는 `docs/handoffs/current-execution-report.md`에 집계
