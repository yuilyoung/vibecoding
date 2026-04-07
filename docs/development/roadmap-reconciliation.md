# Roadmap Reconciliation

## Current Decision

The active implementation baseline is the Phaser prototype in `work/2D-FPS-game`.
The older Unity roadmap remains useful for long-term product intent, but it is not the current execution baseline.
Phaser remains the active production-candidate track until a migration gate explicitly says otherwise.

## Source Of Truth

- Gameplay implementation decisions use `work/2D-FPS-game`.
- Verification uses the prototype commands in `work/2D-FPS-game`.
- Long-term design direction remains in root `docs/`.
- If the two baselines conflict, the running Phaser prototype wins until a deliberate migration decision is made.

## Unity Roadmap Alignment

The Unity roadmap should be treated as a target-platform option, not an active implementation mandate.
Before restarting Unity work, reconcile these prototype learnings:

- Keep the current input, weapon, round, hazard, cover, and AI behavior as the behavioral baseline.
- Preserve the local playtest checklist as the acceptance baseline.
- Port only validated mechanics instead of reimplementing speculative roadmap items first.
- Treat Phaser as the production-candidate track unless the migration gate below is approved.

## Migration Gate

Do not switch active implementation away from Phaser until these are explicitly decided:

- Target runtime and distribution channel.
- Required art/audio pipeline.
- Multiplayer scope and networking model.
- Feature parity list from the Phaser prototype.
- Verification strategy for the replacement workspace.
