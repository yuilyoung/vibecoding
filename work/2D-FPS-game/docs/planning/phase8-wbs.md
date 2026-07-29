# Phase 8 WBS - Environment Audio Polish

- Date: 2026-04-27
- Owner: ultron/codex
- Status: complete
- Handoff: `../../../../docs/handoffs/current-handoff.json` (id: `phase-8-environment-audio-polish`)

## Summary

Phase 8 focuses on audio readability and perceived combat quality. The project already has deterministic cue routing and generated weather loop contracts, but the current mix is still prototype-grade. This phase upgrades clarity, prioritization, loop behavior, and QA visibility without widening scope into external asset production.

## Goals

1. Make combat, pickup, hazard, and weather cues easier to distinguish during short matches.
2. Reduce cue fatigue by tightening cooldowns, priority, and loop transitions.
3. Keep audio behavior testable and mostly config-driven.
4. Expose enough audio state through HUD/debug and documentation for repeatable tuning.

## Tasks

| ID | Work | Assignee | Depends | Acceptance | Status |
| --- | --- | --- | --- | --- | --- |
| T0 | Create Phase 8 WBS, tasks JSON, handoff, and specialist brief | ultron/doc-writer | - | A1 | completed |
| T1 | Audit current audio contract and lock the Phase 8 execution slice | ultron/audio-specialist | - | A2 | completed |
| T2 | Expand generated cue tuning contract and cue profile definitions | ultron/audio-specialist | T1 | A3 | completed |
| T3 | Improve runtime audio prioritization, loop switching, and anti-fatigue behavior | ultron/audio-specialist | T2 | A4 | completed |
| T4 | Expose audio debug and HUD-facing state for QA | ultron/audio-specialist | T3 | A5 | completed |
| T5 | Add deterministic unit coverage for audio routing and loop behavior | ultron/qa | T2, T3, T4 | A6 | completed |
| T6 | Expand browser coverage for weather and combat audio behavior | ultron/qa | T3, T4 | A7 | completed |
| T7 | Update playtest, tuning, and direction/status documents for Phase 8 | ultron/doc-writer | T1, T4, T6 | A8 | completed |
| T8 | Run verification gates, refresh execution report, and sync postflight | ultron/qa | T0-T7 | A9-A12 | completed |

## Dependency Graph

```text
T0 -------------------------------------------------------------> T8
T1 -> T2 -> T3 -> T4 -> T5 ------\
                    \-> T6 -------+-> T8
T1 -----------------------> T7 ---/
```

## Delivery Notes

- Keep the generated Web Audio path; do not introduce an external audio asset pipeline in this phase.
- Audio polish should improve clarity through contract and runtime behavior, not through unrelated UI redesign.
- Weather loop behavior should remain deterministic across resets and same-type transitions.
- Any new debug payloads should be optional and additive.
- T1 audit conclusion: Phase 8 execution remains locked to generated-audio readability, runtime priority tuning, weather loop ownership, and QA visibility. External asset production remains out of scope.
- T2 implementation conclusion: generated cue tuning is now balance-configurable through `gameBalance.audio.cueProfiles` and `maxSimultaneous`, with pure unit coverage on tone override merging.
- T3 implementation conclusion: active weather-loop ownership now lives in `AudioFeedbackController`, one-shot cue priority can be overridden through `audio.cueRules`, and loop replay is protected by a runtime cooldown.
- T4/T5 implementation conclusion: HUD/debug snapshots now include audio runtime state and deterministic unit coverage exists for cue-rule overrides, generated tone overrides, and weather-loop queue behavior.
- T6 conclusion: browser coverage verifies weather-loop dedup, reset, switch, and HUD/debug active-loop state; existing combat browser coverage continues to exercise cue visibility.
- T7 conclusion: the Phase 8 audit, direction, playtest, tuning, and project-status guidance are synchronized around deterministic generated-audio loops and QA observability.
- T8 conclusion: type-check, lint, 56-file/331-test unit suite, production build, 30-test Playwright suite, and MainScene 838/850 LOC gate passed; postflight and execution reporting are refreshed.

## Verification Gates

| Gate | Command | Pass Condition |
| --- | --- | --- |
| type-check | `npm run type-check` | 0 errors |
| lint | `npm run lint` | 0 errors |
| unit | `npx vitest run --maxWorkers 1` | Existing suite plus new audio coverage passes |
| build | `npm run build` | Production build passes |
| e2e | `npx playwright test --reporter=line` | Existing 30 E2E plus Phase 8 audio coverage passes |
| loc | `node scripts/check-mainscene-loc.mjs` | `MainScene.ts` remains within gate |

## Risks

- Generated audio may still sound prototype-like even after logic polish. This phase should improve readability first, not attempt full production sound design.
- New audio debug fields can drift from runtime behavior if HUD/debug and audio controller changes land separately.
- Audio cooldown retuning can accidentally hide important feedback, so unit and browser checks must cover both dedup and audibility paths.
