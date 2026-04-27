# Phase 8 Game Specialist Brief

## Mission

Implement Phase 8 `Environment Audio Polish` for `work/2D-FPS-game` using the Phase 7 tactical baseline without widening scope into external asset pipelines or unrelated feature work.

## Read First

1. `docs/handoffs/current-handoff.json`
2. `work/2D-FPS-game/docs/planning/phase8-wbs.md`
3. `work/2D-FPS-game/docs/planning/phase8-tasks.json`
4. `work/2D-FPS-game/docs/development/game-direction.md`
5. `work/2D-FPS-game/docs/reports/project-status.md`

## Scope

- Tighten the generated audio layer so combat, pickup, hazard, and weather cues are clearer and less fatiguing.
- Keep audio behavior config-first where practical.
- Preserve the Phaser/domain separation already used in combat, weather, and tactical systems.
- Add deterministic verification for audio routing, cooldown, loop switching, and HUD/debug exposure.

## Owned Areas

- `work/2D-FPS-game/src/domain/audio/*`
- `work/2D-FPS-game/src/audio/*`
- `work/2D-FPS-game/src/scenes/audio-feedback-controller.ts`
- `work/2D-FPS-game/src/scenes/hud-controller.ts`
- `work/2D-FPS-game/src/scenes/debug-controller.ts`
- `work/2D-FPS-game/src/scenes/scene-types.ts`
- `work/2D-FPS-game/tests/*audio*`
- `work/2D-FPS-game/tests/e2e/weather-sound.spec.ts`

## Constraints

- No external audio asset pack adoption in this phase.
- No vehicle, progression, or large UI redesign work.
- Keep `MainScene.ts` within the existing LOC gate.
- Public debug methods should remain stable; extend payloads rather than renaming methods.
- Avoid regressions in Phase 7 tactical behavior while modifying audio visibility.

## Expected Deliverables

- Phase 8 planning docs align with implementation scope.
- Generated cue mix, cooldown, and loop handling are more readable.
- Weather loop playback and combat cue prioritization are deterministic and test-covered.
- HUD/debug audio state is visible enough for QA and playtest tuning.
