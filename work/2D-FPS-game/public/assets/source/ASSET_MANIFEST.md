# Free Asset Manifest

This project now includes free third-party source assets for the Phaser FPS prototype.

## Source Packs

1. `kenney-top-down-shooter`
Source: https://www.kenney.nl/assets/top-down-shooter
Downloaded file: `downloads/kenney_top-down-shooter.zip`
License: CC0 1.0
Local license file: `kenney-top-down-shooter/License.txt`

Recommended use:
- Player and dummy character sprites
- Weapon pickup or weapon icon replacements
- Arena props such as crates, barrels, and top-down shooter scenery

Notable files:
- Character sprites such as `manBlue_stand.png`, `manBrown_stand.png`, `hitman1_stand.png`
- Weapon sprites such as `weapon_gun.png`, `weapon_machine.png`, `weapon_silencer.png`

2. `kenney-ui-pack-sci-fi`
Source: https://www.kenney.nl/assets/ui-pack-sci-fi
Downloaded file: `downloads/kenney_ui-pack-sci-fi.zip`
License: CC0 1.0
Local license file: `kenney-ui-pack-sci-fi/License.txt`

Recommended use:
- HUD panel frames
- Ammo and health bars
- Match confirmation and deployment overlays
- Buttons and chips for future menu screens

Notable files:
- Panel and bar images such as `bar_round_gloss_large.png`
- Included fonts: `Kenney Future.ttf`, `Kenney Future Narrow.ttf`

3. `ground-shaker`
Source: https://zintoki.itch.io/ground-shaker
Downloaded file: `downloads/ground_shaker_asset.zip`
License: CC0 1.0

Recommended use:
- Top-down player and enemy tank bodies
- Turret sprites for weapon-state swaps
- Terrain sheets and tower-wall tiles for future arena props

Notable files:
- `Blue/Bodies/body_tracks.png`, `Red/Bodies/body_tracks.png`
- `Blue/Weapons/turret_01_mk2.png`, `Red/Weapons/turret_01_mk2.png`
- `Blue/Weapons/turret_02_mk2.png`, `Red/Weapons/turret_02_mk2.png`
- `Terrains/terrain.png`

4. `pixwep`
Source: https://zintoki.itch.io/pixwep
Downloaded file: `downloads/PIXWEP.zip`
License: CC0 1.0

Recommended use:
- HUD weapon icons
- Future inventory/loadout weapon cards
- Projectile family differentiation for laser, plasma, and ballistic classes

Notable files:
- `body/body_laser_01.png`
- `body/body_projectile_03.png`
- `body/body_plasma_01.png`
- modular barrel, stock, and scope folders for future composition

## Notes

- Kenney UI and weapon icons are already used at runtime.
- Ground Shaker body and turret sprites are now copied into `public/assets/runtime/sprites`.
- PIXWEP HUD weapon icons are now copied into `public/assets/runtime/sprites`.
- Keep the original license files in place.
- Prefer copying selected runtime-ready files into a dedicated game-facing path before integrating them in code.
