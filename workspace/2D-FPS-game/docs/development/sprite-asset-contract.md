# Sprite Asset Contract

The active prototype uses a typed, vendored CC0 asset contract. Runtime code must not load unrecorded sprite sheets or scatter literal asset paths across scene and HUD modules.

## Source and Runtime Roles

| Role | Source pack | Runtime paths |
| --- | --- | --- |
| World tank bodies and turrets | Ground Shaker | `public/assets/runtime/sprites/ground-*` |
| Optional static infantry contract POC | Kenney Top-down Shooter | `public/assets/runtime/sprites/actor-infantry-*` |
| Player and enemy HUD portraits | Kenney Top-down Shooter | `public/assets/runtime/sprites/player-*`, `enemy-*` |
| Six weapon HUD icons | PIXWEP | `public/assets/runtime/sprites/weapon-hud-*` |
| Arena terrain | Ground Shaker | `public/assets/runtime/sprites/ground-terrain.png` |

Source URLs, CC0 status, local source archives, and local licenses are recorded in `public/assets/source/ASSET_MANIFEST.md`. Selected runtime files are copies of vendored source assets; the source and license records must remain in the repository.

## Code Contract

- `src/domain/visual/VisualAssetCatalog.ts` owns portrait, weapon, stage, map-object, and weather presentation mappings.
- `src/domain/visual/ActorSkinCatalog.ts` owns actor skin ids, CC0 source/runtime paths, team textures, five state semantics, eight-direction readiness, scale/rotation, weapon-layer policy, and the total legacy fallback.
- Unknown weapon ids resolve to one explicit tested fallback.
- Unknown stage ids resolve to the Foundry visual theme.
- Ground Shaker tank textures remain the default collision-aligned world actors; operator portraits do not alter physics or aim geometry.
- `?actorSkin=kenney-infantry` is an opt-in static contract POC. It uses embedded-weapon Kenney frames, hides the external turret layer, and does not claim to deliver the deferred Quaternius 2.5D animation atlas.
- `assets/data/game-balance.json` contains gameplay balance only and no longer contains the unused `actorSkinSource` or `actorSpritesheetPath` fields.

## Adding an Asset

1. Confirm the source and license are redistribution-compatible.
2. Preserve the original source and license record under `public/assets/source`.
3. Copy only the selected runtime-ready file under `public/assets/runtime`.
4. Add its typed catalog mapping and deterministic fallback behavior.
5. Add a file-existence/catalog test and browser readability coverage.
