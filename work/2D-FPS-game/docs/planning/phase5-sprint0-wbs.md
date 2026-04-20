# Phase 5 Sprint 0 WBS — MainScene Decomposition

- Date: 2026-04-16
- Owner: ultron
- Status: complete
- Handoff: `../../../../docs/handoffs/current-handoff.json`

## Summary

MainScene.ts (3320줄) god-class를 5개 헬퍼 모듈로 분해하여 ~800줄 오케스트레이터로 축소한다. 비전이 1차로 scene-types, scene-constants, weapon-slot-factory, arena-textures를 추출 완료한 상태에서 이어받는다.

## Pre-work: SceneRuntimeState

모든 헬퍼가 공유하는 mutable 상태를 단일 plain object로 정의. MainScene이 소유하고 헬퍼에 참조 전달.

```ts
interface SceneRuntimeState {
  playerLogic, dummyLogic, playerSprite, targetDummy,
  bullets[], impactEffects[], shotTrails[], movementEffects[],
  obstacles[], stageObstacleViews[], gate, hazardZone,
  ammoPickup, healthPickup, coverPointViews[],
  lastCombatEvent, playerConsecutiveBlockedFrames,
  dummyConsecutiveBlockedFrames, ...
}
```

## Tasks

| ID | Work | Approx Lines | Depends | Status |
|----|------|-------------|---------|--------|
| T0 | SceneRuntimeState 공유 상태 객체 정의 | ~80 | — | complete |
| T1 | VfxController — 이펙트 풀(impact/trail/movement) 생성/업데이트/트림 | ~300 | T0 | complete |
| T2 | ActorCollisionResolver — 장애물 충돌, 슬라이드, 나선형 탈출 | ~250 | T0 | complete |
| T3 | StageGeometryManager — 장애물/게이트/해저드/픽업 배치/상호작용 | ~400 | T0, T2 | complete |
| T4 | DummyActorController — 더미 AI 이동/커버/조향/회전 | ~350 | T0, T2 | complete |
| T5 | CombatController — 사격/재장전/탄환 업데이트/공습/무기 전환 | ~500 | T0, T1, T2 | complete |
| T6 | TODO(bug) 핫픽스 2건 | ~20 | — | complete |
| T7 | 검증 게이트 + execution report | — | T1~T6 | complete |

## Dependency Graph

```
T0 ─┬▶ T1 ──┐
    ├▶ T2 ──┼─▶ T5 ──▶ T7
    │  ├─▶ T3 │        ▲
    │  └─▶ T4 ┘        │
    └───────────────── T6
```

## Wiring Pattern

```ts
class VfxController {
  constructor(private scene: Phaser.Scene, private state: SceneRuntimeState) {}
  update(now: number): void { ... }
}
```

MainScene constructs helpers in `create()`, calls `helper.update()` from `update()`.

## Risks

| Risk | Mitigation |
|------|------------|
| E2E debug* 메서드 시그니처 변경 | MainScene에 thin delegator 유지 |
| 공유 mutable state race | 단일 update loop 보장 (Phaser scene lifecycle) |
| CombatController 결합도 | VfxController + CollisionResolver 선추출 |

## Bug Fixes (T6)

1. `src/domain/feedback/CameraFeedbackLogic.ts:130` — 미지원 kind에 `EMPTY_RESULT` 폴백
2. `src/domain/settings/SettingsStorage.ts:51` — `save()`에 try/catch, QuotaExceededError 로깅
