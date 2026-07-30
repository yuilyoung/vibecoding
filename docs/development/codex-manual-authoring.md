# Codex Demand-Loaded Manual Authoring

Use this policy when creating or changing a manual that Codex loads through `codex/manuals/catalog.json`.

## Required shape

Every manual must have exactly this short, retrieval-friendly structure:

```markdown
# Verb-led one-line name

> One-sentence description of the result and scope.

## Order

1. Ordered decision or execution steps.

## Method

- Source priority, inputs, and expected evidence.

## Cautions

- Scope limits, unsafe fallbacks, and non-claims.
```

## Generation rules

1. Name the manual with a concise verb-led line; do not use a department or persona name.
2. Write one sentence that states its outcome and boundary.
3. Put only stable procedural order in `Order`; route volatile domain facts to source documents.
4. State source priority, inputs, and evidence in `Method`.
5. State failure modes, permission limits, and claims the agent must not make in `Cautions`.
6. Add a catalog entry with triggers and the narrowest source paths that should force a manual review.
7. Keep one manual focused on one outcome. Split unrelated procedures instead of growing a catch-all document.

## Maintenance rules

- Keep manuals next to the codebase they govern and update them in the same change when a configured source path changes.
- Use the manual drift checker before completion when a relevant source changed.
- Turn a reviewed, recurring lesson into a manual or skill; do not keep behavioral instructions only in `codex/state/lessons.md`.
