# Premium Skin Asset Baseline

This first skin slice creates a reviewable art boundary without changing combat, collision, or map rules.

## Runtime inventory

| Surface | Current runtime asset | Source / license | Fallback |
| --- | --- | --- | --- |
| Team bodies | `sprites/kenney-{player-blue,enemy-red}.png` | Kenney Top-down Shooter, CC0 1.0 | Ground Shaker body, then generated `skin-player-*` |
| Weapon turrets | `sprites/ground-turret-*.png` | Ground Shaker, CC0 1.0 | Generated `fallback-weapon-turret` texture |
| Arena terrain | `sprites/kenney-floor-tile.png` plus `ground-terrain.png` | Kenney Top-down Shooter + Ground Shaker, CC0 1.0 | Existing scene geometry remains visible |
| Weapon art | `sprites/kenney-weapon-{carbine,scatter}.png` | Kenney Top-down Shooter, CC0 1.0 | Existing turret/fire presentation |
| HUD frames/bars | `ui/panel-*.png`, `ui/bar-*.png` | Kenney UI Pack Sci-fi, CC0 1.0 | CSS gradients and panels |
| Fonts | `fonts/Kenney-Future*.ttf` | Kenney UI Pack Sci-fi, CC0 1.0 | System sans-serif stack |

Source packs, local license files, and provenance are recorded in [ASSET_MANIFEST.md](../../public/assets/source/ASSET_MANIFEST.md). Runtime code must reference copies under `public/assets/runtime`, never a network URL or an unreviewed source file.

## Loading contract

`runtime-asset-contract.ts` is the single preload manifest for world art. Every declared path is local and every actor/turret art path has a generated fallback selected only when Phaser does not register the primary texture. This makes a failed or omitted optional art file a visual degradation, not a scene boot failure.

When adding an asset:

1. Keep the original pack and license in `public/assets/source`.
2. Copy only the selected runtime file to `public/assets/runtime`.
3. Add its local path and fallback behavior to the runtime manifest.
4. Update this inventory and run `npm test` plus `npm run type-check`.

## Scope of this slice

The official Kenney pack is already present locally with its original CC0 license, so this slice promotes reviewed files from that source rather than duplicating a download. It applies Kenney actors, weapon HUD icons, tiled arena treatment, and crate/barrel overlays. Dedicated pickup, gate, and vent art remain deferred; their gameplay contracts stay unchanged.