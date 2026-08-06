---
name: delivery-runbook
description: Run a non-trivial Codex change through product-owner planning, main-thread implementation, deterministic testing, and independent reviewer evidence checks. Use for features, bug fixes, refactors, or any completion claim that needs a reliability gate.
---

# Delivery Runbook

Use the plugin state machine for every non-trivial feature, bug fix, refactor, or completion claim.

1. Run `node plugins/hermes-ssot/scripts/harness-audit.mjs`.
2. Use `$knowledge-router` and read only the selected manuals.
3. Always ask the read-only `product_owner` for the five required sections and final `Decision: approved|blocked` before editing.
4. Implement the approved slice in the main thread. Do not delegate implementation to role-specialist agents.
5. Run deterministic checks after the latest edit. Bind evidence to the current workspace fingerprint; a previous fingerprint is stale evidence.
6. Always ask the read-only `reviewer` to inspect the current diff and evidence, ending with `Verdict: pass|revise|blocked`.
7. Run `node plugins/hermes-ssot/scripts/manual-drift-check.mjs` after reviewer pass.
8. Claim completion only after the hook state reaches `completed`. Add a lesson only for a reproducible corrective change.

The trust-reviewed plugin hooks block edits before design approval and automatically continue a stopping turn when a gate is missing. They are Codex guardrails, not administrator-enforced policy; do not bypass hook trust or normal permission prompts. See [state-machine.md](references/state-machine.md) when debugging or extending the harness.

Use testing as a gate, not as a standing subagent role. Report a blocked gate instead of inferring success.
