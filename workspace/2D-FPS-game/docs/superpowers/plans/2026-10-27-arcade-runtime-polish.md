# Arcade Runtime Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make arcade map selection, HUD health, weapon impact, weather, and audio visibly match the current product direction.

**Architecture:** Keep the existing Phaser composition root and pure domain modules. Presentation reads shared map/profile metadata, combat consumes an explicit arcade tuning table, and generated audio remains behind `AudioFeedbackController`/`GeneratedAudioCuePlayer`.

**Tech Stack:** TypeScript, Phaser, Vitest, Playwright, Web Audio API, CSS gradients/canvas stage art.

**Spec:** `docs/superpowers/specs/2026-10-27-arcade-runtime-polish-design.md`

## Global Constraints

- Preserve classic-mode behavior unless the spec explicitly scopes a change to arcade mode.
- Keep authoritative health fractional; only HUD/accessibility text is integer-formatted.
- Use existing generated assets and Web Audio; add no dependency.
- Preserve unrelated dirty/untracked files.
- Use tests-first for each new behavior and rerun the full deterministic gate after the final edit.

## Review Focus

- A map added to the arcade catalog must appear in both selection surfaces and must not fall back to `ground_shaker_asset/map_preview.png`; covered by preview catalog and picker tests.
- Explosion falloff may produce fractional health; the HUD must show a whole number without changing the state; covered by health formatter tests and HUD E2E.
- Direct and explosive weapons must expose distinct damage/radius values while classic configs remain untouched; covered by arcade weapon balance tests.
- Arcade markup must not load legacy portrait images while classic markup still does; covered by selection/main HUD browser evidence.
- Audio and weather requests may be emitted before or during a transition; duplicate loop requests must remain suppressed and map motifs must switch on the next match; covered by audio/controller tests.

### Task 1: Shared arcade map previews

**Files:**
- Create: `src/ui/arcade-stage-preview-catalog.ts`
- Modify: `src/ui/SelectionFlow.ts`
- Modify: `src/ui/CozyArcadePicker.ts`
- Modify: `src/ui/cozy-arcade.css`
- Modify: `tests/SelectionFlow.test.ts`
- Modify: `tests/CozyArcadePicker.test.ts`

**Interfaces:**
- Produces `ARCADE_STAGE_PREVIEWS` for both arcade selection views.

- [x] Write a failing test asserting all eight map ids appear in both rendered views and the markup contains no legacy preview URL.
- [x] Run the two focused picker tests and confirm the new assertions fail because the cozy picker has three maps and the selection flow uses the shared image.
- [x] Add the immutable preview catalog and render both pickers from it.
- [x] Add distinct CSS gradient/pattern classes for garden, bay, picnic, beach, woods, dune, city, and frost.
- [x] Run the focused picker tests and confirm pass.

### Task 2: Integer health presentation and arcade HUD profile

**Files:**
- Create: `src/ui/health-formatters.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `src/ui/arcade-hud.css`
- Add or modify: `tests/HealthFormatters.test.ts`

**Interfaces:**
- Produces `formatHealthValue(value: number): string` and `formatHealthPair(value: number, max: number): string`.

- [x] Write failing formatter tests for fractional, negative, non-finite, and max-health values.
- [x] Run the focused formatter test and confirm failure because the module does not exist.
- [x] Implement integer-only formatting and use it for player/dummy health text and meter `aria-valuenow`.
- [x] Render arcade mascot profile spans without `<img id="player-portrait">`/`<img id="enemy-portrait">`; leave classic portrait markup and update logic intact through optional elements.
- [x] Improve mascot alignment in the identity header and add a browser assertion for arcade/classic portrait behavior.
- [x] Run formatter tests and the focused arcade HUD/default-experience Playwright test.

### Task 3: Arcade weapon damage and hit-radius contract

**Files:**
- Create: `src/domain/combat/ArcadeWeaponBalance.ts`
- Modify: `src/domain/combat/ProjectileRuntime.ts`
- Modify: `src/scenes/weapon-slot-factory.ts`
- Modify: `src/scenes/combat-controller.ts`
- Add: `tests/ArcadeWeaponBalance.test.ts`

**Interfaces:**
- Produces `ARCADE_WEAPON_BALANCE` and `applyArcadeWeaponBalance(config, weaponId)`.
- `ProjectileConfig.hitRadius` expands collision bounds without altering projectile sprite size.

- [x] Write failing tests for Carbine 2, Bazooka 5 with a larger blast radius, Air Strike 10 with the largest area, plus distinct values for the remaining weapons.
- [x] Run the focused test and confirm failure because the contract is absent.
- [x] Implement the pure tuning table and apply it only when `gameBalance.arcadePresentation === true`.
- [x] Carry `hitRadius` through projectile config and use it when building collision bounds.
- [x] Run focused weapon/combat tests and verify classic balance tests are unchanged.

### Task 4: Weather visual/runtime application

**Files:**
- Modify: `src/scenes/weather-renderer.ts`
- Modify: `assets/data/game-balance.json`
- Modify: `tests/WeatherRenderer.test.ts`
- Modify: `tests/e2e/arcade-hud.spec.ts` or add a focused weather E2E assertion.

**Interfaces:**
- Keeps `WeatherRenderer.applyWeather/update` as the runtime boundary and preserves the existing weather type set.

- [x] Add a failing runtime assertion that rain/sandstorm particles and fog/storm overlays are active after selection/debug transition.
- [x] Confirm the failure or gap against current default balance and visual state.
- [x] Strengthen the particle/overlay presentation only where the evidence shows it is too subtle, keeping pooled objects and deterministic debug state.
- [x] Add configured weather sound channels in Task 5’s audio contract and verify the weather queue is populated.
- [x] Run focused weather tests and relevant browser evidence.

### Task 5: Weapon, hit, weather, and map-specific generated audio

**Files:**
- Modify: `src/domain/audio/SoundCueLogic.ts`
- Modify: `src/domain/audio/AudioCueLogic.ts`
- Modify: `src/domain/audio/GeneratedAudioCuePlayer.ts`
- Modify: `src/scenes/audio-feedback-controller.ts`
- Modify: `src/scenes/MainScene.ts`
- Modify: `src/scenes/combat-controller.ts`
- Modify: `src/audio/sound-cue-contract.ts`
- Modify: `src/scenes/scene-types.ts`
- Modify: `assets/data/game-balance.json`
- Modify: `tests/SoundCueLogic.test.ts`
- Modify: `tests/AudioCueLogic.test.ts`
- Modify: `tests/GeneratedAudioCuePlayer.test.ts`
- Modify: `tests/AudioFeedbackController.test.ts`
- Modify: `tests/SoundCueContract.test.ts`

**Interfaces:**
- Produces weapon-specific fire cue keys and map-specific `AmbientCueKey` values.
- `AudioFeedbackController` owns ambient/weather loop lifecycle and continues to suppress duplicate loop requests.

- [x] Write failing tests for all six fire cue mappings, configured weather queue items, and distinct ambient cue/tone profiles for all eight arcade maps.
- [x] Run the focused audio tests and confirm failure because the current model has only carbine/scatter/generic and one ambient cue; also confirm the production JSON has empty weather channels.
- [x] Implement cue mappings/tone profiles, map-to-ambient resolution, scheduled casual motif notes, and rain/sandstorm/storm channel config.
- [x] Start the selected map’s ambient cue on `match-start`; preserve fade/volume and stop behavior.
- [x] Run the focused audio tests and relevant weapon/weather browser checks.

### Task 6: Final verification and evidence

**Files:**
- Modify: only files required by failing verification evidence.

- [x] Run `npm run type-check`.
- [x] Run `npm run lint`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run focused Playwright tests for the current integrated arcade entry, weather, and actor/profile rendering; the legacy browser specs still target the pre-integration picker route.
- [x] Run `node ..\\..\\plugins\\hermes-ssot\\scripts\\manual-drift-check.mjs` and confirm whitespace/diff checks.
- [x] Perform a read-only diff review and report remaining risks.
