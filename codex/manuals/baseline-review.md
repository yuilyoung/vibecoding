# Review against the active baseline

> Verify that a change remains compatible with the active Phaser implementation baseline and declared handoff.

## Order

1. Identify the requested workspace. Read `docs/development/active-workspace-baseline.md` for active game work; for an explicitly named separate workspace, use its nearest governing documents and executable evidence.
2. Read the current handoff only when the change is handoff-driven.
3. Inspect the real diff and affected runtime paths.
4. Compare the evidence with the relevant acceptance criteria and the active phase/task status.
5. When scoped equivalents exist, confirm that the requested workspace's project status, task files, and next-task output describe the same delivery state; never substitute unrelated game outputs.
6. Report pass, revise, or blocked with file and command evidence.

## Method

- Use `workspace/2D-FPS-game` as the executable authority for active game work. For an explicit separate-workspace request, use that workspace's implementation and verification commands without importing an unrelated game handoff.
- When status adds an umbrella product goal, verify that it does not overstate the executable phase and that generated next tasks still point only to the active implementation slice.
- Identify scope expansion, documentation conflicts, behavior regressions, and untested changed paths.
- Treat generated status commands as evidence for the current phase, while keeping volatile counts in their source report rather than this manual.
- Keep findings actionable: cite the affected file, behavior, and missing proof.

## Cautions

- Root roadmap documents can be older than the active implementation baseline.
- A clean diff is not proof of correct runtime behavior.
- Do not issue style-only findings unless they conceal a correctness or maintenance risk.
