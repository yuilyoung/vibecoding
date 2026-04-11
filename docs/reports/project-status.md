# Project Status Report

Project: Phaser-based 2D FPS prototype  
Report date: 2026-04-11  
Active implementation baseline: `work/2D-FPS-game`

## Summary

| Item | Status |
|------|--------|
| Active milestone | Hybrid FPS Phase 1: physics + weapon systems |
| Runtime baseline | Phaser + TypeScript + Vite |
| Verification | type-check, lint, test, build passing |
| Latest test result | 18 unit test files / 106 unit tests passing; 7 E2E tests passing |
| Development status | Continue prototype iteration |

## Completed Prototype Scope

- Player movement, sprint, mouse aim, HP, stun, death, and round reset.
- Player shooting, ammo, reload, pickups, two weapon slots, and weapon HUD.
- Dummy AI chase, retreat, strafe, flank, cover, line-of-sight blocking, blocked-sight repositioning, and hazard avoidance.
- Obstacles, interactable gate, projectile blocking, map hazard zone, round-start countdown lock, and respawn pulse feedback.
- Cover-point visualization and `coverPointRadius` tuning value.
- Authored prototype actor sprite-sheet, generated actor skin fallback, and state visual feedback.
- Sprite-sheet import path contract for `/assets/sprites/actors.png`.
- Sound cue contract, pure cue mapping helper, scene-level cue emission, and generated WebAudio playback for fire, hit, pickup, gate, hazard, and match confirm.
- Local playtest checklist, browser smoke-test guide, browser balance playtest log, cover/hazard/audio tuning notes, prototype Git tracking policy, and Unity/Phaser roadmap reconciliation.
- Phaser is the active production-candidate track unless the documented migration gate is explicitly approved.
- Match victory overlay with explicit `ENTER` confirmation.
- Phase 1 domain foundation: `ProjectileRuntime`, `ExplosionLogic`, optional weapon projectile configs, and six-weapon balance data.

## Phase Completion Status

| Phase | Status | Completed | Remaining |
|-------|--------|-----------|-----------|
| Phase 1: physics + weapon systems | In progress | Existing Carbine/Scatter runtime, `ProjectileRuntime`, `ExplosionLogic`, six-weapon `game-balance.json` roster, projectile/explosion tests | Phaser scene integration for arc/bounce/beam/aoe weapons, Arcade Physics activation, weapon HUD/slot expansion |
| Phase 2: map objects + explosion chains | Not started | Chain-explosion domain helper exists as Phase 1 support | `MapObjectLogic`, object placement data, destructive cover/barrels/mines/crates |
| Phase 3: wind + weather | Not started | None | `WindLogic`, `WeatherLogic`, round environment changes, HUD weather/wind feedback |
| Phase 4: visual asset replacement | Partial | Prototype actor sheet and sprite asset contract | Final character/weapon/projectile/explosion/map/UI art direction |
| Phase 5: vehicles + extended weapons | Not started | None | Vehicles and extended weapon set |

## Immediate Next Tasks

| Priority | ID | Task | Owner | Estimate |
|----------|----|------|-------|----------|
| 1 | Phase1.2 | Integrate ProjectileRuntime weapons into MainScene and expand active slots beyond Carbine/Scatter | ultron | 3h |
| 2 | Phase1.3 | Add Phaser Arcade Physics config and explosion visual/runtime wiring | ultron | 2h |
| 3 | P2.13 | Replace prototype actor sheet with final art direction if needed | vision + ultron | 3h |
| 4 | P2.14 | Define migration gate evidence if Unity work resumes | vision + ultron | 2h |

## Risks

- Current actor sheet is prototype art, not final art direction.
- Phase 1 projectile/explosion logic is domain-tested but not yet wired into the Phaser scene.
- Generated audio cue loudness still needs a real speaker/headphone pass before tone gains are changed.
- Cover vision feedback may need tuning because the HUD vision-jam radius is smaller than the cover marker radius.
- Root roadmap documents still include older Unity assumptions; implementation decisions should continue to use `work/2D-FPS-game` until a deliberate migration decision is made.
