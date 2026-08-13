# Runtime Asset Recovery Note

Use this note when restoring playability without risky asset churn.

## Safe primary assets for current playable build

- Actor bodies
  - `sprites/player-blue.png`
  - `sprites/player-red.png`
  - `sprites/enemy-blue.png`
  - `sprites/enemy-red.png`

- Arena / terrain base
  - `sprites/ground-terrain.png`

- Team-owned world weapon presentation
  - `sprites/ground-turret-carbine-blue.png`
  - `sprites/ground-turret-carbine-red.png`
  - `sprites/ground-turret-scatter-blue.png`
  - `sprites/ground-turret-scatter-red.png`

- HUD weapon identity
  - `sprites/weapon-hud-carbine.png`
  - `sprites/weapon-hud-scatter.png`

- Generic runtime weapon parts
  - `sprites/weapon-machine.png`
  - `sprites/weapon-gun.png`

## Recovery rules

- Keep `ground-terrain.png` as the only primary floor and cover source during recovery.
- Do not introduce new color systems for neutral floor, hard cover, or gate states during gameplay restoration.
- Do not replace actor, turret, or HUD weapon assets with mixed-style placeholders while combat readability is being restored.
- Treat pickups and vent/hazard visuals as code-side presentation problems for now; no dedicated pickup or vent sprites are required to regain a stable playable build.

## Asset-side constraints gameplay should avoid

- Avoid depending on unique pickup sprites that do not exist yet.
- Avoid gameplay states that require gate-open and gate-closed to be represented by different bitmap assets.
- Avoid relying on vent/hazard-specific textures; current readability should come from decals, tint, and VFX layering.
- Avoid adding new obstacle art variants unless they stay in the same `ground-terrain` material family.
