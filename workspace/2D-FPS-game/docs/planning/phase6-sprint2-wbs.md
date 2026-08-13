# Phase 6 Sprint 2 WBS — Weather System (환경 시스템 2/2)

- Date: 2026-04-22
- Owner: ultron
- Status: planned
- Handoff: `../../../../docs/handoffs/current-handoff.json` (id: `phase-6-sprint2-weather-system`)

## Summary

`game-direction.md` Phase 3 '환경 시스템' 중 Sprint 1에서 Wind를 완료했고, Sprint 2에서 Weather 5종(clear/rain/fog/sandstorm/storm)을 도입한다. WeatherLogic 순수 도메인이 상태/보정 규칙을 제공하며 MatchFlowOrchestrator가 라운드 시작 시 선정한다. PlayerLogic은 movementMultiplier를 env 배수로 수용하고, combat-controller는 sandstorm에서 wind를 증폭하고 rain에서 mine을 비활성화한다. MainScene은 weather-renderer 헬퍼로 파티클/오버레이/플래시/fog 마스크를 분리한다. Sprint 1 잔여 리스크였던 Wind rotation RNG 결정화도 본 스프린트에서 해결한다.

## Pre-work — 설계 계약

- **순수 도메인**: `WeatherLogic`은 Phaser 의존 금지. stateless 순수 함수(createWeatherState / rotateWeather / resolveMovementMultiplier / resolveWindMultiplier).
- **RNG 주입**: `rotateWeather(prev, rng, config)` — MatchFlowOrchestrator 주입 rng 재사용. Math.random 제거.
- **밸런스 데이터**: weather 5종의 movementMultiplier/visionRange/windStrengthMultiplier/minesDisabled/weight는 `game-balance.json` weather 섹션.
- **렌더 책임**: MainScene은 `weather-renderer.ts` 인스턴스 훅만 호출. 파티클/오버레이/플래시/fog 마스크 로직은 전량 weather-renderer 내부.
- **통신 경로**: round snapshot.weather → match-flow-controller → hud-controller(WEATHER_CHANGED) + combat-controller(state.currentWeather) + weather-renderer.apply.
- **하위 호환**: PlayerLogic.move의 envMovementMultiplier는 optional, 기본값 1.0. 기존 호출부·테스트 무변경.

## Tasks

| ID | Work | Approx Lines | Depends | Acceptance | Status |
|----|------|--------------|---------|-----------|--------|
| T0 | `game-balance.json` weather 섹션 + `GameBalanceWeather` 타입 + `StageDefinition.weather?` optional | ~80 | — | A1 | pending |
| T1 | `WeatherLogic.ts` 순수 함수 4종 + `tests/WeatherLogic.test.ts` (TDD, stub rng) | ~140 | T0 | A2 | pending |
| T2 | Wind rotation RNG 결정화 — MatchFlowOrchestrator Math.random 제거 + 주입 rng 통일 | ~40 | — | A3 | pending |
| T3 | MatchFlowOrchestrator weather 선정 + stage.weather override + round snapshot.weather | ~70 | T1, T2 | A4 | pending |
| T4 | PlayerLogic.move envMovementMultiplier + scene-runtime-state.currentWeather + combat-controller 결선 | ~90 | T1, T3 | A5 | pending |
| T5 | MapObjectRuntime rain mines 비활성 + ProjectileRuntime environmentWindMultiplier + sandstorm 전파 | ~100 | T1, T4 | A6 | pending |
| T6 | hud-events WEATHER_CHANGED + hud-presenters 아이콘 + Wind 화살표 아트 폴리시 | ~110 | T3 | A7 | pending |
| T7 | `weather-renderer.ts` 신규 + MainScene 통합 + getDebugSnapshot.weather | ~180 | T4, T5, T6 | A8, A9 | pending |
| T8 | E2E `tests/e2e/weather-system.spec.ts` 3 시나리오 + 단위 테스트 확장 | ~180 | T7 | A10, A11 | pending |
| T9 | 검증 게이트 5종 + `current-execution-report.md` 갱신 + postflight sync | — | T0~T8 | A12~A15 | pending |

Acceptance 번호는 handoff `acceptance` 배열 순서(A1=첫 항목 ··· A15=마지막 항목)에 1:1 대응.

## Dependency Graph

```
T0 ──► T1 ──┬─► T3 ──┬─► T4 ──┬─► T5 ──► T7 ──► T8 ──► T9
T2 ─────────┘        ├─► T6 ──┘          ▲
                     └──────────────────► T7 (T6 depend)
```

T0(밸런스 키마)가 T1 기반. T2는 독립 진행 가능하며 T3 진입 전 통합. T1+T2+T3 이후 T4(PlayerLogic+combat) 와 T6(HUD)이 분기. T5는 T4 이후 트리거 연결. T7(렌더)가 T4/T5/T6를 통합 소비. T8(테스트)이 최종 회귀 확인 후 T9 게이트.

## Data Schema — game-balance.json weather 섹션

```jsonc
{
  "weather": {
    "enabled": true,
    "rotationMode": "perRound",       // "perRound" | "static" | "timed"
    "durationRangeMs": [60000, 120000], // timed 모드 예약(Sprint 2는 perRound만)
    "types": {
      "clear":     { "weight": 3, "movementMultiplier": 1.00, "visionRange": 300, "windStrengthMultiplier": 1.0, "minesDisabled": false, "particleCount": 0 },
      "rain":      { "weight": 2, "movementMultiplier": 0.85, "visionRange": 300, "windStrengthMultiplier": 1.0, "minesDisabled": true,  "particleCount": 50 },
      "fog":       { "weight": 2, "movementMultiplier": 1.00, "visionRange": 150, "windStrengthMultiplier": 1.0, "minesDisabled": false, "particleCount": 0 },
      "sandstorm": { "weight": 1, "movementMultiplier": 0.95, "visionRange": 220, "windStrengthMultiplier": 2.0, "minesDisabled": false, "particleCount": 30 },
      "storm":     { "weight": 1, "movementMultiplier": 0.90, "visionRange": 260, "windStrengthMultiplier": 1.0, "minesDisabled": false, "particleCount": 0, "flashIntervalMs": 5000 }
    }
  }
}
```

## Domain Signatures

```ts
// src/domain/environment/WeatherLogic.ts
export type WeatherType = 'clear' | 'rain' | 'fog' | 'sandstorm' | 'storm';

export interface WeatherState {
  readonly type: WeatherType;
  readonly movementMultiplier: number;
  readonly visionRange: number;
  readonly windStrengthMultiplier: number;
  readonly minesDisabled: boolean;
}

export interface WeatherConfig {
  readonly rotationMode: 'perRound' | 'static' | 'timed';
  readonly types: Readonly<Record<WeatherType, Readonly<WeatherTypeConfig>>>;
}

export function createWeatherState(type: WeatherType, config: WeatherConfig): WeatherState;
export function rotateWeather(previous: WeatherState | null, rng: () => number, config: WeatherConfig): WeatherState;
export function resolveMovementMultiplier(weather: WeatherState): number;
export function resolveWindMultiplier(weather: WeatherState): number;
```

## Runtime Integration

```
라운드 시작
  └ MatchFlowOrchestrator.start/reset
    └ stage.weather 있으면 createWeatherState, 없으면 rotateWeather(prev, rng, config)
      └ round snapshot.weather 갱신
        └ match-flow-controller 수신
          ├ hud-controller: WEATHER_CHANGED 이벤트 → weather 아이콘 전환
          ├ combat-controller: state.currentWeather 갱신
          └ weather-renderer: applyWeather(state.currentWeather)
              └ rain=수직 라인 파티클, sandstorm=수평 모래, storm=주기 플래시, fog=visionRange 원형 마스크

매 프레임
  ├ player.move(input, dt, t, envMovementMultiplier=resolveMovementMultiplier(weather))
  ├ combat.updateProjectiles: windEnv = weather.windStrengthMultiplier
  │   └ ProjectileRuntime.stepProjectile({ windX, windY, environmentWindMultiplier: windEnv - 1 })
  │       ├ arc/bounce: velocity += wind * (weapon.windMultiplier + environmentWindMultiplier) * dt
  │       └ linear/beam/homing: velocity += wind * environmentWindMultiplier * dt
  └ map.update: mine 트리거 진입 시 weather.minesDisabled면 skip
```

## HUD Layout

```
┌────────────────────────── HUD ───────────────────────────┐
│ HP XP LV                            [WIND ▲ ●●○] [☁ fog] │
│                                         ↑          ↑     │
│                                   방향+강도   날씨 아이콘  │
└──────────────────────────────────────────────────────────┘
```

- 날씨 아이콘: 24px, 타입별 심볼(clear=☀, rain=☂, fog=☁, sandstorm=≈, storm=⚡)
- 위치: WIND 우측 인접 — 기존 XP/unlock/boss overlay와 비충돌
- Wind 화살표 아트 폴리시: 외곽선 2px, 색 cyan→yellow→red 그라데이션 개선, pip 명도 통일

## Weather Renderer Contract

```ts
// src/scenes/weather-renderer.ts
export interface WeatherRendererOptions {
  scene: Phaser.Scene;
  getCamera: () => Phaser.Cameras.Scene2D.Camera;
  depth: { particles: number; fog: number; flash: number };
}

export class WeatherRenderer {
  applyWeather(state: WeatherState): void;     // 전환 시 호출
  update(deltaMs: number): void;                 // 매 프레임 훅
  destroy(): void;
}
```

- MainScene: `this.weatherRenderer = new WeatherRenderer({...})` + `update()` 훅 호출 + round snapshot 수신 시 `applyWeather()` 위임.
- MainScene 증가 +20줄 이내 목표 (현재 877 → 900 캡 준수).

## Weather Rotation Policy

- **perRound** (Sprint 2 기본): 매 라운드 `weight` 가중치 기반 샘플링(rng 주입). 이전 weather와 동일하면 재샘플(최대 2회).
- **static**: stage.weather override 전용. 로테이션 없음.
- **timed** (Sprint 3 예약): `durationRangeMs` 내 경과 시 rotateWeather 트리거. Sprint 2 키만 노출, 구현은 Sprint 3.

## Risks

| Risk | Mitigation |
|------|------------|
| MainScene 900줄 캡 위반 (현 877) | weather-renderer.ts 분리 — MainScene은 생성자/update/applyWeather 위임만 추가. 초과 시 헬퍼 추가 분리 |
| PlayerLogic.move 시그니처 변경 회귀 | envMovementMultiplier optional + 기본 1.0. 기존 PlayerLogic.test.ts 전체 유지, 추가 케이스만 도입 |
| fog 오버레이와 HUD 렌더 순서 충돌 | fog depth = 맵 위·HUD 아래. 단일 BlendMode.ERASE 원형 마스크, 카메라 scroll 추종. HUD presenters는 depth 고정 |
| sandstorm wind 증폭이 기존 bazooka/grenade 튜닝 변화 | environmentWindMultiplier는 별도 필드. arc/bounce=(weapon+env), linear/beam/homing=env 단독. 기본 weather에서 env=0 |
| rain mine 비활성이 기존 mine E2E 간섭 | 기본 stage weather='clear' → 영향 0. rain 전용 신규 E2E만 비폭발 확인 |
| 파티클 성능 부하 | particleCount game-balance 노출로 튜닝 가능. rain≤50/sandstorm≤30, storm은 flash만 |
| Wind RNG 결정화 중 기존 wind E2E 파손 | Math.random fallback 1 지점 → rng 필수 전환. 주입 포인트 MainScene 생성부로 이전. wind-system.spec.ts 회귀 확인 |

## Out of Scope (Sprint 3 예약)

- Weather rotationMode=`timed` (라운드 중간 변화)
- 지역별 Weather 차등(맵 존별 다른 weather) — 단일 글로벌 weather만
- Weather audio cue (빗소리/천둥/바람) — sounder 별도 스프린트
- Weather 아트 폴리시 추가 레이어(레인 물방울 리플, 번개 브랜치 이펙트)
- 탈것(Phase 5) weather 상호작용
- Weather-specific 무기 반응(rain 시 화염계 데미지 감소 등)

## References

- 이전 Sprint WBS: `./phase6-sprint1-wbs.md`
- 이전 Sprint Tasks: `./phase6-sprint1-tasks.json`
- handoff 전문: `../../../../docs/handoffs/current-handoff.json`
- 환경 시스템 스펙: `../development/environment-systems.md`
- 게임 방향성: `../development/game-direction.md`
- 이전 execution report: `../../../../docs/handoffs/current-execution-report.md`
- Sprint 1 MD 보고서: `../reports/project-status.md`
