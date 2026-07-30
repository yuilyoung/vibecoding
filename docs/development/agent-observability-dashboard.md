# Agent observability dashboard

The local control plane merges Codex agent lifecycle events, repository/openai-hud status, and the active 2D FPS project status in one live SSE screen.

## Operator commands

```powershell
npm run agent-observability:start   # idempotent single-instance start
npm run agent-observability:status
npm run agent-observability:stop
npm run agent-observability:sample
npm run agent-observability
```

`npm run codex-preflight` starts the dashboard service automatically. The service records its PID/port in the ignored `.local/agent-observability/server.json`; repeated preflight calls reuse a live PID rather than starting another server. It binds only to `127.0.0.1:4318` (override `AGENT_OBSERVABILITY_PORT`).

## Live data paths

- `GET /api/stream`: browser SSE snapshot stream (500 ms polling of the local event store).
- `GET /api/events`: JSON read model for diagnostics/integration.
- HUD integration: the server runs the existing `plugins/openai-hud/scripts/collect-workspace-status.mjs` and `collect-status.mjs`, caches their JSON for two seconds, and places it in every snapshot.
- Codex: `codex app-server | npm run agent-observability:collector` normalizes JSON-RPC records into local JSONL. It never exposes app-server credentials to the browser.
- LangChain/LangGraph/LangSmith: feed their newline-delimited lifecycle records into `scripts/agent-observability-adapter.mjs --source <name>`.

## Privacy and optional LangSmith

No dependency, remote API, or key is necessary for local mode. `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` are consumed only by an external LangSmith-producing process; this project merely displays optional trace metadata already present in a local event. Redact prompts, tool arguments, and secrets before collector input. Keep `.local/` out of Git.
