# Game Specialist - Phase 7 Tactical Combat Depth

## Mission

Implement Phase 7 as a gameplay-depth pass, not as a feature-sprawl pass. The target is more readable and more tactical matches through better bot intent, stronger cover usage, clearer weapon roles, and a repeatable tuning loop.

## Required Inputs

- `AGENTS.md`
- `docs/handoffs/current-handoff.json`
- `work/2D-FPS-game/docs/planning/phase7-wbs.md`
- `work/2D-FPS-game/docs/planning/phase7-tasks.json`
- `work/2D-FPS-game/docs/development/game-direction.md`

## Ownership

This specialist owns gameplay-facing execution for:

- `assets/data/game-balance.json`
- `src/domain/ai/*`
- `src/domain/combat/*`
- `src/domain/map/CoverLogic.ts`
- `src/scenes/combat-controller.ts`
- `src/scenes/main-scene-debug.ts`
- `src/ui/hud-presenters.ts`
- related tests in `tests/` and `tests/e2e/`

Do not take ownership of unrelated agent-local files or broad UI restyling.

## Working Rules

1. Preserve the current Phase 6 baseline first. New tactical behavior must be additive and regression-safe.
2. Keep Phaser orchestration thin. Reusable decisions belong in `src/domain/*`.
3. Put tunable numbers in `game-balance.json`; avoid hardcoded tactical thresholds.
4. Keep all tactical decisions deterministic in tests through explicit inputs and injected randomness where needed.
5. Preserve current public debug methods. Extend payloads instead of breaking signatures.
6. Maintain `MainScene.ts <= 850` and avoid re-centralizing logic into the scene.

## Execution Order

1. T1 config contract
2. T2 tactical state machine
3. T3 tactical positioning
4. T4 weapon-role selection
5. T5 debug and HUD exposure
6. T6/T7 verification expansion
7. T8 documentation handoff hooks
8. T9 full gates

## Tactical Quality Bar

- Bots must visibly switch intent based on HP, range, LOS, cover, and effective weather.
- Weapon choice should be explainable from config and scenario, not random-feeling.
- Retreat and flank behavior should improve pressure patterns without requiring full pathfinding.
- HUD/debug output must make tactical decisions inspectable by QA and future agents.

## Done Criteria

- `docs/handoffs/current-handoff.json` acceptance items for Phase 7 are met.
- Existing unit/E2E coverage stays green.
- New tests prove low-HP retreat, cover selection, range-aware weapon choice, and tactical intent surfacing.
- Documentation is updated so the next specialist or QA agent can continue without rediscovery.
