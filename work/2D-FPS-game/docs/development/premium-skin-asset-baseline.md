# Premium Skin Asset Baseline

This first skin slice creates a reviewable art boundary without changing combat, collision, or map rules.

## Runtime inventory

| Surface | Current runtime asset | Source / license | Fallback |
| --- | --- | --- | --- |
| Team bodies | `sprites/ground-body-{blue,red}.png` | Ground Shaker, CC0 1.0 | Generated `skin-player-{blue,red}` texture |
| Weapon turrets | `sprites/ground-turret-*.png` | Ground Shaker, CC0 1.0 | Generated `fallback-weapon-turret` texture |
| Arena terrain | `sprites/ground-terrain.png` | Ground Shaker, CC0 1.0 | Existing scene geometry remains visible |
| Weapon art | `sprites/weapon-{gun,machine}.png` | Kenney Top-down Shooter, CC0 1.0 | Current scene weapon presentation |
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

The existing CC0 packs are already present locally, so no download was required. Dedicated pickup, gate, vent, and map-object art are deliberately deferred to later slices; their visual treatment remains code-generated while gameplay contracts stay unchanged.