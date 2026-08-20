# Phase 12 T1 Runtime Report

- Date: 2026-08-21
- Scope: approved v5 six-family world-object vertical slice
- Runtime route: `?worldSkin=product-v1`
- Status: implemented and deterministically verified; Phase 12 overall remains in progress

## Delivered

- Authored barrel, mine, crate, cover, bounce-wall, and teleporter presentation with two states per family.
- Pure catalog validation plus a scene-lifetime Phaser composition over unchanged anchors and colliders.
- Atomic legacy fallback for any invalid manifest, pinned target/generator/source provenance, texture, frame, dimensions, hash, or budget.
- Default, explicit legacy, and unknown world routes remain legacy; product art is still opt-in.

## Asset facts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `map-objects.webp` | 285362 | `c5598986a42ee5f6dffb992707f26dad8a3196d34b479c3055a754b2abbe86f6` |
| `map-objects.json` | 4565 | `713f8b621815cd48970748729b4f61dccd95788ce713a66d911722709b2dc18b` |
| `manifest.json` | 5097 | `25d7762bb9402ad866a4ecc6010c760eb53b29ff7329adfbf8ea4a7daf61f339` |

Strict transfer is 295024 bytes against 2097152. Raw RGBA is 4194304 bytes against 4194304, and mipmaps are disabled.

## Verification

| Gate | Result |
| --- | --- |
| source/build contract | 6/6 pass; exact alpha coverage, manifest, two byte-identical builds, and rollback |
| focused unit | 24/24 pass, including target/generator/source provenance mutation cases |
| full unit | 62 files / 385 tests pass |
| static / scene budget | type-check, lint, and `MainScene.ts` 842/850 pass |
| production build | 1797 modules transformed; pass |
| focused browser | five route/state/fallback/lifecycle/collider scenarios pass |
| visual matrix | explicit refresh 1/1 pass; 15 unique 960x540 captures, 3 stages, 5 weather states, all 6 families, zero errors |
| performance | three product captures at 0.1ms p95; three paired regressions -0.3ms to -0.5ms; pass |
| full browser | final run 64 pass / 1 intentional evidence-refresh skip |
| independent review | current manifest provenance, runtime, browser HTML, performance, LOC, and status evidence reviewed; no blocking or material finding |
| reliability closeout | Codex preflight, Hermes audit, harness contracts 17/17, diff check, manual drift, and Codex postflight pass |

Earlier full-browser attempts exposed pre-existing test scheduling gaps: deferred bullet clear could erase a newly injected wind projectile, an exact-center/delta-zero bounce probe depended on the render-loop gap, and the barrel-chain check read once after a fixed delay. The tests now flush clear immediately, cross the bounce wall from a non-overlapping start, and poll the chain result under fixed clear weather. Wind passed 15/15 repeated checks, the product state case passed 5/5 repeated checks, the barrel file passed 9/9 after its boundary correction, and the final full run passed.

## Evidence

- `phase12-t1-visual-index.json` records every screenshot hash, pixel statistics, domain count, effective skin, state, frame, and overlay position.
- `phase12-t1-world-object-performance.json` records raw 18000 browser-side samples, AB-BA-AB ordering, renderer, fixed scene, errors, limits, and verdict.
- The fifteen `phase12-t1-<stage>-<weather>.png` files are unobstructed combat-state canvas captures.

## Remaining Phase 12 work

Arena obstacles, service gates, hazard/vent surfaces, ammo pickup, and health pickup still use the earlier presentation. The complete product world pack is not promoted to `/` in T1.
