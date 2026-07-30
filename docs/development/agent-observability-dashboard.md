# Agent observability dashboard foundation

This local-first harness runs without API keys, dependency installation, or remote telemetry.

## Run

```powershell
npm run agent-observability:sample
npm run agent-observability
```

Open `http://127.0.0.1:4318`. Validate stored events without a server using `npm run agent-observability:check`. The untracked local source is `.local/agent-observability/events.jsonl`; `GET /api/events` is the read model and the UI polls every two seconds.

## Canonical local event schema

Each JSONL record has `version`, `id`, `at` (ISO-8601), `source`, `type`, and `runId`. Agent lifecycle events additionally have `agentId`, `status` (`queued`, `working`, `completed`, `failed`, or `blocked`), optional `parentAgentId`, `label`, `tokens.input`, and `tokens.output`.

`parentAgentId` forms a graph edge. `runId` isolates runs. Event IDs are immutable and must be deduplicated by future collectors.

## Codex app-server integration

The collector boundary is separate from the UI. A Codex app-server adapter translates streamed turn/item/tool lifecycle notifications into these events, maps a Codex thread to `runId`, maps agent/thread identity to `agentId`, and appends normalized JSONL. Unknown notifications are stored as `source: "codex-app-server"`, `type: "raw.unknown"`; they must not break stream ingestion.

This harness never launches or proxies `codex app-server`, keeping credentials and process ownership with the operator. A future adapter only needs to write the defined JSONL schema.

## Token matrix

The matrix dimensions are `runId × agentId × token direction` (input/output). The read model returns per-run totals and latest agent status. Model, tool, turn, and cost-rate dimensions can be added without altering raw events. Cost waits for a versioned model-price table.

## LangGraph and LangSmith boundaries

LangGraph emits `agent.status` events for graph node transitions, using node IDs as `agentId` and a single upstream node as `parentAgentId`. Fan-in must use a future `graph.edge` event rather than invent a parent. LangSmith adds optional `traceUrl`, `traceId`, and `spanId` metadata only after local write. Its API key belongs only in the adapter process (`LANGSMITH_API_KEY`), never browser code or fixtures. Without it, local tracing works normally.

## Security and retention

Bind only to `127.0.0.1`. Redact prompts, tool arguments, secrets, and user content before emission. Rotate JSONL by size/date before production, apply retention, and add auth before any multi-user deployment.
