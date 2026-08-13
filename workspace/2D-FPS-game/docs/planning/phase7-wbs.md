# Phase 7 WBS - Tactical Combat Depth

- Date: 2026-04-27
- Owner: ultron/codex
- Status: complete
- Handoff: `../../../../docs/handoffs/current-handoff.json` (id: `phase-7-tactical-combat-depth`)

## Summary

Phase 7 focused on combat readability and tactical depth rather than new feature surface area. The phase outcome is a config-driven tactical combat loop: clearer bot intent, stronger cover behavior, smarter weapon choice, and a repeatable HUD/debug-backed tuning path.

## Goals

1. Make bot behavior readable through explicit tactical intent.
2. Improve combat decisions using HP, distance, LOS, cover, and weather context.
3. Keep balance data authored in config and keep tactical reasoning in pure domain logic.
4. Support deterministic QA and tuning with tactical HUD/debug payloads and tactical E2E coverage.

## Tasks

| ID | Work | Assignee | Depends | Acceptance | Status |
| --- | --- | --- | --- | --- | --- |
| T0 | Phase 7 WBS, tasks JSON, and handoff package | ultron/doc-writer | - | A1 | completed |
| T1 | Add `botTactics`, `weaponRoles`, and `combatTuning` contracts | ultron/game-specialist | - | A2 | completed |
| T2 | Add `pressure`, `hold`, `retreat`, and `flank` AI states | ultron/game-specialist | T1 | A3 | completed |
| T3 | Add tactical positioning and connect cover plus LOS helpers | ultron/game-specialist | T1 | A4 | completed |
| T4 | Add role-aware weapon selection | ultron/game-specialist | T1 | A5 | completed |
| T5 | Expose tactical state through combat controller, debug, and HUD | ultron/game-specialist | T2, T3, T4 | A6 | completed |
| T6 | Expand unit coverage for tactical AI, positioning, weapons, and HUD | ultron/qa | T2, T3, T4, T5 | A7 | completed |
| T7 | Add tactical E2E and update balance playtest coverage | ultron/qa | T5 | A8 | completed |
| T8 | Update playtest, tuning, and direction documents for Phase 7 | ultron/doc-writer | T1, T5, T7 | A9 | completed |
| T9 | Run verification gates, refresh execution report, and sync postflight | ultron/qa | T0-T8 | A10-A13 | completed |

## Dependency Graph

```text
T0 --------------------------------------------------------------> T9
T1 -> T2 ----\
      T3 -----+-> T5 -> T6 ----\
      T4 ----/                  +-> T9
T5 -> T7 ----------------------/
T1 -> T8 ----------------------/
```

## Delivery Notes

- Tactical state now exports `pressure`, `hold`, `retreat`, and `flank`.
- Tactical positioning is handled by `TacticalPositionLogic.ts` and reuses `CoverLogic.ts` plus `LineOfSightLogic.ts`.
- Weapon roles are authored in balance config and consumed by weapon evaluation rather than hardcoded distance checks.
- HUD and debug payloads now expose tactical intent, target cover, chosen weapon id, and chosen weapon role.
- Deterministic tactical validation now exists in both unit tests and `tests/e2e/combat-depth.spec.ts`.

## Verification Gates

| Gate | Command | Result |
| --- | --- | --- |
| type-check | `npm run type-check` | pass |
| lint | `npm run lint` | pass |
| tactical unit suite | `npx vitest run tests/AiStateMachine.test.ts tests/DummyAiLogic.test.ts tests/TacticalPositionLogic.test.ts tests/CoverLogic.test.ts tests/LineOfSightLogic.test.ts tests/WeaponLogic.test.ts tests/WeaponInventoryLogic.test.ts tests/HudPresenters.test.ts --maxWorkers 1` | pass |
| build | `npm run build` | pass |
| tactical E2E | `npx playwright test tests/e2e/playtest-balance.spec.ts tests/e2e/combat-depth.spec.ts --reporter=line` | pass |
| LOC gate | `node scripts/check-mainscene-loc.mjs` | pass (`835/850`) |

## Risks

- Full Playwright regression was not rerun during this closeout. Tactical E2E passed, but broader browser regressions would still require a full suite run.
- Tactical snapshot shape is now shared by HUD and debug consumers, so future changes should preserve the optional field contract.
