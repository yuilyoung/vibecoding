# Phase 5 Sprint 1 WBS — Critical Hit System and DamageNumber 색 구분

- Date: 2026-04-20
- Owner: ultron
- Status: complete
- Handoff: `../../../../docs/handoffs/current-handoff.json` (id: `phase-5-sprint1-crit-system`)

## Summary

Sprint 0에서 결선된 VFX 피드백의 남은 TODO(isCritical 하드코딩 false)를 해소한다. 무기 config에 crit 필드를 추가하고 `CombatResolution.resolveDamage`가 `{ damage, isCritical }`을 반환하도록 확장하며, combat-controller 5개 damage application site에서 DamageNumberRenderer까지 isCritical을 플러밍한다. 또한 자-가해(플레이어 피격) vs 적-가해(플레이어 가격) 데미지 숫자 색을 구분해 가독성을 올린다. 기존 219 유닛 + 14 E2E 회귀 없음을 유지한다.

## Pre-work: RNG 주입 계약

모든 crit 판정 도메인 함수는 `rng: () => number` 인자를 받고 기본값으로 `Math.random`을 사용한다. 테스트는 seed 고정된 stub rng를 주입해 분기 결정성을 확보한다. Phaser 의존 금지(도메인 함수는 순수 로직만).

## Tasks

| ID | Work | Approx Lines | Depends | Acceptance | Status |
|----|------|-------------|---------|-----------|--------|
| T0 | `assets/data/game-balance.json` 스키마 확장 — 무기별 `critChance` (0~1), `critMultiplier` (>=1) 필드 추가. 기본값 `critChance=0.15`, `critMultiplier=1.8`. `GameBalanceWeapons` 타입 갱신 | ~40 | — | A1 | complete |
| T1 | `CombatResolution.resolveDamage` API를 `{ damage, isCritical }` 반환으로 변경. `rng: () => number` 인자 추가 (기본 `Math.random`). `tests/CombatResolution.test.ts` 확장 + 신규 `tests/CritSystem.test.ts` — seed 고정 rng로 crit/non-crit/경계값 커버 (TDD 선행) | ~120 | T0 | A2, A8 | complete |
| T2 | `src/scenes/combat-controller.ts`의 5개 damage application site(bullet→dummy, bullet→player, explosion→dummy, explosion→player, beam hit)에서 `resolveDamage` 반환값을 분해하여 `isCritical`을 `spawnDamageNumber` 콜백까지 전달. 하드코딩 `false` 제거 | ~60 | T1 | A3, A4 | complete |
| T3 | `src/scenes/MainScene.ts`의 `spawnDamageNumber` 콜백 시그니처를 `(x, y, amount, isCritical, isSelfHarm)`로 확장. combat-controller에서 넘어온 두 플래그를 DamageNumberRenderer로 전달 | ~30 | T2 | A3, A5 | complete |
| T4 | `src/domain/feedback/DamageNumberLogic.ts`의 `resolveDamageNumber`에 `isSelfHarm` 파라미터 추가. 분기: 적-가해=white(#ffffff) / crit gold(#ffcc00), 자-가해=orange(#ff8844) / crit은 기존 crit 규칙 유지. `tests/DamageNumberLogic.test.ts` 확장 — 자-가해 색/crit 색/회귀 커버 | ~80 | T0 | A5, A6, A7, A8 | complete |
| T5 | `src/scenes/damage-number-renderer.ts` pool 용량 검토. 다탄종(스캐터+에어스트라이크) 동시 사격 시나리오에서 clip 발생 여부 계측 → 발생 시 12→20 확장. 미발생 시 현행 12 유지 + 판단 근거 코멘트 | ~20 | T3 | A?(운영) | complete |
| T6 | 검증 게이트 5종(`type-check`, `lint`, `test`, `build`, `test:e2e`) 실행 + `docs/handoffs/current-execution-report.md` 갱신 (Summary / Changes / Verification / Risks). 빌드 청크 < 800 kB, gzip < 250 kB 재확인 | — | T1~T5 | A9, A10 | complete |

Acceptance 번호는 handoff `acceptance` 배열 순서(A1=첫 항목 … A10=마지막 항목)에 대응.

## Dependency Graph

```
T0 ─┬─▶ T1 ──▶ T2 ──▶ T3 ──▶ T5 ──▶ T6
    │                      ▲
    └─▶ T4 ────────────────┘
```

T0(데이터 스키마)이 T1(도메인 API)과 T4(색 분기)의 공통 기반. T1→T2→T3는 crit 값 플러밍 체인. T4는 독립적으로 진행 가능하나 T3의 콜백 시그니처 확장과 함께 렌더러에서 합류.

## Data Schema — game-balance.json 무기 필드 확장

```jsonc
{
  "weapons": {
    "pistol": {
      "damage": 25,
      "magSize": 12,
      "reloadMs": 1200,
      "critChance": 0.15,      // [NEW] 0..1
      "critMultiplier": 1.8    // [NEW] >=1
    }
    // assault / shotgun / sniper / smg 등 전 무기 동일 필드 추가
  }
}
```

## Wiring Pattern — RNG 주입 시그니처

```ts
// src/domain/combat/CombatResolution.ts
export interface DamageResult { damage: number; isCritical: boolean; }

export function resolveDamage(
  baseDamage: number,
  critChance: number,
  critMultiplier: number,
  rng: () => number = Math.random,
): DamageResult {
  const isCritical = rng() < critChance;
  return {
    damage: isCritical ? baseDamage * critMultiplier : baseDamage,
    isCritical,
  };
}
```

```ts
// tests/CritSystem.test.ts — seed 고정
const stub = () => 0.1; // < 0.15 → crit
expect(resolveDamage(10, 0.15, 1.8, stub))
  .toEqual({ damage: 18, isCritical: true });
```

## DamageNumber 분기 매트릭스

| target | crit | 색 | 참고 |
|--------|------|-----|------|
| 적(dummy) | false | #ffffff white | 기존 회귀 |
| 적(dummy) | true | #ffcc00 gold, 18px, floatDistance 35 | handoff A4 |
| 플레이어(self-harm) | false | #ff8844 orange | handoff A5 |
| 플레이어(self-harm) | true | crit 규칙 우선(gold 18px) | A4 + A5 교차 |

## Risks

| Risk | Mitigation |
|------|------------|
| crit RNG 주입이 기존 `resolveDamage` 호출처 다수에 파급 | 기본 인자로 `Math.random` 제공 → 기존 호출처는 시그니처 호환, 테스트에서만 seed 주입 |
| 자-가해 판정 기준이 코드 전반 분산 | damage application site에서 target이 player인지 dummy인지로 결정 — combat-controller 내부 분기로 충분 |
| crit 기본값(0.15 / 1.8) 밸런스 미튜닝 | 1차 기본값 적용 후 플레이테스트 → 추후 game-balance.json만 수정 (코드 변경 없음) |
| DamageNumber pool 12 재사용 clip | T5에서 로그 계측 후 필요 시 20으로 확장, 불필요 시 현행 유지 |
| MainScene debug* E2E 계약 영향 | `debugSwapWeapon`, `debugFire`, `debugFireAt`, `debugGetRuntimeStats`, `getDebugSnapshot` 공개 시그니처 유지 — spawnDamageNumber 콜백은 내부 경로 |

## Notes — Sprint 1 Feature Plumbing

Sprint 0가 구조 분해(MainScene 865줄화) 중심이었다면, Sprint 1은 기존 인터페이스의 데이터 플로우 완결에 집중한다. `resolveDamageNumber`의 `isCritical` 파라미터는 이미 존재하나 호출측이 `false`로 고정된 상태이므로, 본 Sprint는 신규 시스템 도입이 아닌 TODO 해소 + 색 가독성 개선이다. TDD는 T1(도메인 RNG 분기)에 선행 적용하고, T4는 테스트 확장으로 회귀 방지한다.

### 참조

- 이전 Sprint WBS: `./phase5-sprint0-wbs.md`
- handoff 원문: `../../../../docs/handoffs/current-handoff.json`
- VFX 튜닝 기준값: 커밋 `f9d343a` (DamageNumber / HitFlash / LowHpVignette)
- 이전 execution report: `../../../../docs/handoffs/current-execution-report.md`
