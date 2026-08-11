# Runtime Asset Direction

This note defines the intended runtime art mapping for the current top-down brawler prototype so free assets read as one game instead of mixed placeholders.

## Current asset family map

- Floor / arena base
  - `sprites/ground-terrain.png`
  - Use for arena floor crops, lane fills, spawn-side tint support, and neutral center-ground treatment.
  - Keep floor lower-contrast than actors, cover, pickups, and hazards.

- Hard cover
  - `sprites/ground-terrain.png` crops currently used by obstacle builders in runtime code
  - Present these as solid collision objects with the same top-face family as the arena floor, but with stronger edge contrast and a consistent shadow treatment.
  - Avoid mixing debug-style white outlines with unrelated material colors.

- Gate / movable cover
  - Gate presentation should stay in the same terrain family as hard cover, but read as interactive service cover instead of permanent wall.
  - Visual rule: same material family as cover, clearer trim/accent, lighter blocking weight when open.

- Vent / hazard lane
  - No dedicated vent sprite family is established yet.
  - Until dedicated art exists, vent/hazard zones should read as authored floor decals layered on top of the floor family, not as independent neon geometry.
  - Keep hazard accents saturated and readable, but subordinate to actor silhouettes.

- Pickups
  - No dedicated pickup sprite family is established yet.
  - Current health/ammo pickups should move toward a single collectible family with:
    - compact silhouette
    - bright top read
    - small grounded shadow
    - color split by function only
  - Avoid relying on tiny world text for recognition.

- Weapon families
  - HUD icons
    - `sprites/weapon-hud-carbine.png`
    - `sprites/weapon-hud-scatter.png`
    - `sprites/weapon-hud-bazooka.png`
    - `sprites/weapon-hud-grenade.png`
    - `sprites/weapon-hud-sniper.png`
    - `sprites/weapon-hud-air-strike.png`
  - World-mounted/team weapon presentation
    - `sprites/ground-turret-carbine-blue.png`
    - `sprites/ground-turret-carbine-red.png`
    - `sprites/ground-turret-scatter-blue.png`
    - `sprites/ground-turret-scatter-red.png`
  - Generic runtime weapon parts
    - `sprites/weapon-machine.png`
    - `sprites/weapon-gun.png`
  - Carbine and scatter should each keep one visual language across HUD icon, world turret, projectile tint, and impact feedback.

- Actor identity
  - Ground Shaker tank bodies and turrets remain the world actors.
  - Kenney Top-down Shooter operator sprites are used as player/enemy HUD portraits.
  - This separation keeps collision and aim silhouettes stable while adding recognizable character identity.

- Source policy
  - Runtime paths resolve through `src/domain/visual/VisualAssetCatalog.ts`.
  - Kenney Top-down Shooter, Ground Shaker, and PIXWEP provenance remains recorded in `../source/ASSET_MANIFEST.md`.
  - All selected packs are CC0; original source and local license records remain vendored.

## Consistency rules

- Actors must remain the highest-contrast moving read on the map.
- Floor should support readability, not compete with cover or pickups.
- Cover, gate, and vent should feel like one authored arena kit, not three separate styles.
- Pickups should be brighter than floor but simpler than actors.
- Blue/red team accents should appear on team-owned props and weapon families, not across every neutral object.

## Remaining bounded asset work

- Add dedicated pickup sprites under `sprites/` for ammo and health.
- Replace generated pickup, gate, and vent presentation only when a future slice includes an authored sprite family with equivalent automated readability coverage.
