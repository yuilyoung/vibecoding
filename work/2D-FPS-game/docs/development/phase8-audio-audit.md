# Phase 8 Audio Audit

- Date: 2026-04-27
- Scope: Environment Audio Polish
- Status: T1 complete

## Current Strengths

- `SoundCueLogic.ts` already keeps gameplay event to cue mapping deterministic and small.
- `AudioCueLogic.ts` already provides priority and cooldown behavior for one-shot cues.
- `sound-cue-contract.ts` already defines deterministic weather loop play/stop queue items.
- `weather-sound.spec.ts` already covers same-type dedup and `MATCH_RESET` stop behavior in the browser.

## Current Gaps

- `AudioCueLogic.ts` hardcodes all priority and cooldown rules in code, so tuning requires code edits rather than data changes.
- `GeneratedAudioCuePlayer.ts` exposes only a global volume control. There is no cue family or per-cue profile override layer above the static tone map.
- Weather loop state is partially split across `HudController` and `AudioFeedbackController`. Queue intent is visible, but actual active audio state is not fully surfaced to QA.
- `AudioFeedbackController.ts` tracks only `lastSoundCue` for one-shot visibility. It does not expose richer audio runtime state such as active weather loop, recently dropped cue, or applied priority decisions.
- Browser coverage exists for weather queue behavior, but not yet for broader combat-audio readability decisions such as repeated fire, hazard-vs-hit competition, or HUD/debug audio state.

## Phase 8 Execution Slice

Phase 8 should stay inside `Environment Audio Polish` and avoid external asset production. The recommended implementation slice is:

1. Add a tuning layer for generated cue profiles and/or cue priority rules.
2. Tighten runtime priority, repeated-cue suppression, and weather loop ownership.
3. Expose audio runtime state through debug and HUD payloads.
4. Expand deterministic unit and browser verification for audio readability paths.

## Out Of Scope

- External audio asset import or file-based mixer work
- Larger UI readability redesign
- Vehicle, progression, or non-audio gameplay expansion

## Files To Touch Next

- `src/domain/audio/AudioCueLogic.ts`
- `src/domain/audio/GeneratedAudioCuePlayer.ts`
- `src/audio/sound-cue-contract.ts`
- `src/scenes/audio-feedback-controller.ts`
- `src/scenes/hud-controller.ts`
- `src/scenes/debug-controller.ts`
- `tests/SoundCueContract.test.ts`
- `tests/e2e/weather-sound.spec.ts`
