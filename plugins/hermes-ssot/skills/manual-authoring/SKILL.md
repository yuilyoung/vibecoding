---
name: manual-authoring
description: Create or update concise demand-loaded Codex manuals and catalog entries for recurring project knowledge or procedures. Use when a reviewed lesson, new domain, changed workflow, or stale reference needs a reusable manual.
---

# Manual Authoring

1. Read `docs/development/codex-manual-authoring.md`.
2. Identify the single outcome, source owner, triggers, and narrowest watch paths.
3. Create or update one manual under `codex/manuals/` using the required name, description, order, method, and cautions structure.
4. Add or update its entry in `codex/manuals/catalog.json`.
5. Run `node plugins/hermes-ssot/scripts/harness-audit.mjs`.
6. Run `node plugins/hermes-ssot/scripts/manual-drift-check.mjs` when a watched source changed.

Do not copy volatile source facts into the manual. Link the procedure to its current source and keep the manual narrowly scoped.
