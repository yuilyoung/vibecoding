# AI Project Control Plane

`npm run dashboard` starts the whole-repository local dashboard at `127.0.0.1:4173`. It is an operations view, not a static game-status mockup.

## What the UI shows

1. Active project phase, verification, and progress from `work/2D-FPS-game/docs/reports/project-status.md`.
2. A Kanban board built only from report next tasks, report-complete phases, and received lifecycle events.
3. Directed agent topology: each source-backed `handoff`, `message`, or `delegation` is one arrow. A bright moving signal means communication within 15 seconds and fresh 30-second heartbeats from both endpoints; historical arrows remain visible but subdued.
4. A selected agent/arrow inspector with the safe summary, task, timestamp, correlation ID, source event ID, and relevant source-backed token deltas.
5. Input, output, and total token consumption from immutable exclusive usage deltas. No usage source means `unknown`, never `0`.
6. Existing workspace/project/harness collector health and integration readiness. The optional harness collector is shown as `unavailable` when it is not installed; that is not a failed health check.

A configured agent is not treated as running. `active` requires a fresh event, `stale` means a heartbeat is older than 120 seconds, and `unknown` means no event exists. Progress is displayed as a percentage only when the report explicitly exposes a done/total range; otherwise it is `unknown`.

## Commands

```powershell
npm run dashboard
npm run dashboard:snapshot
npm run dashboard:event -- --agent ultron --state active --type heartbeat --task dashboard-v2 --event-message "working"
npm run dashboard:event -- --agent ultron --state active --type delegation --task dashboard-v2 --to product-owner --kind delegation --summary "Request delivery plan" --correlation dashboard-v2
npm run dashboard:event -- --agent ultron --state active --type metric --task dashboard-v2 --input-tokens 120 --output-tokens 80 --total-tokens 200 --usage-id runtime:dashboard-v2:1 --usage-source runtime --usage-scope exclusive --metric-mode delta
npm run test:dashboard
npm run test:dashboard:ui
```

The UI test starts its own loopback server with a temporary journal and seeded directed communication. It does not require `npm run dashboard` to already be running.

## API and event contract v2.1

- `GET /api/health`
- `GET /api/observability/snapshot`
- `GET /api/observability/events` — SSE snapshot every 2 seconds
- `POST /api/observability/events` — validated, loopback-only event ingestion

```json
{
  "agentId": "ultron",
  "timestamp": "2026-08-04T12:00:00.000Z",
  "state": "active",
  "eventType": "metric",
  "taskId": "dashboard-v2",
  "metrics": {
    "tokens.input": 120,
    "tokens.output": 80,
    "tokens.total": 200
  },
  "usageId": "runtime:dashboard-v2:1",
  "usageSource": "runtime",
  "usageScope": "exclusive",
  "metricMode": "delta"
}
```

Token usage entries are immutable execution deltas. The dashboard counts each `usageId` only once, excludes a conflicting replay, and accepts only `usageScope: "exclusive"` plus `metricMode: "delta"` to avoid parent/child-span double counting. `usageSource` is one of `runtime`, `langgraph`, `langsmith`, or `paperclip`. A provider that supplies only total tokens can omit input/output; input/output-only entries show total as `derived`.

The event journal is `dashboard/runtime/agent-events.jsonl` and is gitignored. Producers must send a safe summary, not a prompt or tool payload. The contract rejects common credential-like values (API keys, bearer tokens, passwords, URLs with embedded credentials), but it is not a general-purpose secret scanner; do not send secrets to the local journal.

## Optional integrations

LangGraph (`updates`, `tasks`, `custom`), LangSmith (trace/run), OpenViking (context/retrieval), and Paperclip (heartbeat/task/metric) remain contract-ready only. The dashboard neither installs them nor sends remote requests; a future source-owning adapter can emit the same non-secret communication and exclusive usage-delta contracts into the local journal.