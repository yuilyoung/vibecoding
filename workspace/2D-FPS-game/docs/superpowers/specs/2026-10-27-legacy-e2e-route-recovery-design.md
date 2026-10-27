# Legacy E2E Runtime Route Recovery Design

## Goal

Restore the full Playwright regression gate after `/` became the SelectionFlow entry point, without changing production behavior or weakening existing assertions.

## Route boundary

- Tests that verify the initial selection experience navigate to raw `/` and complete the real form interaction.
- Tests that start from an already selected game navigate through a test-only runtime-route helper.
- The helper preserves an absolute URL origin, deployment pathname, existing query parameters, and fragment while setting exactly one `setup=complete` query parameter.
- `PLAYTEST_BASE_URL` remains authoritative when supplied; the helper augments that URL instead of replacing its origin or path.

## Non-goals

- No `src/` behavior changes.
- No forced DOM visibility, assertion relaxation, new retries, or new skips.
- No Playwright configuration changes unless a separately reproduced configuration defect requires a new approval.
- No root handoff or coordination-record updates; the root handoff is complete and this is an explicit workspace task.

## Test design

1. A Vitest contract covers relative routes, existing queries, duplicate/replaced setup values, fragments, and absolute deployment URLs.
2. The previously failing HUD layout test proves that the helper opens visible runtime UI.
3. SelectionFlow coverage stays on raw `/` and proves the real submit transition.
4. Every legacy canvas/HUD/combat/presentation spec uses a completed runtime route while retaining its existing feature assertions.
5. The full Playwright suite must finish with no unexpected failure, timeout, retry-only pass, or new skip.

## Approved gate

The project product owner approved this boundary on 2026-10-27 with the selected manuals `handoff-execution`, `game-verification`, and `reliability-gate`.

## Approved implementation amendments

Focused browser execution exposed two production defects outside the original test-only hypothesis. The product owner separately approved both amendments before implementation:

- `createArcadeExperienceSearch` owns exactly one `setup=complete` parameter, while `SelectionFlow` appends only the selected enemy count and weather. The active cozy picker's Classic link also carries `setup=complete`. This prevents a valid picker submission or mode switch from returning to SelectionFlow and losing the selected experience.
- `MainScene` advances map-object runtime interactions only while combat is live. This prevents teleporter, mine, and drop side effects from mutating state during TEAM SELECT, round transition, or MATCH OVER while preserving their combat behavior.

The product owner also approved scoped E2E observation fixes: exact current HUD labels, atomic reload-state observation, one deterministic real hazard update, shutdown-before-restart synchronization, a held Enter key for Phaser frame observation, and per-test time budgets only for multi-boot or multi-capture scenarios. Assertions, capture counts, the 83-scenario total, and the existing conditional visual-evidence skip remain unchanged.
