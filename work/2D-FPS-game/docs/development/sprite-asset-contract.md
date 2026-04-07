# Sprite Asset Contract

The prototype supports two actor skin sources:

- `spritesheet`: default authored prototype sprite-sheet loading path.
- `generated`: runtime-generated placeholder texture fallback.

## Configuration

The active settings live in `assets/data/game-balance.json`:

- `actorSkinSource`: set to `generated` or `spritesheet`.
- `actorSpritesheetPath`: browser path for the actor sheet, currently `/assets/sprites/actors.png`.
- `actorFrameWidth`: expected frame width.
- `actorFrameHeight`: expected frame height.
- Active prototype asset: `public/assets/sprites/actors.png`.

## Sprite-Sheet Layout

If `actorSkinSource` is set to `spritesheet`, `MainScene` loads `actorSpritesheetPath` as `actor-skins`.

- Frame `0`: player actor.
- Frame `1`: dummy actor.

If the spritesheet is not enabled, the generated placeholder textures remain the fallback path.

## Authored Prototype Sheet

The current sheet is a deterministic prototype asset, not final production art.
It provides two compact top-down actor frames for gameplay readability:

- Blue actor: player.
- Red actor: dummy enemy.
