# Phase 6 Sprint 3 WBS — Weather System 완성도 + 환경 시스템 안정화

- Date: 2026-04-26
- Owner: ultron
- Status: planned
- Handoff: `../../../../docs/handoffs/current-handoff.json` (id: `phase-6-sprint3-weather-finalize`)

## Summary

Sprint 2 Weather 5종(perRound)을 기반으로 Sprint 3은 (1) MainScene 912→850줄 이하 리팩토링, (2) `rotationMode='timed'` 라운드 중 변화, (3) 지역별 weather override(`weatherZones[]`+`MapZoneLogic`), (4) 음향 큐 통합(rain/sandstorm/storm), (5) 파티클 풀링·동적 수 조정으로 frame drop <2%를 완료한다. 모든 확장은 하위 호환 우선 — `StageDefinition.weather` / `weatherZones` 모두 optional, `WeatherLogic` 기존 4함수 시그니처 불변(timed는 신규 함수 추가).

## Pre-work — 현황 분석

- **MainScene.ts**: 912줄 (Sprint 2 종료 시점, 900 캡 초과 12줄 — Sprint 3 즉시 분리 강화 필요)
- **weather-renderer.ts**: 145줄 (파티클·플래시·fog 마스크 통합)
- **WeatherLogic.ts**: 79줄 (createWeatherState/rotateWeather/resolveMovementMultiplier/resolveWindMultiplier)
- **번들**: 260.49 kB / gzip 71.63 kB (제한 800/250 kB 내 충분)
- **회귀 베이스라인**: 50 files / 298 tests + E2E 26 tests 전부 pass
- **Sprint 2 잔여 항목**: rotationMode='timed' / 지역 차등 / audio cue / 파티클 풀링 (전부 본 Sprint 처리)

## Tasks

| ID | Work | Approx Lines | Depends | Acceptance | Status |
|----|------|--------------|---------|-----------|--------|
| T0 | Sprint 3 WBS + `phase6-sprint3-tasks.json` 작성 + handoff 갱신 | ~80 | — | A1 | pending |
| T1 | MainScene 리팩토링: HUD wiring/debug snapshot/match-flow bind 헬퍼 분리 → 850줄 이하 | ~120 | — | A2 | pending |
| T2 | `game-balance.json` weather 확장: `rotationMode='timed'` 활성, `durationRangeMs` 사용, sound 채널 키 | ~40 | — | A3 | pending |
| T3 | `WeatherLogic` 확장: `tickWeatherTimer` 신규 함수 + 기존 4함수 불변 + 단위 테스트 | ~120 | T2 | A4 | pending |
| T4 | `StageDefinition.weatherZones?: WeatherZone[]` (polygon/circle + weatherType) optional + 스키마 테스트 | ~80 | T2 | A5 | pending |
| T5 | `MapZoneLogic.ts` 신규 (point-in-polygon / circle 판정 → weatherType 결정) + 단위 테스트 | ~150 | T4 | A6 | pending |
| T6 | `MatchFlowOrchestrator`: timed rotation 통합 + zone 결과 적용 + snapshot.weather global/effective 분리 | ~100 | T3, T5 | A7 | pending |
| T7 | `sound-cue-contract` 확장: weather 채널 3종(rain/sandstorm/storm) 매핑 + 우선순위 규칙 | ~60 | — | A8 | pending |
| T8 | `hud-events`/`hud-controller`: WEATHER_CHANGED → sound queue 트리거 + 중복 방지 | ~80 | T7 | A9 | pending |
| T9 | `weather-renderer` 파티클 풀링 + `particleCount` 동적 수용 + frame drop <2% | ~120 | T1 | A10 | pending |
| T10 | 단위 테스트 확장: WeatherLogic timed, MapZoneLogic, sound integration, particle pool | ~200 | T3, T5, T8, T9 | A11 | pending |
| T11 | E2E `weather-timed.spec.ts` + `weather-zone.spec.ts` + `weather-sound.spec.ts` (3 시나리오) | ~180 | T6, T8 | A12 | pending |
| T12 | 검증 게이트 5종 + `current-execution-report.md` 갱신 + postflight sync | — | T0~T11 | A13~A16 | pending |

Acceptance 번호는 handoff `acceptance` 배열 순서(A1=첫 항목 ··· A16=마지막 항목)에 1:1 대응.

## Dependency Graph

```
T0 ──► T1 ──► T9 ──┐
       │           ▼
T2 ──► T3 ──► T6 ──► T10 ──► T11 ──► T12
   └─► T4 ──► T5 ──┘                  ▲
T7 ──► T8 ─────────────────────► T10/T11
```

T1(리팩토링)은 T9(렌더 풀링) 선행. T2(스키마) 분기 → T3(timed) + T4(zones). T5는 T4 후속. T6(orchestrator 통합)이 T3+T5 합류. T7→T8 독립. T10/T11 흡수 후 T12 게이트.

## Data Schema — game-balance.json weather 확장

```jsonc
{
  "weather": {
    "enabled": true,
    "rotationMode": "timed",
    "durationRangeMs": [60000, 120000],
    "particleCountMultiplier": 1.0,
    "soundChannels": {
      "rain":      { "cue": "weather.rain.loop",      "volume": 0.6,  "fadeMs": 800 },
      "sandstorm": { "cue": "weather.sandstorm.loop", "volume": 0.7,  "fadeMs": 800 },
      "storm":     { "cue": "weather.storm.loop",     "volume": 0.65, "fadeMs": 800 }
    },
    "types": { /* Sprint 2 동일 */ }
  }
}
```

## StageDefinition.weatherZones (옵션, T4)

```ts
export interface WeatherZone {
  readonly weather: WeatherType;
  readonly shape:
    | { kind: 'circle'; cx: number; cy: number; radius: number }
    | { kind: 'polygon'; points: ReadonlyArray<readonly [number, number]> };
  readonly priority?: number; // 다중 zone 겹침 시 큰 값 우선, 기본 0
}
export interface StageDefinition {
  readonly weather?: WeatherType;
  readonly weatherZones?: ReadonlyArray<WeatherZone>;
}
```

## Domain Signatures — 신규(기존 불변)

```ts
// WeatherLogic.ts (신규)
export interface WeatherTimerState {
  readonly current: WeatherState;
  readonly elapsedMs: number;
  readonly nextRotateAtMs: number;
}
export function createWeatherTimer(initial: WeatherState, rng: () => number, config: WeatherConfig): WeatherTimerState;
export function tickWeatherTimer(prev: WeatherTimerState, dtMs: number, rng: () => number, config: WeatherConfig): WeatherTimerState;

// MapZoneLogic.ts (신규)
export function pointInPolygon(p: readonly [number, number], poly: ReadonlyArray<readonly [number, number]>): boolean;
export function pointInCircle(p: readonly [number, number], cx: number, cy: number, r: number): boolean;
export function resolveZoneWeather(
  pos: readonly [number, number],
  globalWeather: WeatherState,
  zones: ReadonlyArray<WeatherZone> | undefined,
  config: WeatherConfig
): WeatherState;
```

## Runtime Integration

```
라운드 중 (timed)
  └ MatchFlowOrchestrator.tick(dtMs)
    └ tickWeatherTimer → elapsedMs >= nextRotateAtMs 시 rotateWeather
      └ snapshot.weather.global 갱신 → WEATHER_CHANGED → sound trigger

매 프레임 (zone)
  └ effective = resolveZoneWeather(playerPos, global, stage.weatherZones, config)
    ├ envMovementMultiplier = resolveMovementMultiplier(effective)
    ├ environmentWindMultiplier = effective.windStrengthMultiplier - 1
    └ weather-renderer.applyWeather(effective) // type 변화 시에만
```

## MainScene 분리 계획 (T1)

| 분리 대상 | 추출 위치 | 목표 LOC |
|----------|----------|---------|
| HUD 이벤트 wiring | `src/scenes/main-scene-hud-bind.ts` | -25 |
| match-flow snapshot 어댑터 | `src/scenes/main-scene-match-bind.ts` | -20 |
| getDebugSnapshot 빌더 | `src/scenes/main-scene-debug.ts` | -15 |
| 입력 매핑(키 바인딩) | `src/scenes/main-scene-input.ts` | -15 |

목표: 912 → ~837줄(여유 13줄). 순수 함수/팩토리만 추출, MainScene은 thin delegator.

## TDD 전략

- **선행 테스트**: T3(timed) / T5(MapZoneLogic) / T9(파티클 풀 카운트) — Red → Green → Refactor
- **회귀 보호**: Sprint 2 `WeatherLogic.test.ts`, `weather-system.spec.ts` 전체 유지(시그니처 불변)
- **E2E**: timed 라운드 중 전환 / zone 진입 effective 변경 / sound 채널 토글

## 검증 게이트 (T12)

| Gate | Command | 통과 기준 |
|------|---------|---------|
| type-check | `npm run typecheck` | 0 errors |
| lint | `npm run lint` | 0 errors / warning 동결 |
| unit | `npm test` | 50+ files / 320+ tests pass |
| e2e | `npm run test:e2e` | 29+ tests pass (+3) |
| build | `npm run build` | bundle <800 kB, gzip <250 kB |
| **신규** perf | `npm run test:perf -- weather` | timed 전환 frame drop <2% |
| **신규** loc | `node scripts/check-mainscene-loc.mjs` | MainScene ≤850 |

## 리스크 & 완화

| Risk | Mitigation |
|------|------------|
| MainScene 850 캡 미달성 (현 912) | T1 4파일 분리(-75줄 목표). 미달 시 T9에서 추가 위임 |
| timed mid-round 회귀 | tick은 dtMs 결정적. 단일 RNG 재사용. wind/weather 기존 E2E 회귀 확인 |
| zone 판정 비용 | zones ≤8 가정, AABB 사전필터. zones 미정의 stage는 fast-path bypass |
| sound 중복 발화 | prev.type===next.type 시 무발화. fade 800ms 통일. 라운드 리셋 시 stop |
| 파티클 풀 누수 | reset 시 visible=false + position 재설정. destroy 훅 명시 |
| weatherZones 호환성 | optional. 기존 stage JSON 무수정. 신규 zone stage 1개만 신설 |
| 번들 증가 | MapZoneLogic ~150줄 + sound 매핑 ~60줄 → +6 kB 추정. 캡 충분 |

## Out of Scope (Sprint 4 예약)

- Weather 시각 폴리시 추가 레이어(리플/번개 브랜치)
- 탈것 weather 상호작용
- weather-specific 무기 반응
- 네트워크 동기화(멀티 weather 일치)
- 동적 sound 위치/팬닝

## References

- 이전 Sprint WBS: `./phase6-sprint2-wbs.md`
- 이전 Sprint Tasks: `./phase6-sprint2-tasks.json`
- handoff: `../../../../docs/handoffs/current-handoff.json`
- 환경 시스템 스펙: `../development/environment-systems.md`
- 게임 방향성: `../development/game-direction.md`
- 이전 execution report: `../../../../docs/handoffs/current-execution-report.md`
- Sprint 2 MD 보고서: `../reports/project-status.md`
