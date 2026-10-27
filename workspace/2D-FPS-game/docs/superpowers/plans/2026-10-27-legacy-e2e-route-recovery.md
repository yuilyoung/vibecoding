# Legacy E2E Runtime Route Recovery Implementation Plan

> Execute in the authoritative dirty workspace. Preserve all unrelated changes.

**Goal:** Make the 29-file / 83-test Playwright regression suite honor the current SelectionFlow/runtime route boundary.

**Architecture:** Add one pure test helper that normalizes runtime URLs. Selection tests bypass it; gameplay and presentation tests use it at their existing navigation boundary.

**Tech stack:** TypeScript, Vitest, Playwright, Phaser/Vite test server.

---

### Task 1: Lock the runtime-route contract

**Files:**
- Create: `tests/e2e/runtime-route.ts`
- Create: `tests/RuntimeRoute.test.ts`

1. Add failing tests for a root route, existing query, prior/duplicate `setup`, fragment, deployment subpath, and absolute external URL.
2. Run `npx vitest run tests/RuntimeRoute.test.ts` and retain the expected red result.
3. Implement the smallest pure helper that satisfies the contract.
4. Re-run the focused test to green.

### Task 2: Repair representative runtime entry

**Files:**
- Modify: `tests/e2e/arcade-hud.spec.ts`

1. Replace the raw runtime navigation with the helper.
2. Re-run the previously failing HUD layout scenario.
3. Run the complete HUD spec and address only route-related failures.

### Task 3: Migrate legacy runtime specs

**Files:**
- Modify only navigation boundaries under `tests/e2e/*.spec.ts` that immediately expect canvas/HUD/scene runtime behavior.
- Preserve `tests/e2e/arcade-runtime-polish.spec.ts` raw `/` SelectionFlow entry.

1. Import and apply the helper to root, skin, world-skin, stage, weather, and externally supplied playtest routes.
2. Update obsolete test wording where literal default-route semantics no longer match the assertion.
3. Keep the real selection-flow test on raw `/`.
4. Run affected specs in focused groups and classify any non-route failure independently.

### Task 4: Run deterministic gates

1. Run `npx playwright test` and record files/tests/pass/fail/skip/flaky counts.
2. Run `npm run type-check`, `npm run lint`, `npm test`, and `npm run build` after the latest edit.
3. Update workspace evidence/status only with fresh command results.

### Task 5: Independent closeout

1. Ask the read-only reviewer to inspect the current diff and evidence.
2. Resolve findings and rerun invalidated checks.
3. Run manual drift and Codex postflight.
4. Report full-suite completion only if no required gate remains.

### Execution amendments

- Focused failures proved that cozy picker navigation omitted the completed-selection marker; the approved production fix moved `setup=complete` ownership into `createArcadeExperienceSearch` and preserved it on the Classic link.
- Full-suite execution proved that map-object interactions continued during TEAM SELECT and could overwrite the next-match event with `TELEPORT`; the approved production fix gates map-object ticks to live combat.
- Legacy expectations were aligned to the current exact actor label/default-skin/weather-loop contracts. Timing fixes observe the same behavior deterministically and use no retry, assertion relaxation, or new skip.
- Final gate target remains 29 files / 83 scenarios with the existing conditional visual-evidence skip only.
