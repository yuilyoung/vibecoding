# AI Project Control Plane v5

`npm run dashboard` starts the repository-local operations dashboard at `127.0.0.1:4173`. It discovers direct projects under `work/*`, links the selected project to its detailed delivery board, and combines invocation observability with a project-scoped orchestration cycle map.

## Information architecture

The UI is ordered from portfolio to evidence:

1. Portfolio cards show every direct `work/*` project, current milestone progress, total completeness, current work, blocked state, and source path.
2. Selecting a card updates the detailed roadmap, Kanban, quality gates, attention queue, prompt/token metrics, and graphs without losing the selection during SSE refresh.
3. The invocation forest lays parent/child agent calls and returns out horizontally with provider-qualified IDs.
4. The cycle map lays agents out horizontally and the fixed `analysis → design → design_verification → implementation → implementation_verification → feedback → revision` pipeline vertically. The freshest non-terminal step and inbound edge are highlighted and move on the next SSE snapshot.
5. Missing evidence remains `unknown`; `ready`, `research`, `blocked`, and outcome-unknown `stopped` are never counted as completed.

`2D-FPS-game` and `animation_real_studio` use explicit adapters. Other direct directories receive a conservative generic adapter with unknown progress/completeness until they expose supported project evidence. Symbolic links and files directly under `work` are not treated as projects. Durable completed WBS tasks cannot be demoted by stale runtime events.

The agent view distinguishes configured from observed agents. Live edges require a fresh event within 15 seconds and fresh 30-second endpoint heartbeats. Historical and Paperclip organization edges stay visible without live animation. `prefers-reduced-motion: reduce` removes packet and edge motion while keeping arrows and stage text. Nodes and edge controls are keyboard selectable.

Trusted Hermes hooks publish bounded prompt metadata plus heartbeat, invocation, delegation, lifecycle, reviewer-result, and cycle events. Explicit provider adapters may publish `created -> called -> responded|failed|cancelled|stopped`. The Codex hook itself has narrower evidence: `SubagentStart` supplies the unique `agent_id` and parent `session_id`, so Hermes emits `called`; `SubagentStop` does not expose success/failure/cancellation, so Hermes emits outcome-unknown `stopped`. Invalid invocation or cycle order, identity changes, missing predecessors, and terminal continuation are excluded and surfaced in the attention queue.

`unknown`, `partial`, `stale`, `unavailable`, and `0` are different states. Missing telemetry is never displayed as zero. Browser SSE connectivity and event-producer freshness are independent.

## Commands

```powershell
npm run dashboard
npm run dashboard:snapshot
npm run dashboard:event -- --agent ultron --project 2D-FPS-game --state active --type heartbeat --task dashboard-v5 --event-message "working"
npm run dashboard:event -- --agent ultron --project 2D-FPS-game --state active --type cycle --task dashboard-v5 --cycle-id cycle-1 --step-id analysis-1 --pipeline-stage analysis --cycle-sequence 1 --cycle-state active --summary "Request analysis"
npm run dashboard:event -- --agent ultron --project 2D-FPS-game --state active --type prompt --task dashboard-v5 --prompt "Show the agent invocation tree"
npm run dashboard:event -- --agent ultron --project 2D-FPS-game --state active --type prompt --task dashboard-v5 --invocation-id inv-1 --invocation-provider runtime --prompt "Show the selected invocation safely"
npm run dashboard:event -- --agent ultron --project 2D-FPS-game --state active --type invocation --task dashboard-v5 --invocation-id inv-1 --parent-agent ultron --child-agent reviewer --stage created --direction call --sequence 1 --provider runtime --provider-ref cli:subagent
npm run dashboard:event -- --agent ultron --project 2D-FPS-game --state active --type invocation --task dashboard-v5 --invocation-id inv-1 --parent-agent ultron --child-agent reviewer --stage called --direction call --sequence 2 --provider runtime --provider-ref cli:subagent
npm run dashboard:event -- --agent reviewer --project 2D-FPS-game --state active --type invocation --task dashboard-v5 --invocation-id inv-1 --parent-agent ultron --child-agent reviewer --stage responded --direction return --sequence 3 --provider runtime --provider-ref cli:subagent
npm run dashboard:event -- --agent ultron --project 2D-FPS-game --state active --type metric --task dashboard-v5 --invocation-id inv-1 --invocation-provider runtime --input-tokens 120 --output-tokens 80 --total-tokens 200 --usage-id runtime:inv-1:1 --usage-source runtime --usage-scope exclusive --metric-mode delta
npm run dashboard:event -- --agent worker --project 2D-FPS-game --state active --type heartbeat --task dashboard-v5 --organization-id fps-metaverse --entity-id worker --parent-entity-id director --team agent-squad --role reviewer --activity active --paperclip-ref paperclip:worker
npm run test:dashboard
npm run test:dashboard:ui
```

The UI test starts an isolated loopback server and temporary journal. It verifies project metrics, roadmap, Kanban interaction, nested invocation direction, live SSE call/return updates, Paperclip provenance, keyboard selection, reduced motion, and desktop/tablet/mobile overflow.

## API and snapshot contract v4.1

- `GET /api/health`
- `GET /api/observability/snapshot`
- `GET /api/observability/events` — SSE snapshot every 2 seconds
- `POST /api/observability/events` — validated loopback-only event ingestion

The additive snapshot includes `portfolio.projects[]`, legacy baseline `project`/`roadmap`/`kanban`, `agents`, `topology`, `communications`, `invocationActivities`, `orchestration.cycles[]`, project-indexed prompt/token metrics, collectors, integration readiness, and source/error evidence. Old journal rows without `projectId` are retained as `unassigned` history, visible only through the explicit `미배정 이력` toggle, and do not mutate a named project's current work.

The standalone server prewarms the first snapshot. Static workspace/project/harness collector results are reused for 30 seconds, while journal-backed agent, invocation, prompt, and token projections are recalculated for every SSE snapshot.

Token events are immutable exclusive deltas. Each `usageId` is counted once; identical replay is ignored and conflicting replay is excluded. Invocation-linked prompt and token rows require `invocationProvider` and are indexed by `<provider>:<invocationId>`, preventing runtime/Paperclip/LangSmith ID collisions. A provider-supplied input/output/total value is `exact`; a total calculated from exact input plus output is `derived`; incomplete coverage is `partial`; no evidence is `unknown`. `usageSource` is `runtime`, `langgraph`, `langsmith`, or `paperclip`.

The local append-only journal is `dashboard/runtime/agent-events.jsonl` and is gitignored. It never stores a full/raw prompt, tool payload, credential, or full subagent response. Prompt capture uses the same redaction module as Hermes, redacts environment-variable credential names, space-separated credential labels, quoted values, Basic/Bearer authorization, credential URLs, private keys, and known provider tokens before truncation, then stores only a maximum 160-code-point preview plus length/status metadata. High-risk content is replaced with `[sensitive content omitted]`.

## Paperclip

Paperclip is an adapter contract, not a bundled remote client. An owning adapter can emit provider-referenced invocation, organization, heartbeat, task, and token rows. Only observed entity, parent, organization, team, role, activity, and reference values create Paperclip nodes. `PAPERCLIP_URL` without observed rows displays `configured · no observed values`; it does not synthesize an organization. Runtime and Paperclip IDs are provider-qualified when they collide.

See `docs/development/dashboard-v5-architecture.md` for boundaries, adapters, cycle contracts, lifetimes, privacy rules, and rejected alternatives. The v4 document remains historical context for the invocation forest.
