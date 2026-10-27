# Combat service hardening verification report

- Verification date: 2026-10-27 (Asia/Seoul)
- Branch: `feature/phase8-audio-loop-ci`
- Baseline commit: `8d8d746`
- Worktree condition: broad pre-existing tracked and untracked changes were preserved; no commit or staging was performed

## Passing deterministic gates

| Command | Result |
| --- | --- |
| `npm run type-check` | pass, exit 0 |
| `npm run lint` | pass, exit 0 |
| `npm test` | pass, 85 files / 524 tests |
| `npm run build` | pass, Vite 7.3.2, 1825 modules transformed |
| Focused combat tests | pass, roster/controller/squad/HUD 5 files / 33 tests before final full run; final full unit suite includes the same cases |
| Focused collision/reload/audio review regressions | pass, 3 files / 21 tests; included in the final full run |
| `tests/e2e/combat-roster.spec.ts` | pass: independent CPU fire, 3/3 roster/HUD, one-death continuation, aggregate win, full reset |
| `tests/e2e/environment-audio-readiness.spec.ts` | pass using real PLAY/Enter input: running Web Audio context, scheduled `ambient.neon-city` and `weather.storm.loop`, selected storm mechanics/presentation, live settings mute to output volume 0 |
| Scoped `git diff --check` | pass; only line-ending conversion warnings were emitted |
| Independent read-only review | pass after reload, bounce ordering/boundary, audio lifecycle, and as-built/future documentation corrections |
| `npm run hermes:drift` | pass, `ok: true`, no errors |
| `npm run codex-postflight` | pass, report present and verification section detected |

## Full browser-suite observation

`npm run test:e2e -- --workers=1` discovered 83 tests. The run was stopped after 17 cases because legacy scenarios were taking 1.5-3 minutes each and repeatedly timing out. At the stop point, 7 had passed and 10 had failed. The dominant failure fingerprint is a stale route assumption: tests open `/` expecting an immediately visible game canvas and classic `foundry`/`relay-yard`/`storm-drain` stages, while the current product route intentionally shows the new character/map selection flow and hides the canvas until a `setup` query is present. One narrow settings viewport assertion also failed independently.

This is recorded as a harness/release-gate blocker, not hidden as a product pass. The two new feature-scoped browser scenarios pass on explicit setup routes. Updating every legacy scenario to declare whether it validates the selection route, cozy runtime, or classic recovery route is follow-up work outside this bounded combat slice.

## Defects demonstrated and corrected

- High-speed bullets could resolve an endpoint actor behind an obstacle crossed earlier in the same frame, while bounce response could collapse the sweep and skip an actor before the wall. Earliest-impact selection now runs on intended pre-response motion and fast wall contacts reflect only when the wall wins; both ordinary and map bounce walls separate the reflected projectile from the inclusive contact boundary so the next frame moves away instead of immediately re-colliding.
- Weapon switching selected the next slot before cancelling reload and the runtime inventory held metadata instead of the scene's weapon logic. The inventory now shares the exact weapon instances and controller switching cancels the outgoing reload at the supplied time.
- Combat targeting and win logic were coupled to one primary dummy. All projectile/beam/explosion targets now use stable actor identity/team and aggregate roster elimination.
- Additional CPUs existed visually but did not participate in the common fire/hit/reset pipeline. They now own independent weapon state, fire through the common controller and reset with the round.
- Map BGM playback had no observable ownership state, stopped changing pitch after 256 scheduled notes, ignored live volume changes, and could leak weather audio on shutdown. Runtime state now reports actual scheduling/context state, motifs reschedule until stopped, running gains follow settings, and idempotent teardown stops both loop families and closes the context.

## Explicit non-claims

- No hosted online multiplayer server or client transport was built.
- No load, latency, reconnect, cross-region, authentication, anti-cheat or deployment evidence exists for online play.
- Generated oscillator motifs are functional background music, not mastered commercial soundtrack assets.
