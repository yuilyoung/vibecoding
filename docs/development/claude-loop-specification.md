# Claude Harness Loop Specification

## Loop Card

| Field | Rule |
|---|---|
| Name | `claude-four-axis-ssot` |
| Trigger | Manual request, canonical-source change, or freshness expiry |
| Goal | Make a bounded change with current context and independently verified evidence |
| Controller | Hermes |
| Independent verifier | `adversarial-validator` plus deterministic project checks |
| Memory | `.claude/state/ssot-metadata.json`, `.claude/state/ssot-evidence.json`, project mailbox |
| Budget | One bounded scope; stop after two unchanged failed checks |

## Execution

1. Hermes loads metadata and runs `npm run harness-audit`.
2. Hermes creates six or more counterexample questions.
3. The responsible agent plans or implements inside existing permission boundaries.
4. `adversarial-validator` challenges every claim using the manual, metadata, and reproducible evidence.
5. The responsible verifier runs applicable deterministic checks. For the active game workspace, choose among type-check, lint, unit tests, build, and browser E2E rather than assuming every command is needed.
6. Hermes records evidence, freshness, risk, and terminal state.

## Terminal States

| State | Meaning | Next action |
|---|---|---|
| `success` | All gates passed with current evidence | Handoff to PM or Vision |
| `no-op` | Evidence proves no change is needed | Record why and freshness |
| `blocked` | Missing approval, source, or unresolved high-risk finding | Escalate to Vision |
| `stalled` | Two attempts produced no new evidence or progress | Narrow the scope |
| `exhausted` | Time or iteration budget consumed | Preserve evidence and request a decision |

## Stop Rules

- Stop on a Critical finding, unresolved security issue, or write-boundary violation.
- Stop before a third identical failure.
- Stop when required source data is stale or unknown.
- Require human approval before network refresh, external installation, deletion, deployment, or publishing.