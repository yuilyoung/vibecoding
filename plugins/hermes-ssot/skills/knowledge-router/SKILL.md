---
name: knowledge-router
description: Route a Codex task to only the relevant repo manuals before planning or implementing. Use for non-trivial implementation, review, verification, handoff, harness, or game-workspace tasks that need domain context without loading every document.
---

# Knowledge Router

1. Read `codex/manuals/catalog.json`.
2. Match the request against the catalog triggers and select the smallest useful set, normally no more than three manuals.
3. Read the selected manual files in their listed order.
4. Read each manual's source file only when its method directs it or the request requires current facts.
5. State the selected manual IDs and any unresolved routing ambiguity before taking a consequential action.

Do not load every manual by default. Treat catalog metadata as routing context, not source-of-truth domain facts.
