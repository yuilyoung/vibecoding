---
name: development-engineering-router
description: Route software engineering requests to only the necessary architecture, implementation, database, concurrency, native C++, UI, observability, or repository-harness guidance. Use at the start of non-trivial feature development, refactoring, system design, class design, DB work, MVVM/UI threading, DI, C++ ownership, verification logging, status-callback work, or four-axis/Hermes harness work when the correct skill, manual, or reference must be selected without loading every document.
---

# Development Engineering Router

Classify the request and load only the matching guidance. Do not load every skill or reference by default.

## Routing Index

| Request signal | Load | Order |
| --- | --- | --- |
| New architecture, boundary, module, UML, API/protocol | `$development-engineering:architecture-first-design` | First |
| New database model, schema, migration, transaction design | `$development-engineering:architecture-first-design` | First |
| Feature implementation or refactor within established boundaries | `$development-engineering:layered-implementation` | Direct |
| Interface/abstract class, DI Factory, Facade, Manager, Collector | `$development-engineering:layered-implementation` | Direct |
| MVVM, ViewModel, Controller, UI/worker thread split | `$development-engineering:layered-implementation` | Direct |
| Connection pool, DAO/DTO, sync/async, locks, data structures | `$development-engineering:layered-implementation` | Direct |
| Native/Raw C++ lifetime and smart pointers | `$development-engineering:layered-implementation` | Direct |
| Verification logs, progress/status callbacks, correlation IDs | `$development-engineering:layered-implementation`, then its `references/observability-contract.md` | Direct |
| Repository four-axis knowledge, Hermes state machine, hook loop, freshness, reliability gate | Repository `hermes-ssot:delivery-runbook`, then `hermes-ssot:knowledge-router` for only the catalog-selected manual | Direct |
| New architecture followed by implementation | Both skills | Architecture, then implementation |
| Small local fix with no boundary/lifetime/schema impact | Repository conventions only | Skip extra skills |

## Routing Procedure

1. Inspect repository instructions and the requested change.
2. Identify whether the task changes boundaries, contracts, schema, ownership, concurrency, or only concrete behavior.
3. Select the narrowest row in the index.
4. Announce the selected skill and why.
5. Read the selected `SKILL.md` completely.
6. Load only references named by its internal index and relevant to the current task.
7. If implementation discovers an unresolved architectural decision, stop concrete expansion and route through `$development-engineering:architecture-first-design`.

## Combined Work

For non-trivial greenfield or cross-layer work:

1. Use `$development-engineering:architecture-first-design` to produce boundaries, interfaces, schemas, UML, lifetimes, and verification gates.
2. Use `$development-engineering:layered-implementation` to implement one vertical slice against that contract.
3. Load the observability reference only when operations are long-running, asynchronous, database-backed, agent/collector-driven, or need progress/verification evidence.

Keep the router concise. Add a new specialist skill only when it has a distinct trigger, workflow, and reusable body that cannot remain a demand-loaded reference.

## ai-project Harness Index

Use this index only inside the `ai-project` repository:

| Concern | Canonical location |
| --- | --- |
| Claude four-axis normative method | `docs/development/claude-four-axis-ssot.md` |
| Claude bounded loop and terminal states | `docs/development/claude-loop-specification.md` |
| Claude Hermes agent implementation | `.claude/agents/hermes.md` |
| Claude independent counterexample role | `.claude/agents/adversarial-validator.md` |
| Codex four-axis metadata | `codex/state/reliability-metadata.json` |
| Codex manual routing index | `codex/manuals/catalog.json` |
| Codex reliability procedure | `codex/manuals/reliability-gate.md` and `hermes-ssot:delivery-runbook` |

The four-axis and loop documents are demand-loaded knowledge, not the harness itself. Do not treat the Claude Hermes agent as a Codex subagent. Codex uses the main thread, `product_owner`, and read-only `reviewer`; the Hermes plugin supplies trust-reviewed lifecycle hooks, an ordered evidence state machine, indexed skills, and drift gates. The active executable workspace wins over stale planning text.
