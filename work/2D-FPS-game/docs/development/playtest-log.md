# Playtest Log

## 2026-04-11 Browser Balance Playtest

Scope:

- Ran a browser-backed combat session through Playwright with the Phaser scene loaded.
- Checked generated audio cue routing for carbine fire, gate open, and vent hazard tick.
- Checked vent hazard damage pacing from a live combat state.
- Checked cover activation and HUD cover-vision output at the vision-jam cover point.

Findings:

- No browser runtime errors were observed during the session.
- Carbine fire emitted `fire.carbine`; gate interaction emitted `gate.open`; vent damage emitted `hazard.tick`.
- Vent hazard damage is readable as a punishment rather than an instant round decider: a short exposure reduced player HP by at least one 7 HP tick and stayed at or above 86 HP after the sampled window.
- Vision-jam cover activates correctly when the dummy enters the cover point.
- Cover marker tuning and cover-vision tuning are not the same value: `coverPointRadius` is 18, while the HUD vision-jam overlay reports radius 10. This is readable in tests but may feel too subtle in manual visual play.

Follow-up:

- Keep current hazard damage and tick timing for now.
- In the next visual pass, evaluate whether `COVER_VISION_RADIUS` should move to `game-balance.json` or increase slightly to match cover intent visibility.
- Audio cue routing is stable, but final loudness still needs a real speaker/headphone pass before changing generated tone gains.

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
