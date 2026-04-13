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

- Movement, mouse aim, HP, stun, death, shooting, ammo, reload, pickups, rounds, match confirmation, round-start countdown, respawn pulse feedback, dummy AI, collision, authored prototype actor sprites with generated fallback, line-of-sight checks, weapon switching, an interactable gate, a hazard zone, cover-point visualization, AI hazard avoidance, scene-level sound cue emission, and generated audio playback are implemented in the Phaser prototype.
- Current verification baseline is `npm run type-check`, `npm run lint`, `npm test`, `npm run build`, and browser e2e from `work/2D-FPS-game`.
- Latest local verification passed with 117 unit tests and 8 browser e2e tests.
- JARVIS/dashboard roadmap alignment is M0 complete and M1 Phase 1 started on the Phaser baseline.
- Phase 1 domain foundation now includes `ProjectileRuntime` trajectory handling and `ExplosionLogic` falloff/knockback resolution.
- Scene weapon flow now routes through `ProjectileRuntime`, `BeamLogic`, `AirStrikeLogic`, and `ExplosionLogic` for six active weapons: Carbine, Scatter, Bazooka, Grenade, Sniper, and Air Strike.
- `phase1-tasks.json` is synced with T1-T7 completed and T8 pending.
- Phase 1 pure combat contracts now include `BeamLogic` and `AirStrikeLogic`.

## Next Direction

- Continue extending the Phaser prototype unless a deliberate migration decision is made.
- Next implementation candidate is T8: HUD weapon slot display and active-slot highlighting for 1-6 weapons.
- Browser playtest-driven balance adjustments and final art direction decisions remain follow-up work after headed review.
- If Unity work resumes later, reconcile the root roadmap with the Phaser prototype before implementation.
