# Setup Guide

## Purpose

Use this guide to run, verify, and iterate on the active Phaser prototype in `workspace/2D-FPS-game`.

## Commands

```bash
npm install
npm run dev
npm run type-check
npm run lint
npm test
npm run build
```

## Current Controls

- `WASD`: move
- `SPACE`: sprint
- Mouse: aim and fire
- `R`: reload
- `1`-`6`: switch across the configured six-weapon loadout
- `E`: interact with the gate
- `ENTER`: confirm the next match after the match overlay unlocks

## Runtime Notes

- Ground Shaker CC0 tank bodies and turrets are the in-world actors.
- Kenney Top-down Shooter CC0 operators provide the player/enemy HUD portraits.
- PIXWEP CC0 assets provide a distinct HUD icon for every configured weapon slot.
- Runtime visual paths and their deterministic fallbacks are defined in `src/domain/visual/VisualAssetCatalog.ts`.
- Sound feedback currently uses generated WebAudio tones from cue names, not external audio files.
- The round-start countdown briefly locks movement, firing, gate interaction, dummy movement, and hazard ticks before each round resumes.

## Completion Check

Before handing off a prototype change:

1. Run `npm run type-check`.
2. Run `npm run lint`.
3. Run `npm test`.
4. Run `npm run build`.
5. If gameplay changed, run the manual browser smoke test.
