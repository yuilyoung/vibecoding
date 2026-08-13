# Phase 3 WBS — 전투 감각(Feel) + 스테이지 콘텐츠 + 플레이테스트 증거

- **Handoff:** `../../../../docs/handoffs/current-handoff.json` (루트 단일 소스)
- **상태:** completed — 구현 완료, 비전 확인 대기
- **작성일:** 2026-04-15
- **의존 Phase:** Phase 1 (무기/물리), Phase 2 (AI/진행도/스테이지) 완료 상태 전제

## 목표

Phase 2까지 구축된 게임 루프에 **감각 피드백**과 **스테이지 다양성**을 추가하고, 헤드리스 플레이테스트 증거를 남겨 Phase 2 closing 리스크(플레이테스트 미완, gate/hazard/pickup 배치 단조로움)를 해소한다.

## 범위

| 영역 | 목표 |
|------|------|
| Audio | 무기 사격·폭발·피격·언락·라운드 전이 사운드 큐 체계화 |
| Visual feedback | 카메라 셰이크, 히트 플래시, hit-pause, 넉백 반응 |
| Stage content | 스테이지별 hazard/pickup/gate 메타데이터 외부화 및 스포너 |
| Pickups | 체력/탄약/일회성 부스트 픽업 순수 로직 |
| Settings | 볼륨/감도 영속화 (SettingsStorage) |
| Playtest | Playwright 헤드리스 smoke 시나리오로 스테이지 3개 순환·무기 6종·진행도 검증 |

## 비범위 (out of scope)

- 보스 웨이브 / 멀티 페이즈 보스
- 튜토리얼/온보딩
- 네트워크 멀티
- 모바일 입력

## 제약

- 게임 로직은 `src/domain/` 순수 TS, Phaser 의존은 `src/scenes/` 분리 유지
- 모든 수치/맵핑은 `assets/data/game-balance.json` 외부화
- TDD: 새 로직은 반드시 `tests/*.test.ts` 동반
- 기존 145개 유닛 테스트 + 12개 E2E 전부 pass 유지
- 오디오는 Web Audio 사용, 파일은 `assets/audio/` 하위
- 빌드 사이즈 목표(최대 청크 < 800 kB, gzip < 250 kB) 유지

## 완료 기준

1. 무기 6종·폭발·피격·언락·라운드 전이에 사운드 큐 연결
2. 피격/폭발 시 카메라 셰이크와 히트 플래시 관찰 가능
3. 스테이지 3개에 서로 다른 hazard/pickup/gate 구성 적용
4. 플레이어가 픽업을 습득해 체력/탄약 회복 가능
5. 볼륨/감도 설정이 새로고침 후 유지
6. `npm run type-check && lint && test && build` 통과
7. `npx playwright test` 전체 통과 (신규 smoke 포함)
8. `docs/handoffs/current-execution-report.md` 갱신 + postflight sync

## 태스크 요약

| ID | 제목 | 담당 | 선행 |
|----|------|------|------|
| T1 | AudioCueLogic 순수 로직 + 우선순위/쿨다운 | ultron/app-developer | — |
| T2 | 무기·폭발·언락 사운드 바인딩 + 에셋 | ultron/sounder | T1 |
| T3 | CameraFeedbackLogic (shake/flash/hit-pause) 순수 | ultron/app-developer | — |
| T4 | MainScene 피드백 통합 | ultron/frontend | T3 |
| T5 | StageContentDefinition + game-balance 확장 | ultron/app-developer | — |
| T6 | Stage content 스포너 & MainScene 로드 | ultron/app-developer | T5 |
| T7 | PickupLogic 순수 로직 + 인벤토리 연동 | ultron/app-developer | T5 |
| T8 | SettingsStorage (볼륨/감도) + UI | ultron/frontend | — |
| T9 | Playwright 헤드리스 smoke 시나리오 | ultron/qa | T2, T4, T6, T7 |
| T10 | 검증 게이트 + execution report | ultron/qa | T9, T8 |

## 의존 그래프

```
T1 ─▶ T2 ─┐
T3 ─▶ T4 ─┤
T5 ┬▶ T6 ─┼─▶ T9 ─▶ T10
    └▶ T7 ┘         ▲
T8 ───────────────┘
```

## 참조

- [Phase 2 tasks](./phase2-tasks.json) · [Phase 2 WBS](./phase2-wbs.md)
- [sound cue contract](../development/sound-cue-contract.md)
- [playtest checklist](../development/playtest-checklist.md)
- [game direction](../development/game-direction.md)
