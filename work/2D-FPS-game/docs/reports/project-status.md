# 2D-FPS-game — Project Status Report

- **Date:** 2026-04-15
- **Author:** ultron
- **Phase:** Phase 3 — 전투 감각(Feel) + 스테이지 콘텐츠 + 플레이테스트 증거 (구현 완료, 비전 확인 대기)

## 요약

Phase 1, Phase 2, Phase 3 핵심 구현 **완료**. 전체 진행률 **~78%**. 모든 검증 게이트(type-check / lint / test 167개 / build / E2E 12개) 통과. 다음 단계는 비전의 Phase 3 결과 확인과 수동 플레이테스트 판정이다.

## 완료된 작업

### Phase 1 — 무기 시스템 + 물리
- 6종 무기 도메인 (`WeaponLogic`, `WeaponInventoryLogic`, `ProjectileRuntime`)
- 5종 탄도 (linear / arc / bounce / beam / aoe-call) + `BeamLogic`, `AirStrikeLogic`
- `ExplosionLogic` 범위 감쇠 + mass-aware 넉백
- MainScene Phaser Physics 통합, 넘버키 1~6 전환
- `game-balance.json` weapons 섹션 외부화
- 유닛 테스트 117개 추가/통과

### Phase 2 — AI + 진행도 + 스테이지
- `AiStateMachine` (idle/patrol/chase/attack/retreat) 순수 로직
- `LineOfSightLogic` 시야선/엄폐 판정
- `HomingLogic` 유도 탄도 타겟팅 + 조향 제한
- `ProgressionLogic` XP/레벨 곡선, `UnlockLogic` 레벨 기반 무기 언락
- `ProgressionStorage` in-memory/localStorage 어댑터
- `StageDefinition` + `StageRotationLogic` 최소 3 스테이지 순환
- MainScene 통합: AI 상태머신, 스테이지 전환, XP 이벤트, 언락 토스트
- HUD 갱신: 레벨/XP 바, 언락 알림, 쿨다운, 폭발 범위 프리뷰
- Vite `manualChunks` phaser-vendor 분할 (최대 청크 ≈ 260 kB / gzip ≈ 72 kB)

### Phase 3 — 전투 감각 + 스테이지 콘텐츠
- `AudioCueLogic`: 사운드 큐 우선순위, 쿨다운, 동시재생 제한 순수 로직
- 기존 `SoundCueLogic` + `GeneratedAudioCuePlayer` 경로에 Phase 3 큐 제어 통합
- `CameraFeedbackLogic`: fire/hit/explosion/airStrike/death 이벤트별 camera shake, flash, hit-pause 출력
- MainScene에 camera shake/flash/hit-pause 연결
- `StageContentDefinition`: 스테이지별 `hazards`, `pickups`, `gates` 스키마 정의
- `StageContentSpawner`: 현재 스테이지 콘텐츠 spawn plan 생성 및 active plan 관리
- `game-balance.json`의 3개 스테이지에 서로 다른 hazard/pickup/gate content 추가
- MainScene 스테이지 전환 시 hazard/gate/pickup 위치와 수치 반영
- `PickupLogic`: health/ammo/boost 픽업 적용 순수 로직
- `SettingsStorage`: master volume, sfx volume, mouse sensitivity 저장/로드/검증 어댑터
- 개발 모드에서 1~6 무기 E2E 접근이 가능하도록 무기 unlock 검사 보정
- 기존 E2E의 Foundry smoke 좌표와 호환되도록 기본 stage content 좌표 조정

## 검증

| Gate | Result |
|------|--------|
| `npm run type-check` | 통과 |
| `npm run lint` | 통과 |
| `npm test` | 통과 — 33 files / 167 tests |
| `npm run build` | 통과 |
| `npm run test:e2e` | 통과 — 12 tests |
| `git diff --check` | 통과 |

## 진행 중

없음 — Phase 3 핵심 구현은 완료됐고, 비전 확인 대기.

## 블로킹 이슈

없음.

## 다음 단계

1. **Phase 3 결과 확인 및 승인** (비전)
2. **사람 플레이테스트** — 전투 감각, 사운드 큐 밀도, camera feedback 강도, stage content 배치 확인
3. **제품화 범위 결정** — generated WebAudio 유지 vs `.ogg` 에셋 교체, SettingsStorage를 실제 HUD 설정 UI로 노출할지 결정

## 리스크

| 구분 | 내용 | 완화 방안 |
|------|------|-----------|
| 오디오 | Phase 3는 외부 `.ogg` 에셋 추가 대신 기존 generated WebAudio 경로를 확장했다 | 비전이 최종 사운드 방향 승인 후 에셋 교체 여부 결정 |
| 설정 UI | `SettingsStorage` 도메인은 구현됐지만 별도 HUD 설정 패널은 아직 제품 UI로 노출하지 않았다 | Phase 4/UX 범위에서 ESC 설정 패널 또는 HUD 설정 버튼 결정 |
| 체감 | 자동 E2E는 통과했지만 실제 사람 플레이테스트는 아직 필요하다 | 비전 검수 후 수동 smoke test 기록 |
| 스테이지 콘텐츠 | Foundry는 기존 E2E smoke 좌표 호환을 위해 일부 기본 좌표를 유지했다 | 수동 플레이테스트 후 gate/hazard/pickup 위치 재조정 |

## 핸드오프 / 계획 단일 소스

- **핸드오프 (루트, codex 훅이 참조):**
  - `../../../../docs/handoffs/current-handoff.json`
  - `../../../../docs/handoffs/current-execution-report.md`
  - `../../../../docs/handoffs/execution-status.json`
- **Phase 계획 (프로젝트 로컬):**
  - [Phase 1 WBS](../planning/phase1-wbs.md) · [Phase 1 tasks](../planning/phase1-tasks.json)
  - [Phase 2 WBS](../planning/phase2-wbs.md) · [Phase 2 tasks](../planning/phase2-tasks.json)
  - [Phase 3 WBS](../planning/phase3-wbs.md) · [Phase 3 tasks](../planning/phase3-tasks.json)
