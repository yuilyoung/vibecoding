---
name: architecture-first-design
description: Design software architecture before implementation using UML, explicit three-layer boundaries, interface-first contracts, and schema-first persistence. Use for new systems, non-trivial features, database-backed work, major refactors, protocol/API design, dependency-boundary changes, or when a user asks for architecture, UML, class structure, interfaces, schemas, MVVM, DI, threading, or component responsibilities.
---

# Architecture-First Design

Turn requirements into a reviewable architecture contract before creating concrete classes. Keep the design proportional: document decisions that constrain implementation and omit speculative layers with no current consumer.

## Workflow

1. Inspect the repository contracts, runtime entry points, existing abstractions, schemas, tests, and ownership conventions.
2. State functional requirements, quality attributes, failure modes, concurrency needs, data volume, and deployment constraints.
3. Define the three layers and allowed dependency direction:
   - Presentation: UI, View, ViewModel, presentation adapters.
   - Business: protocols, use cases, domain models, policies, service interfaces.
   - Data: repository implementations, DAO, DTO, mappers, database and remote adapters.
4. Place interfaces at boundary crossings before concrete implementations. Specify inputs, outputs, errors, cancellation, ownership, thread affinity, and compatibility.
5. For persistent data, define the schema, keys, constraints, indexes, migrations, transaction boundaries, and rollback strategy before DAO code.
6. Draw only useful UML views:
   - Component diagram for boundaries and dependency direction.
   - Class diagram for ownership, inheritance, interfaces, and cardinality.
   - Sequence diagram for async, UI/worker, database, retry, or lifecycle behavior.
   - State diagram when domain transitions or resource lifetimes are non-trivial.
7. Define the composition root and lifetime model: creator, owner, scope, disposal order, shared resources, and forbidden dependency cycles.
8. Record rejected alternatives and tradeoffs.
9. Produce an implementation handoff with ordered slices and verification gates.

## Boundary Rules

- Point dependencies inward: Presentation -> Business interfaces; Data -> Business interfaces.
- Never let Presentation call a concrete DAO or database connection directly.
- Keep DTOs at transport/persistence boundaries; map them to domain models.
- Keep domain rules independent of UI frameworks, database drivers, and thread primitives.
- Use an abstract base only for a stable substitutable contract. Prefer composition when implementations merely share helpers.
- Expose a Facade for a cohesive application capability when callers would otherwise coordinate multiple managers.
- Reserve Singleton for a proven process-wide lifetime; make it replaceable in tests through an interface or composition root.

## Interface-First Contract

For each interface, specify:

- Responsibility and non-responsibilities.
- Method contract, invariants, error model, and idempotency.
- Sync/async behavior, cancellation, timeout, and retry ownership.
- Thread safety and caller/callee thread affinity.
- Resource ownership and lifetime.
- Versioning and compatibility expectations.
- Test doubles and contract-test strategy.

## Required Output

Return or create, as appropriate:

1. Assumptions and constraints.
2. Layer/component map with allowed dependencies.
3. Interface and schema contracts.
4. UML diagrams in Mermaid or the repository's established format.
5. Lifetime, DI, threading, and data-flow decisions.
6. Risks and rejected alternatives.
7. Ordered implementation slices with acceptance tests.

Read [references/architecture-checklist.md](references/architecture-checklist.md) for diagram templates, schema questions, and the final design gate.

## Reference Index

| Need | Read |
| --- | --- |
| Component/class/sequence UML templates | `references/architecture-checklist.md#component-view`, `#class-view`, `#sequence-view` |
| Database schema-first review | `references/architecture-checklist.md#schema-first-questions` |
| Architecture decisions and completion review | `references/architecture-checklist.md#decision-record`, `#final-gate` |

## Design Gate

Do not hand off implementation until:

- Every dependency crossing has a named interface.
- Database-backed flows have a schema and transaction decision.
- Ownership and shutdown order are explicit.
- UI-thread and worker-thread responsibilities are explicit when asynchronous work exists.
- Error, cancellation, retry, and backpressure behavior are assigned.
- Diagrams agree with the proposed file/module structure.
- The design can be tested without constructing production infrastructure.
