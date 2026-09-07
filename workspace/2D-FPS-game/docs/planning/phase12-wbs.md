# Phase 12 WBS - Product V1 Authored Object Skin Kit

- Date: 2026-08-21
- Owner: product + product_owner + ultron/codex
- Status: T0-T3 complete
- Architecture: `./phase12-map-object-vertical-slice-architecture.md`
- Previous phase: `./phase11-wbs.md` (complete)

## Goal

Replace player-visible debug shapes and glyphs with one approved, coherent authored object language while preserving the verified gameplay/collision baseline and keeping the product pack opt-in until the complete visual promotion gate.

## Tasks

| ID | Work | Depends | Status |
| --- | --- | --- | --- |
| T0 | Approve the fixed 960x540 Foundry v5 target frame and six-family architecture | Phase 11 | completed |
| T1 | Generate, deterministically pack, integrate, and verify barrel/mine/crate/cover/bounce-wall/teleporter art | T0 | completed |
| T2 | Extend the same contract to arena obstacles, service gate, vent/hazard surfaces, ammo pickup, and health pickup | T1 | completed |
| T3 | Run Phase 12 full-inventory cohesion, budget, lifecycle, fallback, performance, reviewer, drift, and postflight gates | T2 | completed |

## T1 acceptance

- Exactly six families and twelve stable namespaced frames are pinned to approved v5-derived sources.
- One 1024x1024 atlas stays within 2 MiB transfer and 4 MiB raw RGBA with mipmaps disabled; two isolated builds are byte-identical and promotion is atomic.
- `?worldSkin=product-v1` is the only product-world request route. Default, explicit legacy, and unknown routes remain legacy; every validation failure is a total six-family fallback.
- Existing anchors, positions, collision rectangles, gameplay state, damage, cooldown, AI, projectile behavior, and persistence are unchanged.
- Three stages by five weather states show exact domain/overlay alignment, all six families, readable pixels, and zero console/page/request errors.
- Product presentation p95 and legacy-relative regression are each at most 0.5ms in the fixed production measurement.
- `MainScene.ts` remains at or below 850 lines and lifecycle restart leaves no orphan overlay.

## Next slice

T3 assessed and closed the complete 11-family inventory as one cohesive product slice. `product-v1` remains opt-in; object animation and default promotion remain a later Phase 13 integrated product decision.

## T2 acceptance

- Exactly eleven families and twenty stable namespaced frames are pinned to approved v5-derived sources.
- One 2048x1024 atlas stays within 4 MiB transfer and 8 MiB raw RGBA with mipmaps disabled; two isolated builds are byte-identical and promotion is atomic.
- The shared presentation boundary covers map objects and stage geometry without changing anchors, positions, collision rectangles, gameplay state, gate behavior, pickup collection/respawn, AI, audio, or input.
- `?worldSkin=product-v1` shows all eleven families without production glyphs. Default, explicit legacy, unknown, corrupt-manifest, and incomplete-atlas routes retain total legacy fallback.
- Three stages by five weather states pass with all eleven families, quantitative pixel checks, and zero console/page/request errors.
- Type-check, lint, 63 files / 388 unit tests, the 1,797-module build, focused browser contracts, the current 64/64 runnable-scenario full browser regression, and `MainScene.ts` 837/850 pass. Current-fingerprint independent re-review, harness 17/17, manual drift, diff check, and Codex postflight pass.

## T3 acceptance

- T3-only evidence paths prevent the explicit visual and performance refreshes from overwriting historical T1/T2 artifacts.
- Fifteen 960x540 captures cover all eleven families across Foundry, Relay Yard, and Storm Drain × five weather states with zero runtime errors and recorded hashes/pixel checks.
- Independent scoring passes art cohesion, actor focus, team readability, object affordance, and implemented static-state readability at a conservative minimum of 4/5.
- Twenty stage/weather transitions, corrupt/incomplete total fallback, route isolation, scene restart, gate/pickup synchronization, and legacy/product collider parity pass through focused browser contracts.
- The strict D3D11 AB-BA-AB gate passes 18,000 samples with no sample above 16.7ms, product p95 0.1ms, and negative relative regression. The preceding one-sample legacy failure remains preserved as separate evidence; no threshold changed.
- Full unit/static/build/browser, independent review, manual drift, diff check, and Codex postflight pass. Phase 13 remains unstarted.
