# Combat Roster and Online Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and harden combat/environment/audio behavior, deliver a playable local 1v3 CPU battle, and add tested server-authoritative online protocol seams without claiming a hosted online service.

**Architecture:** Preserve the existing pure gameplay modules and scene composition root. Add a business-layer actor roster and protocol validation, a scene-owned CPU squad adapter, and collection-based combat targeting; keep Phaser/Web Audio in presentation and reserve WebSocket transport for a future infrastructure adapter.

**Tech Stack:** TypeScript 5.8+, Phaser 3.90, Vite 7, Vitest 3, Playwright, generated Web Audio.

**Spec:** `docs/superpowers/specs/2026-10-27-combat-roster-online-readiness-design.md`

## Global Constraints

- Preserve current 1v1/default routes and all unrelated dirty/untracked files.
- Domain modules must not import Phaser, DOM, Web Audio, WebSocket, storage, or concrete adapters.
- Scene simulation remains single-threaded; presentation never decides damage or match results.
- Do not add a service locator, global mutable singleton, third-party art/audio asset, or unbounded queue.
- A new actor must not require `dummy2`/`dummy3` fields in `MainScene` or `CombatController`.
- Protocol evidence is online readiness, not proof of a deployed online service.
- Do not commit or stage the broad pre-existing dirty tree unless the user explicitly asks; use focused diffs and verification checkpoints.

## Review Focus

- A high-speed projectile crossing an actor and obstacle in one frame must resolve only the earliest blocking impact; Task 1 adds swept-impact precedence tests.
- Switching weapons, dying, or resetting during reload must neither duplicate nor lose ammo; Task 1 adds exact-boundary and lifecycle tests.
- One enemy dying in 1v3 must not finish the round; Task 4 adds aggregate-elimination unit and browser coverage.
- Duplicate, stale, malformed, oversized, or unknown-version online input must not mutate state; Task 2 adds fail-closed protocol tests.
- Weather/map changes and scene shutdown must not leave stale particles or overlapping music loops; Task 5 adds transition/restart browser evidence.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/domain/combat/ProjectileImpactLogic.ts` | Pure swept segment/expanded-rect impact ordering |
| `src/domain/round/BattleRosterLogic.ts` | Actor identity, teams, living membership, aggregate elimination |
| `src/domain/network/OnlineBattleProtocol.ts` | Versioned message types and fail-closed validation |
| `src/scenes/combat-actor-port.ts` | Phaser-facing actor target/fire adapters consumed by combat |
| `src/scenes/cpu-squad-controller.ts` | Scene ownership, AI/input, weapon state, rendering and teardown for additional CPUs |
| `src/scenes/combat-controller.ts` | Collection-based fire/hit/explosion/beam coordination |
| `src/scenes/MainScene.ts` | Composition only: create/wire/update/reset/destroy the squad |
| `docs/reports/combat-service-hardening-evidence/` | Capability matrix and fresh verification results |

### Task 1: Reload, fire, and earliest-impact correctness

**Files:**
- Create: `src/domain/combat/ProjectileImpactLogic.ts`
- Create: `tests/ProjectileImpactLogic.test.ts`
- Modify: `tests/WeaponLogic.test.ts`
- Modify: `src/scenes/combat-controller.ts`
- Modify: `tests/CombatController.test.ts`

**Interfaces:**
- Produces: `selectEarliestProjectileImpact(input: ProjectileImpactInput): ProjectileImpact | null`.
- `ProjectileImpactInput` contains previous/next centers, projectile width/height/hit radius, actor targets, and blocking world targets.
- `ProjectileImpact` exposes `kind`, `id`, `fraction`, `x`, and `y`; lowest fraction wins and blocking world wins exact ties.

- [ ] Add failing pure tests for actor tunneling, obstacle-before-actor, actor-before-obstacle, exact tie, dead/same-team exclusion, and no impact.
- [ ] Run `npx vitest run tests/ProjectileImpactLogic.test.ts`; expect failure because the module is absent.
- [ ] Implement slab-based segment versus expanded AABB intersection and stable earliest-impact selection without Phaser imports.
- [ ] Run the focused test; expect all cases to pass.
- [ ] Add failing `WeaponLogic` tests named `completes reload exactly at the boundary`, `preserves total ammo when reload is cancelled by a switch`, and `restores configured ammo after death reset`.
- [ ] Run `npx vitest run tests/WeaponLogic.test.ts`; retain any failing assertion as the defect evidence.
- [ ] Make the minimum `WeaponLogic` or reset-path correction needed; do not alter weapon balance.
- [ ] Refactor projectile resolution in `CombatController.updateProjectiles` to consume the pure earliest-impact result and apply exactly one actor/world outcome.
- [ ] Add a controller regression proving an impact cannot damage an actor behind blocking cover/obstacle in the same frame.
- [ ] Run `npx vitest run tests/ProjectileImpactLogic.test.ts tests/ProjectileRuntime.test.ts tests/WeaponLogic.test.ts tests/CombatController.test.ts`; expect pass.
- [ ] Run `git diff --check -- src/domain/combat src/scenes/combat-controller.ts tests/ProjectileImpactLogic.test.ts tests/ProjectileRuntime.test.ts tests/WeaponLogic.test.ts tests/CombatController.test.ts`.

### Task 2: Actor roster and authoritative online contracts

**Files:**
- Create: `src/domain/round/BattleRosterLogic.ts`
- Create: `tests/BattleRosterLogic.test.ts`
- Create: `src/domain/network/OnlineBattleProtocol.ts`
- Create: `tests/OnlineBattleProtocol.test.ts`

**Interfaces:**
- Produces: branded `ActorId`, `ControllerKind`, `BattleActorDescriptor`, and `BattleRosterLogic` methods `add`, `remove`, `all`, `living`, `opponentIds`, `setAlive`, `hasLivingTeamMember`, `getEliminatedTeam`.
- Produces: `ActorCommand`, `OnlineClientMessage`, `OnlineServerMessage`, `OnlineErrorCode`, `parseOnlineClientMessage`, `parseOnlineServerMessage`, and `InputSequenceGuard.accept(actorId, sequence)`.
- Validators return `{ ok: true, value } | { ok: false, code }` and never throw for untrusted input.

- [ ] Add failing roster tests for unique IDs, two teams, immutable views, per-actor death, one-death-not-team-loss, all-dead elimination, removal, and reset.
- [ ] Run `npx vitest run tests/BattleRosterLogic.test.ts`; expect module-not-found failure.
- [ ] Implement `BattleRosterLogic` with private `Map<ActorId, entry>` storage and copied/frozen outward snapshots.
- [ ] Run the roster tests; expect pass.
- [ ] Add failing protocol tests for valid join/input/leave/snapshot/event messages, unknown version/type, invalid numbers, bounded strings, command ranges, wrong actor identity, duplicate/stale sequences, and idempotent guard reset.
- [ ] Run `npx vitest run tests/OnlineBattleProtocol.test.ts`; expect module-not-found failure.
- [ ] Implement the message vocabulary, pure runtime validators, maximum string/message collection constants, and per-actor sequence guard.
- [ ] Run both focused test files; expect pass.
- [ ] Run `git diff --check -- src/domain/round/BattleRosterLogic.ts src/domain/network/OnlineBattleProtocol.ts tests/BattleRosterLogic.test.ts tests/OnlineBattleProtocol.test.ts`.

### Task 3: Scene-owned CPU squad with independent state

**Files:**
- Create: `src/scenes/combat-actor-port.ts`
- Create: `src/scenes/cpu-squad-controller.ts`
- Create: `tests/CpuSquadController.test.ts`
- Modify: `src/scenes/actor-presentation-composition.ts`
- Modify: `src/scenes/MainScene.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: `SceneCombatActor` with `id`, `team`, `controller`, `logic`, `sprite`, optional `animatedSprite`, `weaponSprite`, `weaponSlots`, `activeWeaponIndex`, hit/cover callbacks, and idempotent `destroy` ownership.
- Produces: `CpuSquadController.createAdditional(count, spawns)`, `actors`, `updateMovement(deltaSeconds, now, player)`, `updateWeaponTicks(now)`, `reset(spawns)`, and `destroy()`.
- Consumes: `BattleRosterLogic`, existing `DummyAiLogic`, `PlayerLogic`, `createDummyWeaponSlots`, actor-skin definition/animation catalog, and collision resolver.
- `MainScene` constructor gains `enemyCount = 1`; `main.ts` passes `deploymentSelection.enemyCount`.

- [ ] Add failing tests with Phaser test doubles proving requested counts 1 and 3 create zero and two additional CPUs, respectively.
- [ ] Add failing tests proving every additional CPU has a unique ID, independent `PlayerLogic`, independent weapon slots/reload state, deterministic spawn fallback, and idempotent destroy.
- [ ] Run `npx vitest run tests/CpuSquadController.test.ts`; expect module-not-found failure.
- [ ] Implement the focused scene actor port and CPU squad controller; keep primary dummy compatibility inside the composition root, not the domain.
- [ ] Reuse the resolved actor skin and existing animation keys for additional CPU presentation; no new asset load path.
- [ ] Wire `enemyCount` from the deployment URL into `MainScene` and create the squad only after the primary actor presentation is resolved.
- [ ] Run the focused squad, actor-presentation, deployment, and selection tests; expect pass.
- [ ] Run `npm run type-check`; expect pass before combat integration.

### Task 4: Collection-based combat, round reset, and playable 1v3

**Files:**
- Modify: `src/scenes/combat-controller.ts`
- Modify: `src/scenes/dummy-controller.ts`
- Modify: `src/scenes/main-scene-match-bind.ts`
- Modify: `src/scenes/match-flow-controller.ts`
- Modify: `src/scenes/MainScene.ts`
- Modify: `src/scenes/scene-types.ts`
- Modify: `src/scenes/scene-runtime-state.ts`
- Modify: `src/ui/arcade-hud-state.ts`
- Modify: `src/ui/ArcadeHud.ts`
- Modify: `tests/CombatController.test.ts`
- Create: `tests/TeamCombatIntegration.test.ts`
- Create or modify: `tests/e2e/arcade-runtime-polish.spec.ts`

**Interfaces:**
- Consumes: `SceneCombatActor[]`, `BattleRosterLogic`, and `selectEarliestProjectileImpact`.
- `BulletView` and `ActiveAirStrikeView` gain stable `ownerId` and `ownerTeam`; legacy owner labels remain only where required by existing presentation copy.
- Produces: `CombatController.handleCpuFire(actor, now)`, collection-based projectile/beam/explosion targeting, and one `evaluateTeamElimination(now)` result per round.

- [ ] Add failing integration tests proving primary plus two additional CPUs independently move/fire/reload and player shots can hit each by ID.
- [ ] Add failing tests proving friendly fire is filtered, damage is applied once, one CPU death continues combat, all CPU deaths produce one player result, player death produces one opponent result, and reset restores every actor/weapon.
- [ ] Run focused tests and retain the expected singleton-assumption failures.
- [ ] Change bullets/air strikes to carry owner identity/team and adapt all projectile, beam, explosion, and air-strike target paths to the combat-actor collection.
- [ ] Add `handleCpuFire` and call it for every living CPU while preserving the primary dummy's current tactical behavior.
- [ ] Move aggregate elimination into the roster/match boundary; remove direct “primary dummy died = round won” decisions.
- [ ] Reset all roster actors, AI state, weapon state, projectiles, hit feedback, and scene presentation exactly once.
- [ ] Expose enemy living/total counts in the arcade HUD without replacing existing 1v1 health copy.
- [ ] Add a browser scenario using `?enemies=3` that enters combat, observes three enemy IDs/sprites, eliminates one without round end, eliminates all, and confirms leak-free restart.
- [ ] Run `npx vitest run tests/BattleRosterLogic.test.ts tests/CpuSquadController.test.ts tests/CombatController.test.ts tests/TeamCombatIntegration.test.ts tests/MatchFlowLogic.test.ts tests/MatchFlowOrchestrator.test.ts`.
- [ ] Run `npx playwright test tests/e2e/arcade-runtime-polish.spec.ts --workers=1`.

### Task 5: Integrated weather and map-music lifecycle evidence

**Files:**
- Modify only if a test proves a defect: `src/scenes/weather-renderer.ts`
- Modify only if a test proves a defect: `src/scenes/audio-feedback-controller.ts`
- Modify only if a test proves a defect: `src/domain/audio/AmbientAudioCatalog.ts`
- Modify: `tests/e2e/arcade-runtime-polish.spec.ts`
- Modify: `tests/WeatherRenderer.test.ts`
- Modify: `tests/AudioFeedbackController.test.ts`
- Modify: `tests/AmbientAudioCatalog.test.ts`

**Interfaces:**
- Consumes existing `WeatherRenderer.applyWeather/update/destroy`, `getAmbientCueForStage`, and `AudioFeedbackController` ambient-loop lifecycle.
- Produces browser-visible debug evidence for selected weather and active/scheduled synthesized map motif.

- [ ] Add focused tests covering every configured stage-to-motif mapping, same-cue suppression, volume updates, stage switch, stop, repeated stop, and weather clear/reset after an effect state.
- [ ] Run the focused unit tests; preserve failures as defect evidence.
- [ ] Fix only demonstrated mapping/lifecycle/reset defects and rerun the focused tests.
- [ ] Add a browser scenario that unlocks audio through a real interaction, confirms selected weather presentation/debug state, changes map/motif, verifies no overlapping active loop, restarts, and confirms old weather/audio state is gone.
- [ ] Run `npx playwright test tests/e2e/arcade-runtime-polish.spec.ts tests/e2e/weather-system.spec.ts tests/e2e/weather-sound.spec.ts --workers=1`.

### Task 6: Capability report and deterministic completion gates

**Files:**
- Create: `docs/reports/combat-service-hardening-evidence/capability-matrix.md`
- Create: `docs/reports/combat-service-hardening-evidence/verification-report.md`
- Modify: `docs/reports/project-status.md`
- Modify only if routed source changed: the narrow affected manual/status record.

**Interfaces:**
- Produces an evidenced state for every user-requested capability: `implemented`, `verified`, `prepared`, `blocked`, or `deferred`.
- Separates local 1v3 proof, online protocol proof, and absent hosted online interoperability.

- [ ] Record exact focused test results and browser observations after the latest code edit.
- [ ] Run `npm run type-check`; expect exit 0.
- [ ] Run `npm run lint`; expect exit 0.
- [ ] Run `npm test`; expect every test file/test count recorded.
- [ ] Run `npm run build`; expect exit 0 and record transformed-module count.
- [ ] Run the complete `npm run test:e2e` suite with one worker when the environment is available; record pass/fail/skip counts and infrastructure failures separately.
- [ ] Run `git diff --check -- workspace/2D-FPS-game` from the repository root or the equivalent scoped check.
- [ ] Update the capability matrix, verification report, and workspace project status with only current-fingerprint facts.
- [ ] Ask the read-only `reviewer` to inspect the actual diff and fresh evidence; resolve every `revise` finding and rerun invalidated checks.
- [ ] Run `node plugins/hermes-ssot/scripts/manual-drift-check.mjs` from the repository root after reviewer pass.
- [ ] Run `npm run codex-postflight` from the repository root and confirm the lifecycle reaches completed.

## Self-review

- Spec coverage: Tasks 1–5 cover combat, roster/1v3, weather, generated map music, OOP boundaries, protocol readiness, lifecycle, and browser evidence. Task 6 covers status/UML/evidence. Hosted online play remains explicitly outside the approved slice.
- Step scan: each step has one artifact or one verification result; implementation signatures are fixed at task boundaries without transcribing bodies.
- Type consistency: `ActorId`, `BattleRosterLogic`, `SceneCombatActor`, owner identity/team, and protocol validator names are used consistently across producing and consuming tasks.
- Review focus: swept impact, ammo lifecycle, aggregate elimination, untrusted protocol input, and weather/audio cleanup each map to a named test step.
- Proportion: the plan is shorter and more execution-specific than the architecture spec and does not duplicate its UML or rationale.
