# Sound Cue Contract

This document defines the cue names for the current Phaser prototype.

## Cue Map

- `fire.carbine` for the primary rifle shot
- `fire.scatter` for the shotgun shot
- `fire.generic` for any fallback weapon fire hook
- `hit.player` when the player takes damage
- `hit.dummy` when the dummy takes damage
- `pickup.ammo` when ammo is collected
- `pickup.health` when health is collected
- `gate.open` when the gate opens
- `gate.close` when the gate closes
- `hazard.tick` when the vent hazard applies damage
- `match.confirm.ready` when the next match can be confirmed
- `match.confirm.accept` when the player starts the next match

## Intended Use

- The gameplay scene translates in-game events into these cue names and exposes the latest cue in the HUD.
- The `SoundCueLogic` helper keeps the mapping deterministic and testable.
- No audio assets are required yet; these names are the contract for future hooks.

## Notes

- The contract is intentionally small and avoids mixer or asset concerns.
- If more weapons or interactions are added later, extend the cue key union first and then add tests.
