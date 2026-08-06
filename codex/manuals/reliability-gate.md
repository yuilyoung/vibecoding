# Run the Hermes reliability gate

> Use procedural manuals, independent review, and evidence freshness to make a non-trivial Codex change trustworthy.

## Order

1. Run `node plugins/hermes-ssot/scripts/harness-audit.mjs`.
2. Use the knowledge-router skill to select at most three relevant manuals.
3. For every non-trivial change, ask `product_owner` for the five-section design and `Decision: approved` before editing.
4. Implement in the main Codex thread. A plugin `PreToolUse` hook denies normal edit paths until design approval.
5. Run the selected deterministic checks after the latest edit; the harness binds evidence to a workspace fingerprint.
6. Ask `reviewer` to challenge the current diff and evidence and end with `Verdict: pass|revise|blocked`.
7. Run `node plugins/hermes-ssot/scripts/manual-drift-check.mjs` after reviewer pass.
8. Complete only when the hook state is `completed`; record a lesson only when it is reproducible and changes a manual or skill.

## Method

- Keep declarative knowledge in demand-loaded manuals and repeatable process in skills.
- Use PO and reviewer as the only standing subagent roles; testing is a verification gate, not an organizational role.
- Prefer source-backed evidence, a named owner, and an expiry or drift signal over self-assessment.
- Store runtime evidence as append-only JSONL plus an atomic status snapshot under the plugin data directory.
- Treat any edit after verification as evidence invalidation: verification, review, and drift must run again.

## Cautions

- Do not let the lesson log become hidden standing instructions.
- Do not create more specialist roles merely to mirror a human organization chart.
- Do not run network refreshes or widen permissions without user approval.
- Plugin hooks are trust-reviewed Codex guardrails, not administrator-managed enforcement. After install or hook changes, review them with `/hooks`; do not bypass trust or permission prompts.
- Hook coverage has documented exceptions, so keep the `AGENTS.md` contract and independent evidence review in place.
