# Phase 11 WBS - Quaternius Animated Character POC

- Date: 2026-08-13
- Owner: ultron/codex
- Status: implementation in progress; T1 complete, T2-T5 pending
- Architecture: `./phase11-animated-character-poc-architecture.md`
- Previous phase: `./phase10-wbs.md` (complete)

## Goal

Produce and integrate a deterministic, opt-in, eight-direction animated infantry POC from re-verified Quaternius CC0 inputs while preserving the completed Phase 10 fallback and the Phaser gameplay baseline.

## Tasks

| ID | Work | Depends | Acceptance | Status |
| --- | --- | --- | --- | --- |
| T0 | Approve source, pipeline, animation matrix, budgets, fallback, exclusions, and verification contract | - | A1 | completed |
| T1 | Re-verify and vendor the two Quaternius free-core CC0 sources with license, URL/date, and SHA-256 provenance | T0 | A2 | completed |
| T2 | Implement pinned Blender 4.5.12 headless generation, stable packing/manifest, clean staging, and reproducibility checks | T1 | A3, A4 | pending |
| T3 | Extract actor composition, extend the catalog, and integrate opt-in animated presentation without gameplay changes | T2 | A5, A6 | pending |
| T4 | Prove animation, fallback, web budgets, performance, five-weather readability, and console cleanliness | T3 | A7 | pending |
| T5 | Run full deterministic gates, synchronize status, obtain independent review, and pass drift/postflight | T4 | A8 | pending |

## Dependency Graph

```text
T0 -> T1 -> T2 -> T3 -> T4 -> T5
```

## Acceptance Map

| ID | Acceptance |
| --- | --- |
| A1 | Product-owner-approved architecture records Quaternius CC0 source choice, 5 states x 8 directions, 176 frames/team, 128px cells, two 2048px atlases, explicit budgets, fallback, and exclusions before source or code changes. |
| A2 | Official source/license facts are re-verified at acquisition; exact free-core downloads, local license evidence, source URL/date, and SHA-256 hashes are recorded in the asset manifest. |
| A3 | `npm run assets:actor-atlas` rejects non-4.5.12 Blender, performs no network access, confines partial output to a validated staging path, and atomically promotes only a complete output. |
| A4 | Two clean generations from identical inputs are byte-identical and emit exactly 176 stable frame keys/team, at most two 2048x2048 WebP atlases, valid Phaser JSON, and complete source/generator/output hashes. |
| A5 | Actor presentation construction/lifecycle wiring is extracted before runtime integration; `MainScene.ts` remains at or below 850 lines and controller cleanup is idempotent. |
| A6 | Missing, legacy, invalid, incomplete, or over-budget animated input falls back totally to Ground Shaker; opt-in animation changes no collision, combat, balance, weather, progression, persistence, or input rule. |
| A7 | Transfer is at most 8 MiB, GPU texture memory at most 32 MiB, fixed-scene p95 is at most 16.7 ms and at most 1.0 ms slower than legacy, five states/eight directions animate correctly, aim/movement and teams remain readable in five weather states, and browser console/page errors are zero. |
| A8 | Focused and full static/unit/build/browser checks, current-fingerprint reviewer pass, manual drift, postflight, project status, handoff, and next-task output all agree that Phase 11 is complete. |

## Verification Gates

| Gate | Command or evidence | Pass condition |
| --- | --- | --- |
| source provenance | acquisition manifest + SHA-256 check | official CC0 facts re-verified; exact inputs and local evidence match hashes |
| generator version | `npm run assets:actor-atlas` | exact Blender 4.5.12 accepted; other/missing versions fail clearly |
| reproducibility | two clean generator runs + hash comparison | atlases, JSON, manifest, order, and hashes are byte-identical |
| focused unit | phase-specific catalog/manifest/animation tests | matrix, state priority, directions, fallback, counts, hashes, and budgets pass |
| static | `npm run type-check` and `npm run lint` | zero errors |
| full unit/build | `npm test` and `npm run build` | all tests and production bundle pass |
| focused browser | Phase 11 Playwright spec | state/direction/team/fallback/weather/screenshots/console gates pass |
| full browser | `npx playwright test --workers=1 --trace=off --reporter=line` | every scenario passes within bounded local disk usage |
| performance | fixed 30-second legacy and animated captures after warm-up | animated p95 <=16.7 ms and delta <=1.0 ms on the same environment |
| asset budgets | generated manifest validator | <=2 x 2048px, transfer <=8 MiB, raw RGBA GPU <=32 MiB, mipmaps disabled |
| scene budget | `node scripts/check-mainscene-loc.mjs` | `MainScene.ts` <=850 lines after composition extraction |
| reliability | harness audit, reviewer, drift, postflight | current workspace fingerprint reaches completed |

## Out of Scope

- Making animated infantry the default before the POC passes.
- More than one carbine, all-six-weapons art, cosmetics, vehicles, skin store, or persistence.
- Paid assets, normal maps, `Light2D`, live 3D, responsive-HUD work, or gameplay/balance changes.
- Increasing atlas count, dimensions, transfer, GPU, or frame-time budgets without a new product decision.

## Contract Evidence

- Phase 10 remains complete with 58 unit files / 344 tests, 37 browser scenarios, build, review, drift, and postflight previously passed.
- Current runtime assets total 31 files / 196,353 bytes; the animated POC is opt-in and measured separately.
- `MainScene.ts` is 848/850 lines, making actor composition extraction a prerequisite.
- T1 vendored the exact free Standard archives on 2026-08-17: Base Characters `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40` and Animation Library `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724`, with streamed per-entry inventories, local CC0 evidence, and independent review.
- Blender is not installed on the current PATH; this is an explicit T2 prerequisite and does not invalidate the completed T1 source/provenance gate.
