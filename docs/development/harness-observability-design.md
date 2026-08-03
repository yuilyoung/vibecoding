# Harness Observability Design

## Goal

Provide a local-only control plane for every discoverable project under `work/`; it records the approved `design -> isolated worktree -> development -> verification -> completion` lifecycle and presents sanitized, live project and run state.

## Boundaries

- `apps/harness-dashboard/` contains only browser assets.
- `apps/harness-dashboard/` is the sole live operations UI, served at `http://127.0.0.1:4318/`.
- `dashboard/index.html` and `work/2D-FPS-game/dashboard/index.html` are compatibility guidance only, never status sources.
- `services/harness-observability/` owns the loopback HTTP/SSE endpoint.
- `packages/harness-observability-contract/` owns versioned event validation and redaction.
- `tools/harness-pipeline/` owns run state, path claims, and Git worktree creation.
- `var/harness-observability/runs/` is the logical per-run store; its runtime location is ignored under `.local/harness-observability/runs/`.
- `work/*` projects are discovered read-only; their project code remains outside this control-plane slice.

## Data Policy

Events may contain only run identity, lifecycle stage, worktree/branch identity, claimed paths, command identity, exit result, duration, Git summary, source paths, and evidence references. Prompts, tool arguments, environment values, credentials, and raw command output are rejected.
Project cards use directory, supported manifest, path-scoped Git metadata, and conventional status artifacts only; discovery never runs a project command or infers product phase.

## Concurrency Policy

The pipeline accepts only a design-approved run. A run claims normalized repository-relative paths before its worktree is created; claims must be harness-owned or below a discovered `work/<project>/` root. Active claims may not overlap; distinct worktrees may proceed in parallel only with disjoint claims.

## Operator Flow

1. `npm run harness:design -- --run <id> --title <title> --claim <path>`
2. `npm run harness:worktree -- --run <id>`
3. `npm run harness:develop -- --run <id>`
4. `npm run harness:verify -- --run <id> --check harness-tests`
5. `npm run harness:verify -- --run <id> --check harness-audit`
6. `npm run harness:complete -- --run <id>`

Run `npm run harness:dashboard` to serve the one canonical dashboard at `http://127.0.0.1:4318/`. The service never opens a public listener.
