# Phase 12 WBS - Product V1 Authored Object Skin Kit

- Date: 2026-08-21
- Owner: product + product_owner + ultron/codex
- Status: T0-T1 complete; T2 is next
- Architecture: `./phase12-map-object-vertical-slice-architecture.md`
- Previous phase: `./phase11-wbs.md` (complete)

## Goal

Replace player-visible debug shapes and glyphs with one approved, coherent authored object language while preserving the verified gameplay/collision baseline and keeping the product pack opt-in until the complete visual promotion gate.

## Tasks

| ID | Work | Depends | Status |
| --- | --- | --- | --- |
| T0 | Approve the fixed 960x540 Foundry v5 target frame and six-family architecture | Phase 11 | completed |
| T1 | Generate, deterministically pack, integrate, and verify barrel/mine/crate/cover/bounce-wall/teleporter art | T0 | completed |
| T2 | Extend the same contract to arena obstacles, service gate, vent/hazard surfaces, ammo pickup, and health pickup | T1 | pending |
| T3 | Run Phase 12 full-inventory cohesion, budget, lifecycle, fallback, performance, reviewer, drift, and postflight gates | T2 | pending |

## T1 acceptance

- Exactly six families and twelve stable namespaced frames are pinned to approved v5-derived sources.
- One 1024x1024 atlas stays within 2 MiB transfer and 4 MiB raw RGBA with mipmaps disabled; two isolated builds are byte-identical and promotion is atomic.
- `?worldSkin=product-v1` is the only product-world request route. Default, explicit legacy, and unknown routes remain legacy; every validation failure is a total six-family fallback.
- Existing anchors, positions, collision rectangles, gameplay state, damage, cooldown, AI, projectile behavior, and persistence are unchanged.
- Three stages by five weather states show exact domain/overlay alignment, all six families, readable pixels, and zero console/page/request errors.
- Product presentation p95 and legacy-relative regression are each at most 0.5ms in the fixed production measurement.
- `MainScene.ts` remains at or below 850 lines and lifecycle restart leaves no orphan overlay.

## Next slice

T2 should reuse the approved projection, material, outline, shadow, palette, manifest, fallback, and composition boundaries. It must not promote `product-v1` to `/`; default promotion remains a later integrated product decision.
