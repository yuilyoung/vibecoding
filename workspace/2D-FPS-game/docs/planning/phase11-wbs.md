# Phase 11 WBS - Quaternius Animated Character POC

- Date: 2026-08-13
- Owner: ultron/codex
- Status: complete; T0-T5 passed on 2026-08-20
- Architecture: `./phase11-animated-character-poc-architecture.md`
- Previous phase: `./phase10-wbs.md` (complete)

## Goal

Produce and integrate a deterministic eight-direction animated infantry presentation from re-verified Quaternius CC0 inputs, promote it to the default browser experience after direct user feedback, and preserve the complete Phase 10 fallback and Phaser gameplay baseline.

## Tasks

| ID | Work | Depends | Acceptance | Status |
| --- | --- | --- | --- | --- |
| T0 | Approve source, pipeline, animation matrix, budgets, fallback, exclusions, and verification contract | - | A1 | completed |
| T1 | Re-verify and vendor the two Quaternius free-core CC0 sources with license, URL/date, and SHA-256 provenance | T0 | A2 | completed |
| T2 | Implement pinned Blender 4.5.12 headless generation, stable packing/manifest, clean staging, and reproducibility checks | T1 | A3, A4 | completed |
| T3 | Extract actor composition, extend the catalog, and integrate opt-in animated presentation without gameplay changes | T2 | A5, A6 | completed |
| T4 | Prove animation, fallback, web budgets, performance, five-weather readability, and console cleanliness | T3 | A7 | completed; absolute fail retained, final one-shot cadence exception qualified |
| T5 | Run full deterministic gates, synchronize status, obtain independent review, and pass drift/postflight | T4 | A8 | completed |

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
| A6 | Missing, invalid, incomplete, or over-budget animated input falls back totally to Ground Shaker; `/` requests the animated actor, explicit legacy/Kenney routes remain, and presentation changes no collision, combat, balance, weather, progression, persistence, or input rule. |
| A7 | Transfer is at most 8 MiB and GPU texture memory at most 32 MiB; fixed-scene absolute p95 at most 16.7 ms is reported independently. If that absolute gate fails on nominal 60 Hz D3D11, the explicit exception requires six 30-second captures, at least 1790 samples each, p95 at most 16.9 ms, zero frames above 25 ms, at most 1.0 ms regression, and zero runtime errors. Five states/eight directions and both teams remain readable in five weather states. |
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
| performance | fixed 30-second legacy and animated captures after warm-up | report preserves the <=16.7 ms absolute result; otherwise the approved 60 Hz D3D11 cadence exception satisfies the six-capture sample/p95/missed-refresh/error contract and delta <=1.0 ms |
| asset budgets | generated manifest validator | <=2 x 2048px, transfer <=8 MiB, raw RGBA GPU <=32 MiB, mipmaps disabled |
| scene budget | `node scripts/check-mainscene-loc.mjs` | `MainScene.ts` <=850 lines after composition extraction |
| reliability | harness audit, reviewer, drift, postflight | current workspace fingerprint reaches completed |

## Out of Scope

- Promoting the complete Phase 12/13 object-and-animation visual pack before its integrated gate; this does not prevent the user-approved early actor-only default promotion.
- More than one carbine, all-six-weapons art, cosmetics, vehicles, skin store, or persistence.
- Paid assets, normal maps, `Light2D`, live 3D, responsive-HUD work, or gameplay/balance changes.
- Increasing atlas count, dimensions, transfer, GPU, or frame-time budgets without a new product decision.

## Contract Evidence

- Phase 10 remains complete with 58 unit files / 344 tests, 37 browser scenarios, build, review, drift, and postflight previously passed.
- Current runtime assets total 31 files / 196,353 bytes; the animated POC is opt-in and measured separately.
- `MainScene.ts` is 848/850 lines, making actor composition extraction a prerequisite.
- T1 vendored the exact free Standard archives on 2026-08-17: Base Characters `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40` and Animation Library `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724`, with streamed per-entry inventories, local CC0 evidence, and independent review.
- Blender is not installed on the current PATH; this is an explicit T2 prerequisite and does not invalidate the completed T1 source/provenance gate.
- T3 added `?actorSkin=quaternius-animated`, fail-closed manifest/atlas activation, 80 team/state/direction clips, scene-lifetime composition/cleanup, and retained the complete Ground Shaker default/fallback with `MainScene.ts` at 850/850 lines; focused Phase 10/11 and the full 41-scenario Playwright suite passed.
- On 2026-08-20 direct product feedback replaced the hidden-query default policy: `/` now requests Quaternius, explicit legacy/Kenney routes remain, generated weather oscillators are disabled by the production config, and a branded PLAY/Enter path reveals the tutorial only after entry.
- T4 functional evidence passes: 15/15 acceptance, 30 unique five-weather captures, 12/12 focused production browser scenarios, 60 files/361 unit tests, static checks, build, budgets, and zero runtime errors. The absolute 16.7 ms result remains failed at 16.9 ms. The fixed schema 1.1 evaluator passes 7/7 route/order/pair/failure contracts. After preserving both the auxiliary pass and prior controlling failure, the product-owner-approved final one-shot AB/BA/AB collection passed with at least 1800 samples/capture, every p95 16.9 ms, zero frames above 25 ms, and three 0.0 ms deltas. T4 closes only through the explicit cadence exception.
- T5 passed current LOC 850/850, type-check, lint, 60 files/361 tests, 1795-module build, 7/7 evaluator contracts, 59/59 Playwright, independent review, manual drift, and Codex postflight. Phase 11 is complete; the original absolute performance failure remains part of the record.
