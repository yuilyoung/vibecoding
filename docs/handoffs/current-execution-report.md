# Execution Report - phase-2-sprint2-advanced-map-objects

- **Handoff ID:** phase-2-sprint2-advanced-map-objects
- **From:** ultron
- **To:** vision / pm
- **Date:** 2026-04-21
- **Status:** complete

## Summary

Phase 2 Sprint 2 Advanced Map Objects is complete. The Phaser prototype now supports destructible cover, bounce walls, and paired teleporters on top of the Sprint 1 barrel/mine/crate baseline, with pure domain logic, stage-data validation, controller rendering, combat/runtime wiring, debug hooks, and browser coverage.

## Changes

- Extended `assets/data/game-balance.json` and `scene-types.ts` with `cover`, `bounceWall`, and `teleporter` config while preserving Sprint 1 tuning.
- Expanded `MapObjectLogic`, `MapObjectRuntime`, `StageContentDefinition`, and related tests for new kinds, cooldown/durability metadata, pair validation, and conservative stage placements.
- Added pure domain modules `CoverLogic`, `BounceWallLogic`, and `TeleporterLogic`.
- Exported `ProjectileRuntime.reflectVelocity` for bounce-wall reuse.
- Expanded `MapObjectController` to render cover, bounce walls, and teleporters, preserve per-object state, and report richer debug summaries.
- Wired `combat-controller` to block bullets on active cover, reflect shots on bounce walls, and preserve existing barrel/mine/crate paths.
- Wired `MainScene` to apply teleporter movement results and expose `debugGetMapObjectStates()` / `debugGetProjectileSnapshot()` for deterministic browser checks.
- Added `tests/e2e/map-objects-sprint2.spec.ts` covering cover destruction flow, bounce-wall interaction, and teleporter cooldown behavior.

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Type check | `npm run type-check` | pass |
| Lint | `npm run lint` | pass |
| Focused tests | `npx vitest run tests/MapObjectLogic.test.ts tests/MapObjectRuntime.test.ts tests/CoverLogic.test.ts tests/BounceWallLogic.test.ts tests/TeleporterLogic.test.ts tests/StageContentDefinition.test.ts tests/StageContentSpawner.test.ts tests/ProjectileRuntime.test.ts` | pass, **8 files / 50 tests** |
| Unit tests | `npx vitest run --maxWorkers 1` | pass, **46 files / 271 tests** |
| Build | `npm run build` | pass |
| E2E | `npx playwright test --reporter=line` | pass, **20 tests** |

Build size check: largest emitted chunk is `dist/assets/phaser-gameobjects-Blmgf9UG.js` at **260.49 kB**, gzip **71.63 kB**, below the 800 kB / 250 kB thresholds.

## Risks

- Bounce-wall browser coverage currently proves durable wall interaction through reflected-wall state rather than persisting a dedicated reflected-projectile event log.
- Teleporter VFX uses the existing impact effect path; a bespoke teleport visual/audio pass remains follow-up work.
- Final authored visuals for all Sprint 1 and Sprint 2 map objects remain out of scope.

## Hotfix: Round-Reset Bullet Clear Race

### Summary

Addressed a critical freeze where round-reset logic could clear the shared bullet array while `CombatController.updateProjectiles()` was still iterating through it.

### Root Cause

`MatchFlowController` can request `clearBullets()` on the same frame that a projectile resolves a round-ending hit. The old implementation destroyed sprites and truncated `state.bullets` immediately, so the still-active projectile loop could read `undefined` and crash on `bullet.sprite`.

### Changes

- Added `pendingBulletClear` to `SceneRuntimeState` so bullet cleanup can be requested without mutating the array mid-tick.
- Changed `CombatController.clearBullets()` to mark pending cleanup only, and added `flushPendingBulletClear()` to perform the actual sprite destruction and VFX cleanup at a safe tick boundary.
- Flushed pending bullet cleanup in `MainScene` immediately after round-reset and match-confirm handling.
- Kept the `bullet === undefined` guard inside `updateProjectiles()` as a defensive fallback.
- Added `tests/CombatController.test.ts` to lock the defer-and-flush contract and the no-truncate-before-flush behavior.

### Verification

| Gate | Command | Result |
|------|---------|--------|
| Type check | `npm run type-check` | pass |
| Lint | `npm run lint` | pass |
| Unit tests | `npx vitest run --maxWorkers 1` | pass, **47 files / 273 tests** |
| Build | `npm run build` | pass |
| Focused browser regression | `npx playwright test tests/e2e/gameplay.spec.ts tests/e2e/map-objects.spec.ts tests/e2e/map-objects-sprint2.spec.ts --reporter=line` | pass, **10 tests** |
