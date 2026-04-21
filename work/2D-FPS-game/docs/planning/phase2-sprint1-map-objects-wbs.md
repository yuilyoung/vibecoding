# Phase 2 Sprint 1 WBS — Map Objects MVP (Brawl Stars 방향)

- Date: 2026-04-20
- Owner: ultron
- Status: complete
- Handoff: `../../../../docs/handoffs/current-handoff.json` (id: `phase-2-sprint1-map-objects`)

## Summary

`docs/development/game-direction.md`의 "브롤스타즈 + 웜즈 하이브리드" 방향으로 복귀하여 맵 상호작용 오브젝트 3종 MVP를 도입한다: **드럼통(체인 폭발)**, **지뢰(근접 트리거)**, **보급 상자(파괴 시 픽업 드롭)**. 기존 `ExplosionLogic.resolveChainExplosion`(정의만 되어 있고 호출처 없음)을 combat-controller에 결선하고, 기존 `PickupLogic`을 재사용해 크레이트 드롭을 붙인다. 파괴 엄폐물·바운스 벽·텔레포터는 Sprint 2로 이연.

## Pre-work — 설계 계약

- **순수 도메인**: `MapObjectLogic` / `MapObjectRuntime`은 Phaser 의존 금지. 상태·tick만 순수 함수로.
- **RNG 주입**: 지뢰 arm/fuse와 크레이트 drop 선택 모두 `rng: () => number` 인자. 기본값 `Math.random`, 테스트는 stub 주입.
- **밸런스 데이터**: 모든 수치(`hp`, `blastRadius`, `proximityRadius`, `dropTable` 확률)는 `assets/data/game-balance.json`에 선언.
- **컨트롤러 위임**: MainScene은 `map-object-controller` 생성/update 호출만. 스프라이트·충돌 배선은 컨트롤러 내부.

## Tasks

| ID | Work | Approx Lines | Depends | Acceptance | Status |
|----|------|-------------|---------|-----------|--------|
| T0 | `game-balance.json` mapObjects 섹션 + `GameBalanceMapObjects` 타입 정의 | ~60 | — | A1 | complete |
| T1 | `MapObjectLogic.ts` 순수 도메인 + `tests/MapObjectLogic.test.ts` (TDD) | ~120 | T0 | A2 | complete |
| T2 | `MapObjectRuntime.ts` tick (지뢰 arm/proximity/fuse, 크레이트 drop 선택) + `tests/MapObjectRuntime.test.ts` (TDD, seed 고정) | ~150 | T1 | A3, A5 | complete |
| T3 | `ExplosionLogic` 체인 통합 + `tests/ChainExplosion.test.ts` — combat-controller에서 chainDelayMs 순차 스케줄 | ~80 | T1 | A4 | complete |
| T4 | `StageContentDefinition` + `StageContentSpawner` 확장 — `mapObjects` 필드 + 3개 스테이지 기본 배치 | ~80 | T1 | A?(운영) | complete |
| T5 | `src/scenes/map-object-controller.ts` 신규 — Phaser primitive 렌더 + 충돌 | ~200 | T2, T3, T4 | A6 | complete |
| T6 | `combat-controller` 결선 — bullet/explosion → mapObject 피격, 크레이트 drop → PickupLogic 스폰 | ~80 | T2, T3 | A4, A5 | complete |
| T7 | `MainScene` 위임 + `getDebugSnapshot.mapObjects` 확장 (공개 시그니처 불변) | ~30 | T5, T6 | A7, A10 | complete |
| T8 | `tests/e2e/map-objects.spec.ts` — 드럼통 단일 파괴 / 체인 2개 / 크레이트 drop 3 시나리오 | ~120 | T7 | A8 | complete |
| T9 | 검증 게이트 5종 실행 + `current-execution-report.md` 갱신 | — | T1~T8 | A9, A11 | complete |

Acceptance 번호는 handoff `acceptance` 배열 순서(A1=첫 항목 … A12=마지막 항목)에 대응.

## Dependency Graph

```
T0 ─▶ T1 ─┬─▶ T2 ─┬─▶ T5 ─▶ T7 ─▶ T8 ─▶ T9
          ├─▶ T3 ─┼─────────▲
          └─▶ T4 ─┘
                  └─▶ T6 ───┘
```

T0 데이터 스키마가 전체 기반. T1 MapObjectLogic에서 T2(runtime)·T3(체인)·T4(스테이지 통합)가 분기. T5(Phaser 레이어)·T6(combat 결선)은 T2/T3에서 합류하고 T7에서 MainScene 통합.

## Data Schema — `game-balance.json` mapObjects

```jsonc
{
  "mapObjects": {
    "barrel": {
      "hp": 40,
      "blastRadius": 80,
      "blastDamage": 40,
      "triggerRadius": 70,   // 체인 반경 (ExplosiveObject.triggerRadius)
      "chainDelayMs": 150
    },
    "mine": {
      "armDelayMs": 500,
      "proximityRadius": 40,
      "fuseMs": 1000,
      "blastRadius": 50,
      "blastDamage": 50
    },
    "crate": {
      "hp": 25,
      "dropTable": { "health": 0.4, "ammo": 0.4, "boost": 0.2 }
    }
  }
}
```

## Domain Signatures

```ts
// src/domain/map/MapObjectLogic.ts
export type MapObjectKind = "barrel" | "mine" | "crate";
export interface MapObjectState {
  readonly id: string;
  readonly kind: MapObjectKind;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly active: boolean;
  readonly armedAt?: number;    // mine only
  readonly fuseStartedAt?: number;
}

export function createMapObject(init): MapObjectState;
export function damageMapObject(state, amount): MapObjectState;
export function destroyMapObject(state): MapObjectState; // 멱등

// src/domain/map/MapObjectRuntime.ts
export interface MapObjectTickResult {
  readonly triggered: readonly string[];              // 폭발·파괴 대상
  readonly drops: readonly { id: string; type: "health" | "ammo" | "boost"; x: number; y: number }[];
}

export function advanceMapObjects(
  now: number,
  dt: number,
  actors: readonly { x: number; y: number }[],
  objects: readonly MapObjectState[],
  rng: () => number = Math.random,
): MapObjectTickResult;
```

## Chain Explosion Wiring

```
combat-controller: bullet→barrel 피격
  → MapObjectLogic.damageMapObject → hp<=0
    → resolveChainExplosion({ originId, objects: barrels, maxDepth: 5 })
      → triggered list (e.g. [A, B, C])
        → 각 id에 대해 chainDelayMs × index 딜레이로 resolveExplosion 스케줄
          → 범위 내 actors에게 피해·넉백 적용
          → 범위 내 다른 mapObject에게도 damageMapObject (재귀 연쇄는 이미 triggered set에 포함)
```

## Crate Drop Flow

```
combat-controller: bullet→crate 피격 → hp<=0
  → MapObjectRuntime이 다음 tick에 drops[]에 { type, x, y } 반환
    → map-object-controller가 PickupLogic.spawn(type, x, y) 호출
      → 기존 픽업 시스템이 pickup 상호작용·소비 처리
```

## Stage Placement (예시)

```
stage-1 (훈련장): barrel ×2, mine ×0, crate ×1
stage-2 (시가전): barrel ×4 (2 쌍 체인), mine ×3, crate ×2
stage-3 (보스):   barrel ×6 (3 쌍 체인), mine ×2, crate ×1
```

스테이지당 지뢰 상한 12, 드럼통 상한 16 — `StageContentDefinition` 검증에서 강제.

## Risks

| Risk | Mitigation |
|------|------------|
| 체인 폭발 동시 트리거로 프레임 스파이크 | `maxDepth` 5 고정 + `chainDelayMs` 150ms 순차 스케줄 → 동일 프레임 폭발 집중 차단 |
| 지뢰 근접 판정 O(mines × actors) CPU 비용 | 스테이지당 mine ≤ 12, actor ≤ 8 → 96 distance/frame 상한, 무시 가능 |
| 크레이트 drop RNG가 PickupLogic과 상태 공유 시 테스트 비결정 | Runtime rng 독립 주입, drop 결과는 {type,x,y}만 반환하고 spawn은 controller가 PickupLogic에 위임 |
| MainScene 862→900+ 라인 팽창 | 전 로직 map-object-controller로 분리, MainScene 순증 30줄 이내 목표 |
| 드럼통이 기존 엄폐 스프라이트와 시각 혼동 | Sprint 1은 primitive 색·도형 차별화. 최종 비주얼은 Phase 통합 아트 패스(별도 Phase)로 이연 |
| 공개 debug 시그니처 변경 시 E2E 계약 파손 | `debugSwapWeapon`, `debugFire`, `debugFireAt`, `debugGetRuntimeStats`, `getDebugSnapshot` 시그니처 불변. `getDebugSnapshot`만 필드 추가(하위 호환) |

## Out of Scope (Sprint 2 후보)

- 파괴 가능 엄폐물 (hp 보유 + 총알 통과 불가)
- 바운스 벽 (bounce 탄도 전용 반사 표면)
- 텔레포터 (쌍 배치, 진입 시 상대 지점으로 순간이동)
- 맵 오브젝트 전용 비주얼 에셋 (최종 아트 패스)

## References

- 이전 Sprint WBS: `./phase5-sprint1-wbs.md`
- handoff 원문: `../../../../docs/handoffs/current-handoff.json`
- 게임 방향성: `../development/game-direction.md`
- 환경·오브젝트 스펙: `../development/environment-systems.md`
- 이전 execution report: `../../../../docs/handoffs/current-execution-report.md`
