# Active Workspace Baseline

## Purpose

This repository has two complementary baselines:

1. Root `docs/`
   - Long-term product roadmap, architecture, handoff, and agent-operation references.
   - Some product documents still describe the older Unity-based 4v4 plan.
2. `workspace/2D-FPS-game`
   - Active Phaser + TypeScript + Vite implementation and verification workspace.

## Operating Rule

- Run active coding, tests, builds, and browser checks from `workspace/2D-FPS-game`.
- Use root `docs/` for long-term direction and the current handoff, not as a replacement for executable evidence.
- Keep shared agent contracts rooted at `AGENTS.md`, `docs/development/`, and the demand-loaded `codex/manuals/` catalog.
- When roadmap text conflicts with the running Phaser prototype, the active game workspace wins for implementation decisions.

## Current Prototype Status

- The prototype includes movement, aim, health/death, pickups, rounds, dummy AI, collision, line of sight, six weapons, projectile/beam/explosion/air-strike flows, tactical intent, progression/unlocks, three rotating stages, six map-object types, wind, five weather states, generated audio, and QA/debug controls.
- Phase 8 Environment Audio Polish is complete.
- Phase 9 Visual Identity & Readability is complete with deterministic verification, current-fingerprint review, manual-drift, and postflight evidence.
- Phase 9 uses a typed CC0 catalog for Kenney operator portraits, Ground Shaker world tanks/terrain, PIXWEP weapon icons, three stage treatments, six object visuals plus legend, and five transition-safe weather identities.
- Phase 10 Character Skin Foundation POC is complete with deterministic verification, current-fingerprint review, manual-drift, and postflight evidence.
- Phase 10 keeps Ground Shaker vehicles as the explicit/total fallback and retains opt-in `?actorSkin=kenney-infantry` using vendored CC0 static frames to prove typed five-state/eight-direction readiness, team mapping, weapon-layer policy, URL selection, and scene-lifetime cleanup.
- The current deterministic runtime baseline is type-check, lint, 62 Vitest files / 385 tests, production build, 64 passing Playwright scenarios plus one intentionally gated evidence refresh, and the `MainScene.ts` 850-line budget.
- Phase 11 Quaternius Animated Character POC is complete. `/` consumes the pinned BLUE/RED T2 atlases through the extracted scene-lifetime composition, plays the five-state/eight-direction matrix, preserves an independently aimed external carbine, and falls back totally to Ground Shaker when validation fails. The original absolute result remains failed at p95 16.9 ms versus 16.7 ms. After retaining every prior report, the approved final one-shot D3D11 collection passed the separate cadence exception with at least 1800 samples/capture, every p95 16.9 ms, zero frames above 25 ms, and 0.0 ms regression. Current regression, review, drift, and postflight gates passed.
- The Phase 11-13 Visual Productization roadmap is product-goal approved. It sequences animated characters, an authored 11-family object kit, integrated state animation, and final default promotion; it does not change the current executable baseline.
- The user approved Phase 12 Foundry target frame v5 on 2026-08-21. Phase 12 T1 now exposes authored barrel, mine, crate, cover, bounce-wall, and teleporter art only at `?worldSkin=product-v1`, backed by a deterministic 12-frame atlas, total fallback, exact collider parity, 15 three-stage/five-weather captures, and a passing 0.5ms p95 gate. T1 current-fingerprint review, drift, and postflight pass; Phase 12 overall remains open for five additional families.

## Approved Next Direction

- Target a coherent, saleable-looking 960x540 visual vertical slice on the default `/` route rather than treating catalog or contract work as a user-visible improvement.
- Use only the T1-vendored Quaternius Universal Base Characters and Universal Animation Library free Standard inputs whose acquisition-time license evidence and SHA-256 provenance are recorded in `public/assets/source/ASSET_MANIFEST.md`.
- Preserve the passing default-route animation/fallback, five-weather, console, transfer/GPU, product-entry, weather-audio, and final one-shot cadence evidence through T5; keep the absolute performance failure and cadence qualification as separate facts, keep the generated manifest as the Data/build boundary, and do not import Blender/Python types into runtime code.
- Keep combined opt-in transfer at or below 8 MiB, raw RGBA GPU memory at or below 32 MiB, fixed-scene p95 at or below 16.7 ms, and p95 regression versus legacy at or below 1.0 ms.
- Keep actor presentation composition extracted and enforce the `MainScene.ts` 850-line budget.
- Keep Ground Shaker as explicit/total fallback and require full regression, review, drift, and postflight gates before Phase 11 completion.
- Extend the completed six-family Phase 12 T1 slice to arena obstacles, service gate, hazard/vent surfaces, ammo pickup, and health pickup in T2, then run complete Phase 12 cohesion/closeout before Phase 13 animation and default promotion.
- Use `workspace/2D-FPS-game/docs/planning/phase11-13-visual-productization-roadmap.md` as the productization goal and phase-order contract.

If Unity work resumes, explicitly reconcile the root roadmap with the Phaser prototype first.
