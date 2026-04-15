---
name: project-hud
description: Read the current workspace context and summarize harness readiness, project status, and next actions from the local docs and worktree.
---

# Project HUD

## Use this skill when

- The user asks for current context, status, readiness, progress, or next steps.
- The user wants a quick HUD-style summary instead of a long walkthrough.

## Read in this order

1. `docs/development/agent-workspace-harness-checklist.md`
2. `AGENTS.md`
3. `docs/development/active-workspace-baseline.md`
4. `work/2D-FPS-game/docs/development/harness-checklist.md`
5. `work/2D-FPS-game/docs/reports/project-status.md`
6. `work/2D-FPS-game/dashboard/index.html`
7. `git status --short`

## Output format

- `ctx`: active workspace and project target
- `status`: current workspace readiness and current runtime baseline
- `done`: already completed setup items
- `next`: highest-priority next actions
- `risk`: any mismatch or blocker worth surfacing

## Rules

- Prefer short, scan-friendly summaries.
- Use exact file references when citing status.
- Distinguish between harness completion and gameplay completion.
- Distinguish between agent-workspace harness and project harness.
