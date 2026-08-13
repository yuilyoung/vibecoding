---
name: image-studio-sprint-delivery
description: Plan, implement, and verify bounded Animation Real Studio image-generation changes with PDD, FSD, TDD, WBS traceability, roadmap-to-unit slicing, three-layer MVVM boundaries, safe adult-only image controls, batch generation, selection, and evidence gates. Use when Codex changes image-generation UX, prompt protocols, generation orchestration, retouch planning, or automated verification in workspace/animation_real_studio.
---

# Image Studio Sprint Delivery

Deliver one reviewable vertical slice from product intent through deterministic evidence.

## Workflow

1. Run the current readiness, API, build, and relevant browser checks before editing.
2. Read `references/delivery-contract.md` and the current Studio provider ADR.
3. Define requirement IDs in four artifacts:
   - PDD: user problem, safety boundary, outcomes, exclusions.
   - FSD: behavior, protocol, errors, states, acceptance criteria.
   - TDD: Presentation/Business/Data boundaries, interfaces, DI, lifetime, UML, concurrency.
   - WBS: roadmap, sprint, feature, unit, owner, dependency, evidence.
4. Keep one trace row from every accepted requirement to a sprint, implementation unit, and deterministic test.
5. Implement a thin vertical slice in dependency order: domain contract, data adapter, use case, composition root, ViewModel, View.
6. Treat every image variant as an independent operation. Bound batches to three, preserve partial success, and make result selection idempotent.
7. Classify direction intent before starting providers: allow clearly fictional adults age 20+ in consensual, non-graphic sensual styling; block minors, teens, age ambiguity, real people, explicit activity, pornography, coercion, and erotic age-coded fashion. Never label planned retouching as available.
8. Run `node .codex/skills/image-studio-sprint-delivery/scripts/validate-delivery.mjs`, focused tests, full API tests, build, and affected E2E tests after the latest edit.
9. Update progress documentation from evidence, then request independent review.

## Boundary Rules

- Presentation owns form state, commands, polling, and immutable render state.
- Business owns supported values, validation, prompt intent, batch state, and repository interfaces.
- Data owns HTTP, persistence/transport mapping, provider adapters, and in-memory storage.
- Assemble concrete dependencies only in a composition root.
- Do not retain source bytes, temporary paths, unrestricted provider diagnostics, or raw image payloads in batch metadata or audit events.
- Use one isolated provider workspace per variant and clean it independently.

## Retouch Gate

Design AI and manual face/body retouching as a later capability. Require explicit adult consent, bounded masks, reversible edit history, provenance, non-discriminatory defaults, safety revalidation, and export disclosure before implementation.

## Completion Evidence

Report baseline status, requirement trace coverage, files by layer, protocol versions, DI/lifetimes, concurrency and failure behavior, commands/results, runtime URL, and deferred risks.
