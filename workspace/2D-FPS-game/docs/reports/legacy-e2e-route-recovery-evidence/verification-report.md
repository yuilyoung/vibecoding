# Legacy E2E Runtime Route Recovery Verification

Date: 2026-10-28
Workspace: `workspace/2D-FPS-game`
Branch: `feature/phase8-audio-loop-ci`
Baseline HEAD during execution: `8d8d746`

## Outcome

The full Playwright release gate is restored against the current SelectionFlow-first product. The final one-worker run completed all 83 registered scenarios with 82 passes, the one pre-existing conditional Phase 12 visual-evidence skip, zero failures, and no retry-only passes.

## Recovered contracts

- Raw `/` is reserved for the real SelectionFlow entry test.
- Runtime tests use `runtimeRoute`, which preserves origin/path/query/hash, replaces duplicate or stale mode/setup values, and emits one `setup=complete`.
- Cozy and Classic picker transitions retain completed setup state and selected query values.
- Actor labels assert the current exact `<skin> · <trait>` contract.
- Unknown actor input normalizes to the configured animated default; corrupt actor assets still fall back atomically to legacy art.
- Generated rain, sandstorm, and storm ambience assertions match the enabled loop playback/stop contract.
- Map-object runtime side effects are inactive outside live combat. TEAM SELECT retains `SELECT TEAM FOR NEXT MATCH`, while combat-time teleporter behavior and cooldown remain covered.
- Reload, hazard, scene restart, and multi-capture tests observe real behavior deterministically without retries, new skips, or weakened assertions.

## Failure-to-green record

The first complete diagnostic run ended with 61 passed, 7 failed, 1 skipped, and 14 not run because a serial Phase 11 case stopped its remaining matrix. Failures were classified and reproduced as transient-state observation races, obsolete exact contracts, two insufficient scoped time budgets, a Phaser restart listener attached to an emitter cleared during shutdown, and a real out-of-combat teleporter update.

After the approved fixes:

- the seven previously failing scenarios passed as a focused group, with the HUD restart scenario then passing separately after holding Enter across a Phaser frame;
- the full Phase 11 acceptance file passed 15/15, including all 80 clips, six corrupt-asset fallbacks, the unknown-query default, transfer/GPU limits, five weather captures, and RED-team swap;
- the final complete browser run passed 82 and skipped only the existing conditional visual-evidence scenario in 13.5 minutes.
- independent read-only review reported no Critical, Important, or Minor findings after the final runtime-route correction.

## Final commands

| Command | Result |
| --- | --- |
| `npx playwright test --workers=1` | 82 passed, 1 skipped, 0 failed, 13.5m |
| `npm run type-check` | passed |
| `npm run lint` | passed |
| `npm test` | 86 files / 531 tests passed |
| `npm run build` | passed; 1,825 modules transformed |
| `npm run harness:test` | 17/17 passed |
| `npm run hermes:drift` | passed; no errors |
| `npm run codex-postflight` | passed; verification section synchronized |

Playwright configuration remains one worker, a 30-second global timeout, no retries, and failure-only screenshots/traces. Longer limits are scoped only to known multi-boot, scene-restart, or multi-capture tests.

## Scope and preservation

The workspace was already materially dirty and contains unrelated user work. No reset, cleanup, or root handoff mutation was performed. Delivery staging is restricted to the `workspace/2D-FPS-game` product code, tests, architecture/design records, and focused verification reports; root coordination changes, sibling-project work, browser reports, traces, and bulk generated captures remain outside the delivery commit. Review and evidence are scoped to the route helper and migrated navigation boundaries, the approved setup/Classic navigation changes, the live-combat map-object gate, exact current-contract updates, and deterministic E2E observation fixes.
