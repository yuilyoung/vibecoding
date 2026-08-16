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

5. `quaternius-universal-base-characters`
Official source: https://quaternius.com/packs/universalbasecharacters.html
Official download page: https://quaternius.itch.io/universal-base-characters
Direct file request: https://quaternius.itch.io/universal-base-characters/file/15861669?source=game_download
Acquired: 2026-08-17 (Asia/Seoul)
Downloaded file: `quaternius-universal-base-characters/Universal Base Characters[Standard].zip`
Original filename: `Universal Base Characters[Standard].zip`
Bytes: `128968391`
SHA-256: `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40`
License: CC0 1.0 Universal / Public Domain Dedication
Local license evidence: `quaternius-universal-base-characters/LICENSE.from-archive.txt`
Provenance: `quaternius-universal-base-characters/PROVENANCE.md`
Entry inventory: `quaternius-universal-base-characters/CONTENTS.sha256` (`38fd855a356379b2dd0bd32c389c997e8fc6a8d9e16ce1a89bcc80833ac192f9`)

Verified contents:
- Free Standard upload, itch.io upload ID `15861669`
- 112 file entries: 26 FBX, 18 glTF, 18 BIN, 48 PNG, and 2 TXT
- Sorted per-entry inventory records normalized path, uncompressed bytes, and SHA-256 for all 112 files
- Official-page snapshot and canonical CC0 legal code are stored beside the archive with their hashes in `PROVENANCE.md`

6. `quaternius-universal-animation-library`
Official source: https://quaternius.com/packs/universalanimationlibrary.html
Official download page: https://quaternius.itch.io/universal-animation-library
Direct file request: https://quaternius.itch.io/universal-animation-library/file/17958403?source=game_download
Acquired: 2026-08-17 (Asia/Seoul)
Downloaded file: `quaternius-universal-animation-library/Universal Animation Library[Standard].zip`
Original filename: `Universal Animation Library[Standard].zip`
Bytes: `15904933`
SHA-256: `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724`
License: CC0 1.0 Universal / Public Domain Dedication
Local license evidence: `quaternius-universal-animation-library/LICENSE.from-archive.txt`
Provenance: `quaternius-universal-animation-library/PROVENANCE.md`
Entry inventory: `quaternius-universal-animation-library/CONTENTS.sha256` (`237b76b03ee017fce45b34fafca61f68466d6061a276c9f8b4cff91b5b9cb98a`)

Verified contents:
- Free Standard upload, itch.io upload ID `17958403`
- 9 file entries: 2 FBX, 2 GLB, 3 PNG, and 2 TXT
- Sorted per-entry inventory records normalized path, uncompressed bytes, and SHA-256 for all 9 files
- Official-page snapshot and canonical CC0 legal code are stored beside the archive with their hashes in `PROVENANCE.md`

## Notes

- Kenney UI and weapon icons are already used at runtime.
- Ground Shaker body and turret sprites are now copied into `public/assets/runtime/sprites`.
- PIXWEP HUD weapon icons are now copied into `public/assets/runtime/sprites`.
- Quaternius Phase 11 inputs remain source-only; no Blender output or runtime actor atlas is included in this T1 acquisition.
- Keep the original license files in place.
- Prefer copying selected runtime-ready files into a dedicated game-facing path before integrating them in code.
