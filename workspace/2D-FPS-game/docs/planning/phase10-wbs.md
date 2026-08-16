# Phase 10 WBS - Character Skin Foundation POC

- Date: 2026-08-12
- Owner: ultron/codex
- Status: complete
- Architecture: `./phase10-character-skin-architecture.md`
- Research: `./phase10-2.5d-skin-research.md`

## Goal

Prove a safe actor-skin selection and lifecycle path with vendored CC0 art while preserving the Phase 9 vehicle baseline and preparing, but not pretending to deliver, an eight-direction 2.5D atlas contract.

## Tasks

| ID | Work | Depends | Acceptance | Status |
| --- | --- | --- | --- | --- |
| T0 | Lock product scope, architecture, fallback, and verification contract | - | A1 | completed |
| T1 | Add the Phaser-independent actor skin/state/direction catalog and promote two vendored Kenney POC textures | T0 | A2, A3 | completed |
| T2 | Integrate URL selection and scene-lifetime actor presentation ownership | T1 | A4, A5 | completed |
| T3 | Add focused unit and browser automation including scene shutdown, page restart, and weather evidence | T2 | A6 | completed |
| T4 | Run full deterministic gates, refresh status/handoff, review, drift, and postflight | T3 | A7 | completed |

## Dependency Graph

```text
T0 -> T1 -> T2 -> T3 -> T4
```

## Out of Scope

- Quaternius download, Blender automation, real animation atlases, normal maps, or `Light2D`.
- Asset purchase, skin store, persistence, responsive HUD, vehicles mechanics, or progression expansion.
- Collision, balance, combat, stage content, weather rules, or input changes.

## Verification Gates

| Gate | Command | Pass condition |
| --- | --- | --- |
| focused unit | `npx vitest run tests/ActorSkinCatalog.test.ts --maxWorkers 1` | fallback, teams, assets, states, and directions pass |
| focused browser | `npx playwright test tests/e2e/phase10-character-skin.spec.ts --reporter=line` | legacy and infantry presentation, shutdown/page restart, weather, screenshots, and console gate pass |
| static | `npm run type-check` and `npm run lint` | zero errors |
| full unit/build | `npm test` and `npm run build` | all tests and production bundle pass |
| full browser | `npx playwright test --reporter=line` | all browser scenarios pass |
| scene budget | `node scripts/check-mainscene-loc.mjs` | `MainScene.ts` remains at or below 850 lines |
| reliability | harness audit, reviewer, manual drift, and postflight | current-fingerprint evidence reaches completed |

## Deferred Animated POC

The next slice must vendor an approved CC0 source, automate Blender-to-atlas output, implement actual idle/run/fire/hit/death clips in eight directions, and set bundle, GPU-memory, frame-time, readability, and license acceptance budgets.

## Verification Evidence

- Focused actor catalog: 1 file / 6 tests passed.
- Full unit: 58 files / 344 tests passed.
- Focused Phase 3 + Phase 10 browser: 4 / 4 passed after deterministic pickup reset hardening.
- Full browser: 37 / 37 passed with one worker and trace retention disabled to respect the local disk budget.
- Type-check, lint, production build, `git diff --check`, and `MainScene.ts` 848/850 passed.
- Phase 10 canvas evidence captured for RED infantry under storm weather.
