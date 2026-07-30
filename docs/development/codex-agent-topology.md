# Codex Agent Topology

## Operating model

The main Codex thread owns implementation. It uses two narrow, sequential subagent gates:

1. `product_owner` defines a bounded outcome, selected manuals, acceptance criteria, and verification plan before non-trivial work.
2. The main thread implements and runs deterministic verification.
3. `reviewer` independently checks the diff, evidence, scope, and manual freshness before completion.

Testing is a deterministic verification gate and demand-loaded manual, not a permanent `test` agent. This avoids unnecessary handoffs and context loss while preserving independent challenge.

## Knowledge model

- Keep volatile domain knowledge in `codex/manuals/` and route to it through the `knowledge-router` skill.
- Keep repeatable process in plugin skills.
- Keep only reviewed, reproducible observations in `codex/state/lessons.md`.
- Keep implementation authority in `work/2D-FPS-game` and long-term product guidance in root `docs/`.

## Sources

- Hermes overview video: https://www.youtube.com/watch?v=yupLx5y4JJY
- Skills methodology video: https://www.youtube.com/watch?v=2oOXHWGn_Cw
- PO and reviewer topology video: https://www.youtube.com/watch?v=iI4O8HCW8tY
- Anthropic's supporting skills and validation article: https://claude.com/blog/how-anthropic-enables-self-service-data-analytics-with-claude
