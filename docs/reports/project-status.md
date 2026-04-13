# Project Status Report

Project: Phaser-based 2D FPS prototype  
Report date: 2026-04-14  
Active implementation baseline: `work/2D-FPS-game`

## Summary

| Item | Status |
|------|--------|
| Active milestone | M1 / Phase 1 — Physics and weapon systems |
| Runtime baseline | Phaser + TypeScript + Vite |
| Verification | type-check, lint, test, build passing |
| Latest test result | 115 unit tests and 6 browser e2e tests passing |
| Development status | M1 Phase 1 started |

## Completed Prototype Scope

- Player movement, sprint, mouse aim, HP, stun, death, and round reset.
- Player shooting, ammo, reload, pickups, two weapon slots, and weapon HUD.
- Dummy AI chase, retreat, strafe, flank, cover, line-of-sight blocking, blocked-sight repositioning, and hazard avoidance.
- Obstacles, interactable gate, projectile blocking, map hazard zone, round-start countdown lock, and respawn pulse feedback.
- Cover-point visualization and `coverPointRadius` tuning value.
- Authored prototype actor sprite-sheet, generated actor skin fallback, and state visual feedback.
- Sprite-sheet import path contract for `/assets/sprites/actors.png`.
- Sound cue contract, pure cue mapping helper, scene-level cue emission, and generated WebAudio playback for fire, hit, pickup, gate, hazard, and match confirm.
- Local playtest checklist, browser smoke-test guide, automated playtest log, cover/hazard/audio tuning notes, prototype Git tracking policy, and Unity/Phaser roadmap reconciliation.
- Browser playtest probe for movement mode, weapon feedback, gate, hazard tick, vision-jam cover state, match-confirm reset, and console-error check.
- Phaser is the active production-candidate track unless the documented migration gate is explicitly approved.
- Match victory overlay with explicit `ENTER` confirmation.
- M1 Phase 1 domain foundation started with pure projectile trajectory and explosion falloff logic.
- P1.02 scene bullet movement now routes through `ProjectileRuntime`, and the player weapon cycle includes a Bazooka arc projectile config.
- `phase1-tasks.json` now has T1-T6 completed and T7 in progress.
- T1/T2/T3 added six-weapon balance data, projectile metadata on `WeaponLogic`, and config-backed `WeaponInventoryLogic`.
- T4/T5 added pure `BeamLogic` and `AirStrikeLogic` contracts with tests.
- T6 removed the old `CombatRuntime.evaluateProjectileFrame` path; projectile movement now belongs to `ProjectileRuntime`.

## Current Roadmap Alignment

- Dashboard/JARVIS milestone view: M0 prototype complete, M1 can proceed.
- Active execution view: M1 Phase 1 is now in progress on the Phaser baseline.
- Phase 1 target: physics and weapon-system foundation before adding map-object chains, weather, final visuals, and vehicles.
- Phaser remains the execution baseline; older Unity dashboard/report artifacts are roadmap references unless migration is explicitly approved.

## Immediate Next Tasks

| Priority | ID | Task | Owner | Estimate |
|----------|----|------|-------|----------|
| 1 | T7 / P1.03 | Add Grenade bounce projectile and ExplosionLogic scene damage/knockback wiring | ultron | 3h |
| 2 | P1.04 | Add Sniper beam and Air Strike aoe-call interaction contracts | ultron | 3h |
| 3 | P2.11c | Run headed human review for subjective audio volume, cue fatigue, and cover-marker readability | vision + ultron | 45m |
| 4 | P2.13 | Replace prototype actor sheet with final art direction if needed | vision + ultron | 3h |
| 5 | P2.14 | Define migration gate evidence if Unity work resumes | vision + ultron | 2h |

## Risks

- Current actor sheet is prototype art, not final art direction.
- Weapon, gate, hazard, AI, and cue-emission wiring passed browser probing; subjective audio gain and cover readability still need headed human review.
- Explosion domain logic is not yet wired into Phaser scene weapon variants.
- Bazooka currently has arc projectile movement but no blast damage until P1.03.
- Root roadmap documents still include older Unity assumptions; implementation decisions should continue to use `work/2D-FPS-game` until a deliberate migration decision is made.
