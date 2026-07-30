# Review against the active baseline

> Verify that a change remains compatible with the active Phaser implementation baseline and declared handoff.

## Order

1. Read `docs/development/active-workspace-baseline.md`.
2. Read the current handoff only when the change is handoff-driven.
3. Inspect the real diff and affected runtime paths.
4. Compare the evidence with the relevant acceptance criteria.
5. Report pass, revise, or blocked with file and command evidence.

## Method

- Use `work/2D-FPS-game` as the executable authority for implementation and verification.
- Identify scope expansion, documentation conflicts, behavior regressions, and untested changed paths.
- Keep findings actionable: cite the affected file, behavior, and missing proof.

## Cautions

- Root roadmap documents can be older than the active implementation baseline.
- A clean diff is not proof of correct runtime behavior.
- Do not issue style-only findings unless they conceal a correctness or maintenance risk.
