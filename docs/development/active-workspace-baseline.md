# Active Workspace Baseline

## Purpose

This repository currently has two baselines:

1. Root `docs/`
   - Long-term product roadmap and architecture references.
   - Some documents still describe the older Unity-based 4v4 2D FPS plan.
2. `work/2D-FPS-game`
   - Active implementation and verification workspace.
   - Phaser + TypeScript + Vite + Vitest web prototype.

## Operating Rule

- Active coding, testing, build, and runtime checks use `work/2D-FPS-game`.
- Root `docs/` remains the long-term roadmap reference.
- Shared agent contracts remain rooted at `AGENTS.md` and `docs/development/`.
- If the two baselines conflict, use `work/2D-FPS-game` for implementation decisions.

## Current Prototype Status

- Movement, mouse aim, HP, stun, death, shooting, ammo, reload, pickups, rounds, match confirmation, round-start countdown, respawn pulse feedback, dummy AI, collision, generated actor skins, optional sprite-sheet import path, line-of-sight checks, weapon switching, an interactable gate, a hazard zone, cover-point visualization, AI hazard avoidance, scene-level sound cue emission, and generated audio playback are implemented in the Phaser prototype.
- Current verification baseline is `npm run type-check`, `npm run lint`, `npm test`, and `npm run build` from `work/2D-FPS-game`.
- Latest local verification passed with 9 test files and 55 tests.

## Next Direction

- Continue extending the Phaser prototype unless a deliberate migration decision is made.
- Good next candidates are authored sprite assets and browser playtest-driven balance adjustments.
- If Unity work resumes later, reconcile the root roadmap with the Phaser prototype before implementation.
