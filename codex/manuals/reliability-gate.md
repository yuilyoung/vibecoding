# Run the Hermes reliability gate

> Use procedural manuals, independent review, and evidence freshness to make a non-trivial Codex change trustworthy.

## Order

1. Run `node plugins/hermes-ssot/scripts/harness-audit.mjs`.
2. Use the knowledge-router skill to select at most three relevant manuals.
3. Ask `product_owner` for one bounded plan before implementation.
4. Implement in the main Codex thread and run the selected deterministic checks.
5. Ask `reviewer` to challenge the diff, manual freshness, and claimed evidence.
6. Run `node plugins/hermes-ssot/scripts/manual-drift-check.mjs` before final completion.
7. Record a lesson only when it is reproducible and changes a manual or skill.

## Method

- Keep declarative knowledge in demand-loaded manuals and repeatable process in skills.
- Use PO and reviewer as the only standing subagent roles; testing is a verification gate, not an organizational role.
- Prefer source-backed evidence, a named owner, and an expiry or drift signal over self-assessment.

## Cautions

- Do not let the lesson log become hidden standing instructions.
- Do not create more specialist roles merely to mirror a human organization chart.
- Do not run network refreshes or widen permissions without user approval.
