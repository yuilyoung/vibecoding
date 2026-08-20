# Playtest Log

## 2026-08-21 Phase 12 T1 Product-Object Browser Pass

Scope:

- Used the user-approved v5 target frame to deliver the opt-in `product-v1` barrel, mine, crate, cover, bounce-wall, and teleporter presentation.
- Inspected unobstructed 960x540 combat-state captures for Foundry, Relay Yard, and Storm Drain across clear, rain, fog, sandstorm, and storm.
- Exercised idle/damaged, idle/armed, idle/active state changes, atomic fallback, scene restart, exact positions/collision parity, runtime errors, budgets, and browser-side CPU cost.

Findings:

- The authored orange barrels, navy/amber crates, armored covers, cyan bounce assembly, mines, and violet teleporters are visibly distinct from the old glyph-and-shape presentation and stay readable in all five weather states.
- Domain object counts and overlay counts match in every capture; all six families are covered with no missing textures or console/page/request errors.
- The first evidence attempt was technically valid but the team-select modal obscured the center. Recapturing in COMBAT LIVE produced reviewable, unobstructed evidence.
- Product p95 is 0.1ms in all three final AB-BA-AB captures with -0.3ms to -0.5ms relative regression. Atlas transfer is 295024 bytes and raw RGBA is 4194304 bytes.
- Existing continuous generated weather ambience remains disabled; this slice adds no audio.

Follow-up:

- Keep product world art opt-in while Phase 12 T2 skins arena obstacles, the service gate, hazard/vent surfaces, ammo pickup, and health pickup.
- Preserve the same projection, outline, shadow, palette, atomic fallback, collider parity, and five-weather capture gates.
- Do not describe the six-family vertical slice as complete 11-family productization or default promotion.

## 2026-08-20 Product-Default Readability and Audio Blocker Pass

Scope:

- Responded to direct user feedback that the default still looked like the legacy game and the continuous generated background audio sounded like loud noise.
- Promoted the validated Quaternius actor request to `/`, retained explicit legacy/Kenney paths and total fallback, and reviewed the default 1600x1200 production-shell capture plus all 30 fixed 960x540 five-weather/state/team captures.
- Disabled default generated weather-loop activation through the production balance config while preserving one-shot combat SFX and settings.

Findings:

- The initial product capture exposed a clipped BLUE actor at `(0,0)` and mixed Kenney portrait identity. Moving the stage-entry preview to the BLUE spawn and switching the successful animated HUD to Vanguard team badges corrected both issues.
- The final production capture shows BLUE and RED Quaternius actors inside the arena, Arena Strike branding, a single PLAY CTA, and no prototype/POC/license copy or first-frame tutorial obstruction.
- All 30 canvas captures remain non-black and unique. BLUE/RED identity and idle/run/fire/hit/death silhouettes remain readable across clear, rain, fog, sandstorm, and storm; movement-versus-aim separation and the external carbine remain visible.
- Browser evidence proves every weather state leaves the weather queue empty and `activeWeatherLoopCue` null. A new subjective speaker/headphone re-listen is still required from the user; automation cannot judge perceived loudness.
- Hardware performance preserves the strict absolute failure at 16.9 ms versus 16.7 ms. The fixed schema 1.1 evaluator passes 7/7 route/order/pair-integrity contracts. All earlier pass/fail reports remain preserved. The product-owner-approved final one-shot collection passed the separate cadence exception with at least 1800 samples/capture, every p95 16.9 ms, max 18.2 ms, zero frames above 25 ms, and three 0.0 ms regression pairs.

Follow-up:

- Keep generated continuous weather ambience off until an authored ambient source and listening gate exist.
- T4 closes only through the explicit cadence exception, never as an absolute pass. Continue to retain every prior failed report.
- T5 regression, review, drift, and postflight passed. At that time Phase 12 was approval-only; v5 was later approved on 2026-08-21 and the T1 opt-in runtime slice is recorded above.

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
