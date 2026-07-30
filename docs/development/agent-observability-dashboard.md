# Agent observability dashboard

A runnable, local-first control plane for Codex subagent execution. It collects append-only normalized events, serves an SSE stream to a graph/matrix UI, and remains useful without LangSmith credentials or network access.

## Start locally

```powershell
npm run agent-observability:sample
npm run agent-observability -- --port 4318
```

The dashboard binds only to `127.0.0.1` and exposes `GET /api/events` plus `GET /api/stream` (Server-Sent Events). The browser uses SSE, so it receives agent, graph, and token updates without a page refresh or a WebSocket dependency.

## Codex app-server collector

The collector is a real process boundary, not browser code:

```powershell
codex app-server | npm run agent-observability:collector
```

For replay/debugging, pipe newline-delimited JSON-RPC notifications into the same command. It normalizes `method`/`params` envelopes into versioned JSONL at `.local/agent-observability/events.jsonl` (override with `AGENT_OBSERVABILITY_EVENT_FILE`). Thread IDs become `runId`; agent/task/turn identity becomes `agentId`; lifecycle method names map to queued/working/completed/failed/blocked. Unknown methods are retained as `tool.lifecycle` rather than crashing ingestion.

The operator owns the app-server process and credentials. This project neither launches, proxies, nor exposes it to the browser.

## Event model and token matrix

Required raw fields: `version`, immutable `id`, ISO `at`, `source`, `type`, and `runId`. `agent.status` further requires `agentId`, valid `status`, optional `parentAgentId`, `label`, `tokens.input`, and `tokens.output`.

`parentAgentId` produces a directed UI edge. The server aggregates a matrix keyed by `runId × agentId` with input/output/total token columns. Models, tools, turns, and cost rates are intentionally additive dimensions; cost is not guessed without a versioned pricing catalog.

## Optional LangChain, LangGraph, LangSmith adapter

```powershell
# Feed each adapter newline-delimited lifecycle records.
Get-Content .\langgraph-events.jsonl | node scripts\agent-observability-adapter.mjs --source langgraph
Get-Content .\langchain-events.jsonl | node scripts\agent-observability-adapter.mjs --source langchain
Get-Content .\langsmith-events.jsonl | node scripts\agent-observability-adapter.mjs --source langsmith
```

The adapter accepts node/name/run fields, parent IDs, status, usage/token fields, and optional trace ID/URL. LangGraph nodes map directly to graph nodes; for fan-in, a future `graph.edge` schema will preserve multiple parents instead of falsifying one `parentAgentId`.

Set `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` only in a separate LangSmith-producing process. This harness never reads or sends that key. Without it, the same adapter writes local events marked `local-only`; with it, trace metadata can be attached and rendered as a link.

## Security and operations

The JSONL file is local runtime data and must remain untracked. Redact prompts, tool arguments, secrets, and user content before collector input. Rotate the file by size/date before production, set retention, and add authentication/authorization before any non-local deployment. SSE is deliberately used here for one-way local status delivery; a future authenticated control channel can add WebSocket commands separately.
