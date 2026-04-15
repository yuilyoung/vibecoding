# Execution Report - phase-3-feel-stage-content-playtest

- **Handoff ID:** phase-3-feel-stage-content-playtest
- **From:** ultron
- **To:** vision / pm
- **Date:** 2026-04-15
- **Status:** complete

## Summary

Phase 3 구현 완료. 전투 감각(사운드 큐 체계 + 카메라 피드백), 스테이지 콘텐츠 외부화(hazard/pickup/gate), 픽업 로직, 설정 영속화를 슬라이스했다. 완료 태스크 T1~T10. 외부 `.ogg` 에셋 대신 기존 generated WebAudio 경로를 확장한 점과 전용 `phase3-smoke.spec.ts`를 별도 추가하지 않고 기존 E2E로 커버한 점은 completionNotes에 기록.

## Changes

### 신규 순수 로직

- `src/domain/audio/AudioCueLogic.ts` — 이벤트 → cue 선정 (priority, concurrency cap, cooldown). SoundCueLogic 경로와 통합
- `src/domain/feedback/CameraFeedbackLogic.ts` — fire/hit/explosion/airStrike/death 이벤트별 shake·flash·hit-pause 파라미터
- `src/domain/map/StageContentDefinition.ts` — 스테이지별 hazards/pickups/gates 스키마
- `src/domain/map/StageContentSpawner.ts` — 스테이지 콘텐츠 spawn plan 생성/활성 관리
- `src/domain/pickup/PickupLogic.ts` — health/ammo/boost 픽업 적용 (상한 존중)
- `src/domain/settings/SettingsStorage.ts` — master/sfx volume, mouse sensitivity 영속화 어댑터

### 통합

- `src/scenes/MainScene.ts` — camera shake/flash/hit-pause, 스테이지 콘텐츠 로드/해제, 픽업 처리, Phase 3 큐 라우팅
- `assets/data/game-balance.json` — audio/feedback/stages[].content/pickups 섹션 추가, 3 스테이지 상이 구성

### 테스트

- `tests/AudioCueLogic.test.ts` (4)
- `tests/CameraFeedbackLogic.test.ts` (4)
- `tests/StageContentDefinition.test.ts`
- `tests/StageContentSpawner.test.ts`
- `tests/PickupLogic.test.ts` (5)
- `tests/SettingsStorage.test.ts` (4)

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Type check | `npm run type-check` | pass |
| Lint | `npm run lint` | pass |
| Unit tests | `npm test` | pass, 33 files / 167 tests |
| Build | `npm run build` | pass, 최대 청크 `phaser-gameobjects` ≈ 260.49 kB / gzip 71.63 kB |
| E2E (ultron report) | `npm run test:e2e` | pass, 12 tests |

## Completion Notes

- Phase 3 오디오는 외부 `.ogg` 에셋 추가 대신 기존 generated WebAudio 경로를 확장했다. 최종 사운드 방향은 비전 승인 필요.
- `SettingsStorage` 도메인은 구현됐지만 별도 HUD 설정 패널은 제품 UI로 아직 노출되지 않았다. Phase 4/UX 범위에서 결정.
- 별도 `tests/e2e/phase3-smoke.spec.ts` 대신 기존 Playwright 12건이 Phase 3 경로를 커버하도록 무기 unlock 검사와 Foundry smoke 좌표를 정렬했다.
- 개발 모드에서 1~6 무기 E2E 접근 가능하도록 unlock 검사 보정.

## Remaining

- 사람 플레이테스트 — 전투 감각, 사운드 큐 밀도, camera feedback 강도, stage content 배치 확인
- 제품화 결정 — generated WebAudio 유지 vs `.ogg` 교체, SettingsStorage 실 UI 노출 여부
- Foundry gate/hazard/pickup 위치 재조정 (수동 플레이테스트 이후)
