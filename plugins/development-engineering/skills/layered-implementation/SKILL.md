---
name: layered-implementation
description: Implement maintainable software through Presentation, Business, and Data layers with interface-first contracts, DI factories, explicit object lifetimes, MVVM UI separation, concurrency-safe workers, database pool management, focused managers and collectors, and native C++ smart-pointer ownership. Use for feature implementation, refactors, class and protocol design, database access, background work, UI architecture, dependency injection, concurrency, or Raw/native C++ systems.
---

# Layered Implementation

Implement a verified vertical slice while preserving explicit boundaries, ownership, concurrency, and source-backed behavior. Match existing repository conventions when they already satisfy these constraints.

## Start Gate

Before editing concrete classes:

1. Inspect repository instructions, existing architecture, tests, and runtime wiring.
2. Use the existing architecture contract. If a new boundary, schema, lifecycle, or material interaction must be invented, use `$development-engineering:architecture-first-design` first.
3. List the interfaces, DTO/domain mapping, composition root, ownership tree, and thread boundaries for the slice.
4. Define acceptance tests and failure cases.

## Implementation Order

1. Schema and migrations for database-backed behavior.
2. Domain types, protocols, interfaces, and abstract bases.
3. DTOs, mappers, DAO/repository adapters, and external collectors.
4. Use cases, domain services, managers, and application Facade.
5. DI factory/composition root and lifecycle management.
6. Structured verification logger and status callback observers.
7. ViewModel and data Controller/coordinator.
8. View/presentation wiring.
9. Unit, contract, integration, concurrency, observability, and UI tests.

Keep each step buildable and preserve the dependency direction:

`Presentation -> Business interfaces <- Data implementations`

## Three-Layer Responsibilities

- Presentation: render state, capture intent, expose ViewModel commands, marshal results to the UI thread. Do not execute heavy work or access DAOs.
- Business: own protocols, domain models, use cases, policies, validation, and repository interfaces. Do not depend on UI or database frameworks.
- Data: own DTOs, mapping, DAO/repository implementations, collectors, serialization, and connection access. Do not leak DTOs into Presentation or domain rules.

## Class and Pattern Rules

- Create an interface or abstract contract before each replaceable boundary implementation.
- Create a parent class only when children share a stable invariant and satisfy substitutability. Put genuine common behavior in the parent; prefer composition for optional behavior.
- Use a Facade as the application-level entry point when a use case coordinates multiple managers.
- Give each Manager one operational responsibility and each Collector one acquisition/aggregation responsibility.
- Use Singleton only for a proven process-wide resource. Hide it behind an interface and make teardown/test replacement possible.
- Keep Controllers focused on orchestration and data flow; keep business decisions in domain services/use cases.
- Keep Views passive. ViewModels expose observable state and commands without importing concrete data adapters.

## DI Factory and Lifetime

- Assemble concrete dependencies in one composition root or DI Factory.
- Document lifetime per dependency: transient, request/task, session, or application.
- Acquire resources through RAII and release in reverse dependency order.
- Make shutdown idempotent. Stop producers, cancel work, join workers, drain queues, then release pools and shared services.
- Reject service-locator access from domain code.
- Reject hidden allocation ownership and dependency cycles.

## Database and Connection Management

- Keep `ConnectionPoolManager` separate from DAOs/repositories.
- Configure maximum pool size, acquisition timeout, idle/lifetime policy, health validation, and backpressure.
- Return connections with an RAII lease even on exceptions or cancellation.
- Never hold a connection while waiting for UI input or unrelated external work.
- Assign transaction boundaries to a use case/repository unit, not a ViewModel.
- Test pool exhaustion, timeout, rollback, reconnect, and shutdown behavior.

## Threading and Async

- Confine rendering and observable UI mutation to the UI thread.
- Run I/O, CPU-heavy work, collectors, and blocking database calls on worker threads/executors.
- Marshal immutable results or messages back to the UI thread.
- Choose sync for bounded, local, deterministic work; choose async for I/O, long-running work, parallelizable work, or responsiveness requirements.
- Define cancellation, timeout, retry, backpressure, and exception propagation before launching work.
- Avoid detached threads. Own workers and join them during shutdown.

## Verification Logs and Status Callbacks

- Define typed operation states such as queued, starting, running, waiting, retrying, succeeded, failed, cancelled, and timed-out.
- Emit structured events at state transitions and verification checkpoints, not arbitrary prose-only lines.
- Include timestamp, severity, component, operation/correlation/task IDs, state, progress, attempt, duration, thread/executor, outcome, and safe resource indicators.
- Route status through an `IStatusObserver` or callback interface. Keep the producer independent of console, file, telemetry, and UI sinks.
- Provide no-op, composite/fan-out, structured-log, and UI-marshaling observers as needed.
- Make callbacks thread-safe, non-blocking, exception-contained, and ordered per operation. Never invoke observers while holding domain or pool locks.
- Redact secrets, credentials, personal data, raw queries with sensitive parameters, and unrestricted payloads.
- Distinguish source facts from derived values and never log unknown metrics as zero.
- Test event order, correlation continuity, terminal-state uniqueness, cancellation, callback exceptions, and concurrent producers.

Read [references/observability-contract.md](references/observability-contract.md) whenever the feature has background work, database activity, agents/collectors, progress UI, or an operational verification requirement.

## Data Structures and Synchronization

- Prefer contiguous `vector`/array storage for iteration and cache locality.
- Use `unordered_map` for keyed average O(1) lookup; use ordered `map` when ordering/range queries are required.
- Use `set` only for uniqueness with ordering; prefer a hash set when ordering is irrelevant.
- Use `deque` for efficient work queues; use `list` only when stable iterators and frequent middle splices justify its cost.
- Minimize shared mutable state. Prefer ownership transfer, immutable snapshots, or message queues.
- Choose `mutex`, `shared_mutex`, condition variables, atomics, or platform critical sections based on the invariant. Document lock ownership and ordering.
- Never call slow or user-provided code while holding a lock.

## Native C++ Ownership

- Use `std::unique_ptr` by default for owning heap objects.
- Use `std::shared_ptr` only for genuine shared lifetime; avoid using it as an ownership decision shortcut.
- Use `std::weak_ptr` for non-owning observation of shared objects and to break cycles.
- Use references or raw pointers only as explicit non-owning parameters/views.
- Prefer values and stack allocation when polymorphic or dynamic lifetime is unnecessary.
- Use factory functions returning smart pointers and make transfer semantics obvious.
- Ban owning raw `new`/`delete` in application code unless an external API forces a tightly wrapped exception.

Read [references/implementation-checklist.md](references/implementation-checklist.md) for decision tables and the completion gate.

## Reference Index

| Need | Read |
| --- | --- |
| Pattern, MVVM, sync/async, pool, DI, concurrency, test selection | `references/implementation-checklist.md` and only the matching heading |
| Verification log event schema or C++ callback interface | `references/observability-contract.md#event-model` |
| Log sinks, redaction, UI marshaling, queue policy | `references/observability-contract.md#observer-and-sink-rules`, `#structured-log-fields` |
| State transitions and observability tests | `references/observability-contract.md#state-machine`, `#verification-tests` |

## Completion Gate

Do not claim completion until:

- Layer and interface contract tests pass.
- Concrete infrastructure can be replaced by test doubles.
- UI remains responsive and UI-thread confinement is tested.
- Async paths cover cancellation, timeout, error, and shutdown.
- Verification logs and status callbacks prove state transitions without leaking sensitive data.
- Database paths cover transactions and pool exhaustion.
- Native C++ ownership has no leaks, dangling observers, or shared-pointer cycles.
- Race/deadlock analysis and relevant sanitizers or platform tools pass when available.
- The handoff lists architecture decisions, tests, and remaining risks.
