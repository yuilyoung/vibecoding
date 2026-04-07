# Prototype Tracking Policy

## Scope

This policy applies to the active Phaser workspace at `work/2D-FPS-game`.

## Track In Prototype Commits

Keep these files and folders under version control when they belong to prototype work:

- `work/2D-FPS-game/src/`
- `work/2D-FPS-game/tests/`
- `work/2D-FPS-game/assets/data/`
- `work/2D-FPS-game/package.json`
- `work/2D-FPS-game/package-lock.json`
- `work/2D-FPS-game/index.html`
- `work/2D-FPS-game/tsconfig.json`
- `work/2D-FPS-game/vite.config.ts`
- `work/2D-FPS-game/eslint.config.mjs`
- `work/2D-FPS-game/.github/workflows/`
- `work/2D-FPS-game/docs/`
- root documentation that explains the shared workspace contract, status, or handoff process

## Ignore Or Exclude

Do not commit generated or runtime-only artifacts from the prototype workspace:

- `work/2D-FPS-game/node_modules/`
- `work/2D-FPS-game/dist/`
- `work/2D-FPS-game/.vite-dev.stdout.log`
- `work/2D-FPS-game/.vite-dev.stderr.log`
- `work/2D-FPS-game/*.log`
- `work/2D-FPS-game/.dev-cycle/`
- temporary caches and editor files already covered by `.gitignore`

## Claude And Agent Local Files

The following local agent files are workspace tools, not prototype deliverables:

- `.claude/`
- `.agents/`
- `.mcp.json`
- `.serena/`

Leave them out of prototype commits unless there is an explicit instruction to update the agent environment itself.

## Cleanup Rule

If a build or preview run creates new artifacts, prefer one of these outcomes:

1. Add them to `.gitignore` if they are permanent runtime outputs.
2. Delete them if they are disposable and not needed for review.
3. Commit them only when they are deliberate source assets or required fixtures.

## Practical Check

Before committing prototype work:

- Verify `git status` does not show `node_modules`, `dist`, or log files as staged changes.
- Confirm the diff contains source, tests, docs, or configuration that are part of the prototype itself.
- Keep agent-local config files outside the commit unless the task explicitly targets the agent environment.
