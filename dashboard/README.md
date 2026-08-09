# AI Project Control Plane v4

`npm run dashboard` starts the repository-local operations dashboard at `127.0.0.1:4173`. It combines the active 2D-FPS delivery board with evidence-backed agent invocation observability; it is not a static status mockup.

## First-viewport contract

The desktop first viewport preserves the original project-management surface and adds execution telemetry:

1. The original eight metrics remain visible: project progress, unit tests, E2E, LOC budget, work queue, live agents, live links, and total tokens.
2. Input tokens, output tokens, and the latest bounded prompt preview are visible as additional metrics.
3. The roadmap shows phase progress, the current sprint when one exists, and the next product decision. No active sprint is displayed as `활성 스프린트 없음`.
4. The five-column `Decision / Active / Review / Blocked / Done` Kanban remains interactive.
5. The SVG agent constellation uses deterministic tree/forest lanes. Parent-to-child calls and child-to-parent returns have distinct arrow, label, glow, and traveling-packet treatments.
6. The invocation inspector shows the selected call's prompt metadata and exact/derived/partial/unknown input, output, and total token values.

Project data comes from `work/2D-FPS-game/docs/reports/project-status.md`, `docs/planning/phase*-tasks.json`, and `docs/handoffs/current-execution-report.md`. Durable completed WBS tasks cannot be demoted by stale runtime events. Selecting a card opens dependencies, acceptance criteria, owner, files, and source evidence.

The agent view distinguishes configured from observed agents. Live edges require a fresh event within 15 seconds and fresh 30-second endpoint heartbeats. Historical and Paperclip organization edges stay visible without live animation. `prefers-reduced-motion: reduce` removes packet and edge motion while keeping arrows and stage text. Nodes and edge controls are keyboard selectable.

Trusted Hermes hooks publish bounded prompt metadata plus heartbeat, invocation, delegation, lifecycle, and reviewer-result events. Explicit provider adapters may publish `created -> called -> responded|failed|cancelled|stopped`. The Codex hook itself has narrower evidence: `SubagentStart` supplies the unique `agent_id` and parent `session_id`, so Hermes emits `called`; `SubagentStop` does not expose success/failure/cancellation, so Hermes emits outcome-unknown `stopped`. Invalid order, conflicting sequence, terminal continuation, and invalid nesting are excluded from the invocation projection and surfaced in the attention queue.

`unknown`, `partial`, `stale`, `unavailable`, and `0` are different states. Missing telemetry is never displayed as zero. Browser SSE connectivity and event-producer freshness are independent.

## Commands

```powershell
npm run dashboard
npm run dashboard:snapshot
npm run dashboard:event -- --agent ultron --state active --type heartbeat --task dashboard-v4 --event-message "working"
npm run dashboard:event -- --agent ultron --state active --type prompt --task dashboard-v4 --prompt "Show the agent invocation tree"
npm run dashboard:event -- --agent ultron --state active --type prompt --task dashboard-v4 --invocation-id inv-1 --invocation-provider runtime --prompt "Show the selected invocation safely"
npm run dashboard:event -- --agent ultron --state active --type invocation --task dashboard-v4 --invocation-id inv-1 --parent-agent ultron --child-agent reviewer --stage created --direction call --sequence 1 --provider runtime --provider-ref cli:subagent
npm run dashboard:event -- --agent ultron --state active --type invocation --task dashboard-v4 --invocation-id inv-1 --parent-agent ultron --child-agent reviewer --stage called --direction call --sequence 2 --provider runtime --provider-ref cli:subagent
npm run dashboard:event -- --agent reviewer --state active --type invocation --task dashboard-v4 --invocation-id inv-1 --parent-agent ultron --child-agent reviewer --stage responded --direction return --sequence 3 --provider runtime --provider-ref cli:subagent
npm run dashboard:event -- --agent ultron --state active --type metric --task dashboard-v4 --invocation-id inv-1 --invocation-provider runtime --input-tokens 120 --output-tokens 80 --total-tokens 200 --usage-id runtime:inv-1:1 --usage-source runtime --usage-scope exclusive --metric-mode delta
npm run dashboard:event -- --agent worker --state active --type heartbeat --task dashboard-v4 --organization-id fps-metaverse --entity-id worker --parent-entity-id director --team agent-squad --role reviewer --activity active --paperclip-ref paperclip:worker
npm run test:dashboard
npm run test:dashboard:ui
```

The UI test starts an isolated loopback server and temporary journal. It verifies project metrics, roadmap, Kanban interaction, nested invocation direction, live SSE call/return updates, Paperclip provenance, keyboard selection, reduced motion, and desktop/tablet/mobile overflow.

## API and snapshot contract v4.0

- `GET /api/health`
- `GET /api/observability/snapshot`
- `GET /api/observability/events` — SSE snapshot every 2 seconds
- `POST /api/observability/events` — validated loopback-only event ingestion

The snapshot includes `project`, `roadmap`, `kanban`, `agents`, `topology`, `communications`, `invocationActivities`, `metrics`, `collectors`, integration readiness, and source/error evidence.

The standalone server prewarms the first snapshot. Static workspace/project/harness collector results are reused for 30 seconds, while journal-backed agent, invocation, prompt, and token projections are recalculated for every SSE snapshot.

Token events are immutable exclusive deltas. Each `usageId` is counted once; identical replay is ignored and conflicting replay is excluded. Invocation-linked prompt and token rows require `invocationProvider` and are indexed by `<provider>:<invocationId>`, preventing runtime/Paperclip/LangSmith ID collisions. A provider-supplied input/output/total value is `exact`; a total calculated from exact input plus output is `derived`; incomplete coverage is `partial`; no evidence is `unknown`. `usageSource` is `runtime`, `langgraph`, `langsmith`, or `paperclip`.

The local append-only journal is `dashboard/runtime/agent-events.jsonl` and is gitignored. It never stores a full/raw prompt, tool payload, credential, or full subagent response. Prompt capture uses the same redaction module as Hermes, redacts environment-variable credential names, space-separated credential labels, quoted values, Basic/Bearer authorization, credential URLs, private keys, and known provider tokens before truncation, then stores only a maximum 160-code-point preview plus length/status metadata. High-risk content is replaced with `[sensitive content omitted]`.

## Paperclip

Paperclip is an adapter contract, not a bundled remote client. An owning adapter can emit provider-referenced invocation, organization, heartbeat, task, and token rows. Only observed entity, parent, organization, team, role, activity, and reference values create Paperclip nodes. `PAPERCLIP_URL` without observed rows displays `configured · no observed values`; it does not synthesize an organization. Runtime and Paperclip IDs are provider-qualified when they collide.

See `docs/development/dashboard-v4-architecture.md` for the event state machine, tree layout, privacy rules, and rejected alternatives.
