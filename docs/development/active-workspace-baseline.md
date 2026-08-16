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
- Phase 10 keeps Ground Shaker vehicles as the default/fallback and adds opt-in `?actorSkin=kenney-infantry` using vendored CC0 static frames to prove typed five-state/eight-direction readiness, team mapping, weapon-layer policy, URL selection, and scene-lifetime cleanup.
- The current deterministic runtime baseline is type-check, lint, 58 Vitest files / 344 tests, production build, 37 Playwright scenarios, Phase 10 canvas evidence, and the `MainScene.ts` 850-line budget.
- Phase 11 Quaternius Animated Character POC is implementation-in-progress. T2 is complete: the two exact T1 Quaternius inputs now feed a pinned offline Blender 4.5.12 + Sharp 0.35.3 adapter that produces byte/pixel-identical BLUE/RED atlas releases with 176 frames/team inside the transfer/GPU budgets. Runtime integration and browser/performance/readability acceptance remain T3-T5, so the generated atlases do not change the executable runtime baseline yet.
- The Phase 11-13 Visual Productization roadmap is product-goal approved. It sequences animated characters, an authored 11-family object kit, integrated state animation, and final default promotion; it does not change the current executable baseline.

## Approved Next Direction

- Target a coherent, saleable-looking 960x540 visual vertical slice on the default `/` route rather than treating catalog or contract work as a user-visible improvement.
- Use only the T1-vendored Quaternius Universal Base Characters and Universal Animation Library free Standard inputs whose acquisition-time license evidence and SHA-256 provenance are recorded in `public/assets/source/ASSET_MANIFEST.md`.
- Integrate the completed one-command atlas release only after extracting actor presentation composition; keep the generated manifest as the Data/build boundary and do not import Blender/Python types into runtime code.
- Keep combined opt-in transfer at or below 8 MiB, raw RGBA GPU memory at or below 32 MiB, fixed-scene p95 at or below 16.7 ms, and p95 regression versus legacy at or below 1.0 ms.
- Extract actor presentation composition before runtime integration because `MainScene.ts` is 848/850 lines.
- Keep Ground Shaker as default/total fallback and require five-weather readability, console, full regression, review, drift, and postflight gates before Phase 11 completion.
- After Phase 11 passes, apply authored skins to all 11 player-visible object families in Phase 12, then add integrated state animation and promote the complete visual pack to the default route in Phase 13.
- Use `workspace/2D-FPS-game/docs/planning/phase11-13-visual-productization-roadmap.md` as the productization goal and phase-order contract.

If Unity work resumes, explicitly reconcile the root roadmap with the Phaser prototype first.
