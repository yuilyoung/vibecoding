# Phase 13 Destructible Presentation Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing opt-in Phase 13 presentation feedback cover barrel, crate, and cover damage/destruction on classic `?worldSkin=product-v1` without changing gameplay or route defaults.

**Architecture:** Keep `MapObjectController` as the authoritative transition observer and reuse the existing `PresentationEventPort`, per-subject sequence map, and scene-lifetime composition. Generalize only the destructible-family publication guard; no new event owner or runtime dependency is introduced.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Playwright

**Spec:** `docs/planning/phase13-integrated-presentation-architecture.md`

## Global Constraints

- Presentation remains synchronous, additive, and non-authoritative.
- The only supported families in this slice are `barrel`, `crate`, and `cover`.
- Explicit legacy and the absent-query default remain unchanged; default promotion is not authorized.
- Do not edit `MainScene.ts`, gameplay-domain logic, assets, manifests, balance, collision, persistence, or timing.
- Preserve unrelated dirty-worktree changes and do not create a commit from the shared workspace unless the user explicitly requests it.

## Review Focus

- Classic `product-v1` crate damage and cover destruction must create bounded feedback just like barrel transitions.
- Explicit classic legacy must create zero integrated effects for barrel, crate, and cover operations.
- The existing route must preserve object HP/active state while presentation reacts.
- Scene restart must destroy active effects and allow the same object ID to emit again.
- Cozy/arcade crate and cover feedback must remain unchanged.

---

### Task 1: Pin the complete destructible-family browser contract

**Files:**
- Modify: `tests/e2e/phase13-presentation-events.spec.ts`

**Interfaces:**
- Consumes: `MainScene.debugDamageMapObject(id: string, damage: number): void`, `MainScene.debugGetIntegratedPresentationEffectCount(): number`, and the existing classic runtime-route helper.
- Produces: Browser assertions covering barrel, crate, and cover feedback, legacy isolation, gameplay state preservation, restart cleanup, and same-ID reuse.

- [ ] **Step 1: Extend the Phase 13 E2E test so classic `product-v1` damages `foundry-barrel-a`, `foundry-crate-a`, and `foundry-cover-a`, observing a positive effect count after each operation and unchanged authoritative HP/active transitions.**

- [ ] **Step 2: Add the equivalent explicit legacy operations and assert the integrated effect count remains zero.**

- [ ] **Step 3: After restarting the product scene, re-enter the stage, damage `foundry-crate-a` again, and assert the reused ID emits fresh feedback.**

- [ ] **Step 4: Run `npx playwright test tests/e2e/phase13-presentation-events.spec.ts --workers=1`; expect failure because crate/cover events are currently gated to arcade presentation.**

### Task 2: Generalize the destructible-object event publisher

**Files:**
- Modify: `src/scenes/map-object-controller.ts`
- Test: `tests/e2e/phase13-presentation-events.spec.ts`

**Interfaces:**
- Consumes: existing `PresentationEventPort.publish(event)`, `presentationSequences`, and authoritative `MapObjectState` transitions.
- Produces: `publishDestructibleEvent(state, kind)` accepting only `barrel | crate | cover` and retaining current event fields and sequence semantics.

- [ ] **Step 1: Rename `publishBarrelEvent` to `publishDestructibleEvent` at every authoritative damage/destroy call site.**

- [ ] **Step 2: Replace the arcade-dependent guard with an exact `barrel | crate | cover` family guard; leave every other family ignored.**

- [ ] **Step 3: Run `npx playwright test tests/e2e/phase13-presentation-events.spec.ts --workers=1`; expect the expanded contract to pass.**

- [ ] **Step 4: Run `npx vitest run tests/PresentationEvent.test.ts tests/MapObjectLogic.test.ts tests/MapObjectRuntime.test.ts`; expect all focused unit tests to pass.**

### Task 3: Verify the shared scene boundary and reliability gates

**Files:**
- Modify only if evidence requires it: `docs/reports/phase13-t1-evidence/`

**Interfaces:**
- Consumes: the scoped source/test diff after Task 2.
- Produces: current-fingerprint static, unit, build, browser, reviewer, drift, and postflight evidence without claiming Phase 13 T2 completion.

- [ ] **Step 1: Run `npx playwright test tests/e2e/map-objects.spec.ts tests/e2e/map-objects-sprint2.spec.ts tests/e2e/cozy-arcade.spec.ts --workers=1`; expect all relevant regressions to pass.**

- [ ] **Step 2: Run `npm run type-check`, `npm run lint`, `npm test`, and `npm run build`; expect every command to pass.**

- [ ] **Step 3: Run `npx playwright test --workers=1`; expect the complete browser gate to pass with only the documented conditional skip.**

- [ ] **Step 4: Run `git diff --check`, the Hermes harness tests/audit, current-fingerprint read-only review, manual drift, and Codex postflight.**

- [ ] **Step 5: Report the scoped files and exact command results; keep T2 visual/performance qualification and default promotion explicitly pending.**
