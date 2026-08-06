# AI Project Control Plane v3

`npm run dashboard` starts the repository-local operations dashboard at `127.0.0.1:4173`. The UI combines the active 2D-FPS project board with source-backed agent observability; it is not a static status mockup.

## First-viewport contract

The desktop first viewport must expose both sides of the control plane:

1. Eight visible metrics: project progress, unit tests, E2E, LOC budget, work queue, live agents, live links, and tokens.
2. Current phase, summary, completed milestone timeline, status, verification, and blocking signals.
3. A five-column `Decision / Active / Review / Blocked / Done` Kanban board.
4. An SVG agent topology with actual nodes and directed communication edges, not status badges.

The project side is derived from `work/2D-FPS-game/docs/reports/project-status.md`, its active `docs/planning/phaseN-tasks.json`, and `docs/handoffs/current-execution-report.md`. Durable completed WBS tasks cannot be demoted by stale runtime events. Selecting a card opens its dependencies, acceptance criteria, owner, files, and source evidence and cross-highlights related agent activity.

The agent side distinguishes configured agents from observed agents. A node is `active` only with a fresh event. A live animated edge requires a communication event within 15 seconds and fresh 30-second heartbeats for both endpoints. Historical edges remain visible without live animation. The inspector and latest-first communication stream expose safe summaries, event IDs, correlation IDs, task IDs, timestamps, and source references.

Trusted Hermes lifecycle hooks automatically publish safe heartbeat, delegation, reviewer-message, and lifecycle events for `ultron`, `product_owner`, and `reviewer`. The snapshot also runs the Hermes plugin audit as a required collector, so hook-contract drift appears in the attention queue.

`unknown`, `stale`, `unavailable`, and `0` are different states. Missing telemetry is never displayed as zero. Producer freshness is independent of browser SSE connectivity.

## Commands

```powershell
npm run dashboard
npm run dashboard:snapshot
npm run dashboard:event -- --agent ultron --state active --type heartbeat --task dashboard-v3 --event-message "working"
npm run dashboard:event -- --agent ultron --state active --type delegation --task dashboard-v3 --to reviewer --kind delegation --summary "Request independent review" --correlation dashboard-v3
npm run dashboard:event -- --agent ultron --state active --type metric --task dashboard-v3 --input-tokens 120 --output-tokens 80 --total-tokens 200 --usage-id runtime:dashboard-v3:1 --usage-source runtime --usage-scope exclusive --metric-mode delta
npm run test:dashboard
npm run test:dashboard:ui
```

The UI test starts an isolated loopback server and temporary journal. It verifies visible metrics, Kanban interaction, topology nodes and edges, communication correlation, SSE updates, first-viewport placement, and desktop/mobile overflow without requiring an existing dashboard server.

## API and snapshot contract v3.0

- `GET /api/health`
- `GET /api/observability/snapshot`
- `GET /api/observability/events` - SSE snapshot every 2 seconds
- `POST /api/observability/events` - validated loopback-only event ingestion

The snapshot includes `project`, `kanban`, `agents`, `topology`, `communications`, visible `metrics`, `collectors`, optional integration readiness, and source/error evidence. Quality metrics include the full unit suite, Playwright result, emitted build chunk, and MainScene LOC budget parsed from the current execution report.

Token events are immutable exclusive deltas. Each `usageId` is counted once; identical replay is ignored and conflicting replay is excluded and surfaced in the attention queue. Only `usageScope: "exclusive"` plus `metricMode: "delta"` is accepted. `usageSource` is `runtime`, `langgraph`, `langsmith`, or `paperclip`.

The append-only event journal is `dashboard/runtime/agent-events.jsonl` and is gitignored. Send only safe summaries, never prompts, raw tool payloads, credentials, or secrets.

## Optional providers

LangGraph, LangSmith, OpenViking, and Paperclip are contract-ready only. The dashboard does not install them or make remote calls. A future source-owning adapter can emit the same non-secret communication and exclusive usage-delta contracts into the local journal.
