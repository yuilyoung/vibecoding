# Playtest Log

## 2026-04-08 Automated Smoke

Scope:

- Confirm the authored prototype actor sheet is present at `public/assets/sprites/actors.png`.
- Confirm the runtime config loads the `/assets/sprites/actors.png` spritesheet path.
- Confirm type-check, test, lint, build, and workspace status commands remain green.

Findings:

- Player and dummy now have distinct blue/red prototype sprite frames.
- `actorSkinSource` is set to `spritesheet`, with generated textures retained as fallback.
- Vite dev HTTP smoke returned `200` for `/` and `200` for `/assets/sprites/actors.png`.
- The served sprite response size was `574` bytes, matching the generated PNG asset.
- Browser-interactive cover, hazard, audio, and respawn balance findings still require a human manual playtest session.

Follow-up:

- Run `npm run dev` and use the local browser checklist before changing balance values.
- Record actual cover/hazard/audio findings in this file after manual input and visual/audio checks.
