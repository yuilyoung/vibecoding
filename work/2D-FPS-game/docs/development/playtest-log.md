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

## 2026-04-13 Browser Playtest Probe

Scope:

- Ran the local Vite dev server at `http://127.0.0.1:5173`.
- Added and ran `tests/e2e/playtest-balance.spec.ts` against the dev server in Chromium.
- Covered movement mode changes, weapon swap/fire feedback, gate toggle fallback, vent hazard tick, vision-jam cover HUD state, match-confirm reset, and browser console errors.

Findings:

- No browser console or page runtime errors were reported during the probe.
- Walk and sprint HUD state changed correctly under browser keyboard input.
- Weapon switching reached the Scatter slot and emitted the `weapon.swap` cue.
- Firing remained playable during the probe, but rapid combat events can overwrite the transient fire cue before the HUD snapshot reads it.
- The vent hazard reduced player HP after overlap and emitted the `hazard.tick` cue. Current `hazardDamage: 7` and `hazardTickMs: 900` feel mechanically conservative in automation because the hazard did not immediately decide the match.
- The vision-jam cover state activated when the dummy occupied the first cover point. The current `coverPointRadius: 18` is enough for deterministic cover detection, but still needs a human visual readability pass at normal play speed.
- Match victory overlay waited for explicit `ENTER` confirmation and reset back to team selection with scores and round number cleared.

Follow-up:

- Run one headed human pass to judge subjective audio volume, cue fatigue, and cover-marker readability. Headless automation confirms cue emission, not perceived loudness.
- Keep current hazard and cover values until that human pass produces a stronger balance reason to tune them.
