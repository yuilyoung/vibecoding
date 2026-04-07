# Setup Guide

## Purpose

Use this guide to run, verify, and iterate on the active Phaser prototype in `work/2D-FPS-game`.

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
- `1` / `2`: switch between `Carbine` and `Scatter`
- `E`: interact with the gate
- `ENTER`: confirm the next match after the match overlay unlocks

## Runtime Notes

- Actor skins default to generated placeholder textures.
- Optional authored actor sprites can use the sprite-sheet path described in `sprite-asset-contract.md`.
- Sound feedback currently uses generated WebAudio tones from cue names, not external audio files.
- The round-start countdown briefly locks movement, firing, gate interaction, dummy movement, and hazard ticks before each round resumes.

## Completion Check

Before handing off a prototype change:

1. Run `npm run type-check`.
2. Run `npm run lint`.
3. Run `npm test`.
4. Run `npm run build`.
5. If gameplay changed, run the manual browser smoke test.
