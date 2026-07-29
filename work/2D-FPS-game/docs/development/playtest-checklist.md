# Local Playtest Checklist

Use this before marking a prototype change as ready for another iteration.

## Launch

- Run `npm run dev` from `work/2D-FPS-game`.
- Open the local Vite URL in a browser.
- Confirm the scene loads without console errors.

## Core Control Checks

- Move with `WASD` and confirm collision stops the player at obstacles.
- Sprint with `SPACE` and confirm speed increases.
- Aim with the mouse and confirm the player sprite rotates with the aim angle.
- Reload with `R` and confirm magazine refill behavior works.
- Switch weapons with `1` and `2` and confirm the HUD updates to the active slot.
- Fire the current weapon with the mouse button and confirm bullets spawn from the player.

## Map Interaction Checks

- Walk near the `E` gate and press `E`.
- Confirm the gate toggles open and closed.
- Confirm bullets are blocked while the gate is closed.
- Confirm the gate no longer blocks movement or shots when open.
- Step into the vent hazard and confirm periodic damage is applied.

## Combat Checks

- Pick up ammo and confirm reserve ammo increases.
- Pick up health and confirm HP increases.
- Fight until one side wins and confirm the match overlay appears.
- Press `ENTER` after the confirm delay and confirm the next match starts.

## AI Checks

- Confirm the dummy closes distance when the player is far away.
- Confirm the dummy retreats when the player gets too close.
- Confirm the dummy repositions toward cover when line of sight is blocked.
- Confirm the dummy does not fire through the vent gate or other active blockers.

## Tactical Snapshot Checks

- Confirm `getHudSnapshot().tactical.intent` changes between `pressure`, `hold`, `retreat`, and `flank` in believable situations.
- Confirm `getHudSnapshot().tactical.chosenWeaponId` matches the dummy's visible weapon swap behavior.
- Confirm `getHudSnapshot().tactical.chosenWeaponRole` stays readable and stable enough for QA notes.
- Confirm `getDebugSnapshot().tactical.targetCoverIndex` and `targetCoverEffect` are populated when the dummy commits to cover-aware movement.

## Pass Criteria

- No runtime errors in the browser console.
- Controls match the HUD hints.
- Combat, gate, hazard, and match-confirm flows all behave as expected.
- The prototype remains playable for at least one full round restart cycle.

## Phase 8 Audio Loop Checks

- Change weather between rain, storm, and clear; confirm one matching environment loop is active at a time.
- Reset the match and immediately restore the same weather; confirm the loop restarts rather than being suppressed by cooldown.
- During combat, inspect HUD/debug audio state for `activeWeatherLoopCue`, `lastDroppedCue`, and queue count.
- Record readability issues as balance changes to cue profiles/rules; do not add external audio assets within Phase 8 scope.
