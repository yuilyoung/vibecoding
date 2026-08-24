# Phase 12 T2 Runtime Report

- Date: 2026-08-24
- Route: `/?worldSkin=product-v1`
- Status: complete

## Delivered slice

- Added authored alpha sources for three arena-obstacle variants, closed/open service gate, active vent hazard, available ammo pickup, and available health pickup.
- Expanded the atomic world-object release from 6 families / 12 frames to 11 families / 20 stable frames in one 2048x1024 lossless WebP atlas.
- Extended the shared presentation port to `StageGeometryManager` without moving domain state, collision ownership, interaction rules, pickup respawn, audio, AI, or input behavior out of their existing owners.
- Kept `/`, explicit legacy, and unknown routes on legacy world art. The product pack remains opt-in and any incomplete or corrupt release falls all 11 families back together.
- Kept Phase 13 animation and Phase 12 T3 performance/default-promotion work out of scope.

## Release identity and budgets

| Item | Result |
| --- | --- |
| Manifest | 7,882 bytes; SHA-256 `ce0b968d9c28cc68b621b9cd77aa7507c2fc88ab57ee37f0ab9791e2b1a8dff2` |
| Atlas JSON | 7,508 bytes; SHA-256 `287710916d67ccede1a6ba1311c45e0e7329b570d6732cf80800efd1879ae9d5` |
| Atlas WebP | 492,830 bytes; SHA-256 `c17a5e23a55ee7144a099bbbf4a616ff996422d14973b59ffb82cab9f4da6e41` |
| Decoded pixels | SHA-256 `cb81d05e72e6e4d16deaf8c787bdd5bb60824a1ba81b36acbd75911af10193b9` |
| World-object transfer | 508,220 / 4,194,304 bytes |
| World-object raw RGBA | 8,388,608 / 8,388,608 bytes; mipmaps disabled |
| Actor + world transfer | 1,297,048 / 12,582,912 bytes |
| Actor + world raw RGBA | 41,943,040 / 67,108,864 bytes |

## Verification

| Gate | Result |
| --- | --- |
| Product-owner gate | approved before implementation for the exact five remaining families and three obstacle variants |
| Atlas contracts | 6/6 pass, including exact 20-frame matrix, transparent-source checks, two byte-identical clean builds, and failed-promotion rollback |
| Focused unit | 3 files / 27 tests pass for catalog, shared composition, and stage-geometry presentation |
| Full static/unit/build | type-check pass; lint pass; 63 files / 388 tests pass; 1,797-module production build pass |
| Scene budget | `MainScene.ts` 837 / 850 lines |
| Focused browser | 5/5 pass for routes, all-family state sync, gate toggle plus redeploy closure, pickup collect/reset, stage rotation, fallback, restart, and collider parity |
| Full browser | Current post-review-fix run passed 64 / 64 runnable scenarios with one intentional evidence-refresh skip; two earlier pre-fix runs each had one different pre-existing transient that passed alone |
| Visual evidence | 1/1 pass; fifteen 960x540 captures across three stages and five weather states, all 11 families, quantitative pixel checks, and zero runtime errors |

Visual capture hashes, presentation snapshots, pixel statistics, and browser metadata are recorded in `phase12-t2-visual-index.json` beside this report.

## Review correction

The first independent review found that round redeployment closed the gate domain/collider through a direct `MainScene` mutation without synchronizing the product overlay. Gate deployment now goes through `StageGeometryManager.applyGateDeployment()`, which preserves the prior legacy reset and synchronizes the shared presentation port. The unit contract now covers open-to-redeploy-close, the focused browser exercises the real team-confirm/deployment path, and the post-fix focused and full browser runs pass.

## Reliability closeout

The current-fingerprint independent re-review returned `PASS` with no blocking or material finding. Harness contracts passed 17/17, manual drift passed, diff check passed, and Codex postflight synchronized the verified handoff. T2 is complete; T3 remains the complete Phase 12 cohesion/performance closeout.
