---
name: delivery-runbook
description: Run a non-trivial Codex change through product-owner planning, main-thread implementation, deterministic testing, and independent reviewer evidence checks. Use for features, bug fixes, refactors, or any completion claim that needs a reliability gate.
---

# Delivery Runbook

1. Run `node plugins/hermes-ssot/scripts/harness-audit.mjs`.
2. Use `$knowledge-router` and read the selected manuals.
3. Ask the `product_owner` subagent for the bounded plan when scope, acceptance, or verification is not already explicit.
4. Implement in the main thread; do not create role-specialist implementation agents.
5. Run the deterministic checks required by the selected verification manual.
6. Ask the `reviewer` subagent to inspect the diff and evidence.
7. Run `node plugins/hermes-ssot/scripts/manual-drift-check.mjs` before claiming completion.
8. Add a lesson only when a reviewer confirms a reproducible corrective change.

Use testing as a gate, not as a standing subagent role. Report a blocked gate instead of inferring success.
