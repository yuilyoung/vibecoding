# Prototype Tuning Notes

Use these notes after each local browser playtest to keep cover, hazard, and audio adjustments deliberate.

## Current Tuning Targets

- Cover points should make the dummy reposition when line of sight is blocked, without making the dummy stall forever.
- The vent hazard should punish standing still in the zone, but should not decide a round faster than weapon combat.
- Generated audio cues should confirm actions without masking combat readability.
- Respawn feedback should make the new round obvious during the round-start lock.

## Cover Checks

- Confirm cover markers are readable without dominating the playfield.
- Confirm `coverPointRadius` makes cover intent visible at normal zoom.
- Confirm blocked line of sight causes `reposition` instead of repeated blocked fire.
- Confirm the dummy can still chase or flank when cover is irrelevant.

## Hazard Checks

- Confirm the player can recognize the vent before taking repeated damage.
- Confirm the dummy avoids the hazard instead of crossing it unnecessarily.
- Confirm hazard damage and `hazardTickMs` do not overpower weapon damage.

## Audio Checks

- Confirm carbine and scatter fire tones are distinguishable.
- Confirm pickup, gate, hazard, hit, and match-confirm cues are audible but short.
- Confirm repeated hazard or fire cues do not become distracting during a full round.

## Respawn Checks

- Confirm the countdown overlay locks input and firing during round start.
- Confirm the player and dummy pulse briefly after reset.
- Confirm respawn feedback ends before normal combat readability is affected.

## First Adjustment Candidates

- If cover is unclear, increase `coverPointRadius` slightly before moving cover positions.
- If vision-jam feedback is unclear, tune `COVER_VISION_RADIUS` separately or externalize it before changing cover placement.
- If hazard feels too punishing, lower `hazardDamage` before lengthening `hazardTickMs`.
- If audio feels noisy, lower generated cue gain before changing frequencies.
- If respawn is too subtle, extend `RESPAWN_FX_MS` before increasing scale.

## Current Playtest Status

Automated smoke checks can confirm build and asset wiring.
The 2026-04-11 browser balance pass confirmed current hazard pacing and generated cue routing.
Manual speaker/headphone review is still required before changing generated tone gains.
