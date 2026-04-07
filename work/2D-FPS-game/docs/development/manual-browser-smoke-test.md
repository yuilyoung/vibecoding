# Manual Browser Smoke Test

This is the shortest useful browser pass for the Phaser prototype.

## Start

1. Run `npm run dev` from `work/2D-FPS-game`.
2. Open the local Vite URL in a browser.
3. Load the game once and verify the canvas appears.

## Smoke Flow

1. Move the player with `WASD`.
2. Sprint with `SPACE`.
3. Aim with the mouse and confirm rotation updates.
4. Fire the current weapon and confirm bullets appear.
5. Press `1` and `2` to switch between the `Carbine` and `Scatter`.
6. Press `R` to reload.
7. Approach the `E` gate and toggle it open and closed.
8. Walk through the vent hazard and confirm health drops over time.
9. Collect ammo and health pickups.
10. Play until the round ends and confirm the victory overlay appears.
11. Wait for the confirm delay and press `ENTER` to start the next match.

## Expected Results

- The HUD should show the current weapon, ammo, gate state, and hazard state.
- The gate should block movement and bullets while closed.
- The vent should damage actors while they remain inside it.
- The dummy should respond to cover and line-of-sight blockers.
- A new match should only start after the confirm window opens and `ENTER` is pressed.

## Stop Conditions

- Browser console errors.
- Missing HUD updates after weapon switching or gate interaction.
- Bullets or movement passing through a closed gate.
- Hazard damage or match confirmation not triggering.
