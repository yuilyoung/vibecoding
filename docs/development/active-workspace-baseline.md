# Active Workspace Baseline

## Purpose

This repository has two complementary baselines:

1. Root `docs/`
   - Long-term product roadmap, architecture, handoff, and agent-operation references.
   - Some product documents still describe the older Unity-based 4v4 plan.
2. `work/2D-FPS-game`
   - Active Phaser + TypeScript + Vite implementation and verification workspace.

## Operating Rule

- Run active coding, tests, builds, and browser checks from `work/2D-FPS-game`.
- Use root `docs/` for long-term direction and the current handoff, not as a replacement for executable evidence.
- Keep shared agent contracts rooted at `AGENTS.md`, `docs/development/`, and the demand-loaded `codex/manuals/` catalog.
- When roadmap text conflicts with the running Phaser prototype, the active game workspace wins for implementation decisions.

## Current Prototype Status

- The prototype includes movement, aim, health/death, pickups, rounds, dummy AI, collision, line of sight, six weapons, projectile/beam/explosion/air-strike flows, tactical intent, progression/unlocks, three rotating stages, six map-object types, wind, five weather states, generated audio, and QA/debug controls.
- Phase 8 Environment Audio Polish is complete.
- Phase 9 Visual Identity & Readability is complete with deterministic verification, current-fingerprint review, manual-drift, and postflight evidence.
- Phase 9 uses a typed CC0 catalog for Kenney operator portraits, Ground Shaker world tanks/terrain, PIXWEP weapon icons, three stage treatments, six object visuals plus legend, and five transition-safe weather identities.
- The current deterministic baseline is type-check, lint, 57 Vitest files / 338 tests, production build, 34 Playwright scenarios, Phase 9 screenshot evidence, and the `MainScene.ts` 850-line budget.

## Next Direction

- Select one bounded Phase 10 slice: authored interactable art, drivable vehicles, progression/campaign, or accessibility/responsive HUD.
- Require a new product-owner scope and architecture contract before implementing the selected Phase 10 slice.
- If Unity work resumes, explicitly reconcile the root roadmap with the Phaser prototype first.
