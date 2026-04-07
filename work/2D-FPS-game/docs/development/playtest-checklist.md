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

## Pass Criteria

- No runtime errors in the browser console.
- Controls match the HUD hints.
- Combat, gate, hazard, and match-confirm flows all behave as expected.
- The prototype remains playable for at least one full round restart cycle.
