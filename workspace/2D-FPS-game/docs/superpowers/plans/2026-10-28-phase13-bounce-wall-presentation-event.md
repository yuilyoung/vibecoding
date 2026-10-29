# Phase 13 Bounce-Wall Presentation Event Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish one opt-in, bounded `reflect` presentation event whenever the authoritative bounce-wall state consumes a reflection.

**Architecture:** Keep `CombatController` and `BounceWallLogic` authoritative and observe their existing before/after `MapObjectState` transition only inside `MapObjectController.setObjectState()`. Reuse the existing scene-owned `PresentationEventPort`, per-subject sequence map, product-pack composition, and reverse-order shutdown; all work remains synchronous on the Phaser scene thread.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Playwright

**Spec:** `docs/planning/phase13-integrated-presentation-architecture.md`

## Global Constraints

- Presentation remains additive and must not alter projectile reflection, wall durability, collision, balance, timing, routes, assets, manifests, or persistence.
- The production edit is limited to `src/scenes/map-object-controller.ts`; do not change `CombatController`, `BounceWallLogic`, or `MainScene`.
- Publish only when the existing active bounce-wall subject receives the same subject state with a lower `reflectionsRemaining` value.
- The final durability-consuming reflection remains `kind: "reflect"`; do not add a bounce-wall `destroy` event.
- Mine, teleporter, actor, gate, hazard, pickup, T2 qualification, and T3 default promotion remain out of scope.
- Preserve unrelated dirty-worktree changes and do not commit or push this new slice without a separate user request.

## Review Focus

- A real projectile reflection, rather than direct test-only state mutation, must drive the event.
- Product-v1 must create bounded feedback while explicit legacy creates none for the same authoritative reflection.
- The projectile must still reverse direction and the wall must still consume exactly one reflection.
- Reapplying an equal/increased reflection count, a different subject, or a non-bounce-wall state must not be mistaken for reflection.
- Consuming the final reflection must publish `reflect` once while existing gameplay alone decides that the wall becomes inactive.

---

### Task 1: Pin the product/legacy reflection contract

**Files:**
- Modify: `tests/e2e/phase13-presentation-events.spec.ts`

**Interfaces:**
- Consumes: existing `MainScene` debug entry/team/stage/state/effect hooks and the real projectile update path.
- Produces: browser assertions for product-only feedback plus unchanged projectile velocity and wall durability outcomes.

- [ ] **Step 1: Add a focused browser test named `publishes bounce-wall reflection feedback only for product-v1`.**

  The test opens classic `product-v1`, enters combat, rotates to `storm-drain`, injects the same deterministic linear projectile used by `map-objects-sprint2.spec.ts`, advances one owned frame, and asserts `drain-bounce-wall-a.reflectionsRemaining` is `2`, the player projectile velocity Y is negative, and the integrated effect count is positive. It repeats the same real reflection on explicit classic legacy and asserts the same authoritative state with effect count `0`.

- [ ] **Step 2: Run `npx playwright test tests/e2e/phase13-presentation-events.spec.ts --workers=1`.**

  Expected: FAIL only because the product-v1 bounce-wall reflection leaves the integrated effect count at `0`; the wall and projectile assertions remain correct.

### Task 2: Publish the authoritative bounce-wall transition

**Files:**
- Modify: `src/scenes/map-object-controller.ts`
- Test: `tests/e2e/phase13-presentation-events.spec.ts`

**Interfaces:**
- Consumes: `MapObjectController.setObjectState(id, state)`, the current stored `MapObjectState`, `presentationSequences`, `scene.time.now`, and `PresentationEventPort.publish(event)`.
- Produces: one `PresentationEvent` with `family: "bounce-wall"`, `kind: "reflect"`, the real subject ID/position/state, and the next per-subject sequence.

- [ ] **Step 1: Preserve the previous state in `setObjectState()` and recognize only the same active bounce-wall subject whose finite reflection count decreased.**

- [ ] **Step 2: Add a private bounce-wall publisher that reuses `presentationSequences` and emits `kind: "reflect"`; call it once for the recognized transition, including when the new wall state is inactive.**

- [ ] **Step 3: Run `npx playwright test tests/e2e/phase13-presentation-events.spec.ts --workers=1`.**

  Expected: both Phase 13 tests PASS, with product feedback positive and legacy feedback zero.

- [ ] **Step 4: Run `npx vitest run tests/PresentationEvent.test.ts tests/BounceWallLogic.test.ts tests/CombatController.test.ts` and `npx playwright test tests/e2e/map-objects-sprint2.spec.ts --workers=1`.**

  Expected: focused unit and real map-object regression tests PASS.

### Task 3: Verify the shared scene boundary and reliability gates

**Files:**
- Modify only if an approved finding requires it: the two scoped source/test files above.

**Interfaces:**
- Consumes: the final scoped diff after Task 2.
- Produces: current-fingerprint static, unit, build, browser, reviewer, drift, and postflight evidence without claiming Phase 13 T2 completion.

- [ ] **Step 1: Run `npm run type-check`, `npm run lint`, `npm test`, and `npm run build`.**

- [ ] **Step 2: Run `npx playwright test --workers=1`.**

- [ ] **Step 3: Run `git diff --check`, the Hermes harness audit/tests, a current-fingerprint read-only reviewer, manual drift, and Codex postflight.**

- [ ] **Step 4: Report the exact scoped files and command results; keep mine, teleporter, T2 visual/performance qualification, and T3 default promotion explicitly pending.**
