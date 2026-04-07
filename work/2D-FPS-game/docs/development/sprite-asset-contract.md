# Sprite Asset Contract

The prototype supports two actor skin sources:

- `generated`: default runtime-generated placeholder textures.
- `spritesheet`: optional authored sprite-sheet loading path.

## Configuration

The active settings live in `assets/data/game-balance.json`:

- `actorSkinSource`: set to `generated` or `spritesheet`.
- `actorSpritesheetPath`: browser path for the actor sheet, currently `/assets/sprites/actors.png`.
- `actorFrameWidth`: expected frame width.
- `actorFrameHeight`: expected frame height.

## Sprite-Sheet Layout

If `actorSkinSource` is set to `spritesheet`, `MainScene` loads `actorSpritesheetPath` as `actor-skins`.

- Frame `0`: player actor.
- Frame `1`: dummy actor.

If the spritesheet is not enabled, the generated placeholder textures remain the default path.
