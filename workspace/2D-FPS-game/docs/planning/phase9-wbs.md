# Phase 9 WBS - Visual Identity & Readability

- Date: 2026-08-10
- Owner: ultron/codex
- Status: complete
- Architecture: `./phase9-visual-identity-architecture.md`

## Goal

Turn the existing mechanically complete prototype into a visually coherent and immediately readable combat slice using the vendored CC0 asset library, while preserving game rules and the Ground Shaker tank identity.

## Scope

- Kenney operator portraits in the HUD and Ground Shaker tanks in the world.
- Typed, source-aware mappings for six weapon slots.
- Distinct low-contrast treatments for Foundry, Relay Yard, and Storm Drain.
- Coherent world visuals and matching legend entries for barrel, mine, crate, cover, bounce wall, and teleporter.
- Distinct, transition-safe presentation for clear, rain, fog, sandstorm, and storm.
- Automated unit/browser coverage, full quality gates, status refresh, independent review, and drift verification.

## Tasks

| ID | Work | Depends | Acceptance | Status |
| --- | --- | --- | --- | --- |
| T0 | Lock architecture, provenance, scope, and verification contract | - | A1 | completed |
| T1 | Add typed visual asset catalog and remove stale actor spritesheet configuration | T0 | A2 | completed |
| T2 | Apply Kenney portraits, Ground Shaker identity, and six weapon icon mappings | T1 | A3 | completed |
| T3 | Apply three stage surface themes and six coherent object visuals/legend entries | T1 | A4 | completed |
| T4 | Harden all five weather visuals and clear-state cleanup | T1 | A5 | completed |
| T5 | Add focused unit and Phase 9 browser coverage | T2, T3, T4 | A6 | completed |
| T6 | Run full verification, visual review, and MainScene LOC gate | T5 | A7 | completed |
| T7 | Refresh project status, execution handoff, and next-task automation | T6 | A8 | completed |
| T8 | Obtain independent review and run manual drift/postflight gates | T7 | A9 | completed |

## Dependency Graph

```text
T0 -> T1 -> T2 --\
          -> T3 ---+-> T5 -> T6 -> T7 -> T8
          -> T4 --/
```

## Out of Scope

- New vehicle physics, driving, or combat mechanics.
- New progression rules, unlock balance, networking, or save schema.
- External runtime downloads, framework migration, or replacement of Phaser.
- Changes to collision sizes, projectile mechanics, stage content counts, or combat balance.

## Verification Gates

| Gate | Command | Pass Condition |
| --- | --- | --- |
| focused unit | `npx vitest run tests/VisualAssetCatalog.test.ts tests/WeatherRenderer.test.ts --maxWorkers 1` | catalog and transition tests pass |
| phase9 browser | `npx playwright test tests/e2e/phase9-visual-identity.spec.ts --reporter=line` | visual contracts and console gate pass |
| type-check | `npm run type-check` | 0 errors |
| lint | `npm run lint` | 0 errors |
| full unit | `npx vitest run --maxWorkers 1` | all tests pass |
| build | `npm run build` | production bundle succeeds |
| full e2e | `npx playwright test --reporter=line` | all browser specs pass |
| loc | `node scripts/check-mainscene-loc.mjs` | MainScene remains within 850 lines |
| status | `npm run project-status` and `npm run next-tasks` | Phase 9 complete and next slice advances |

## Risks

- Asset-source metadata can drift if runtime copies are added without manifest updates.
- Visual differentiation can become too strong when stage and weather tint stack.
- Object composites can accidentally change collision if shape sizes are reused as bounds. Collision dimensions remain the existing constants and are verified by regression tests.

## Delivery Results

- Vendored CC0 sources were reused without network downloads; licenses and source manifests remain preserved.
- Kenney operator portraits are visible in the HUD while Ground Shaker tank bodies/turrets remain the in-world actors.
- All six configured weapons have distinct PIXWEP HUD icons plus one tested unknown-id fallback.
- Foundry, Relay Yard, and Storm Drain use distinct terrain crops and low-contrast palettes.
- Barrel, mine, crate, cover, bounce wall, and teleporter use catalog-driven composites and a matching in-game legend.
- Clear, rain, fog, sandstorm, and storm have distinct atmosphere states; clear removes particles, fog, tint, and flash.
- The stale health-pickup debug TODO and timing-sensitive browser assertions were hardened into deterministic regression checks.
- Verification: 57 unit files / 338 tests, production build, 34 Playwright tests, 3 stage screenshots, 5 weather screenshots, and MainScene 843/850 LOC passed.
- Independent reviewer, harness audit, manual drift, dashboard status, and postflight gates passed before the scoped commit.
