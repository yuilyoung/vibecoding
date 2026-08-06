# Implementation Checklist

## Pattern Selection

| Need | Prefer | Avoid |
| --- | --- | --- |
| Replaceable boundary | Interface + adapter | Concrete cross-layer dependency |
| Cohesive entry point | Facade | Caller coordinating many managers |
| Object graph assembly | DI Factory/composition root | Service locator |
| Shared algorithm + invariant | Abstract base/template method | Inheritance for incidental reuse |
| Optional behavior | Composition/strategy | Deep inheritance tree |
| External acquisition | Collector + mapper | Parsing in ViewModel |
| Process-wide scarce resource | Managed singleton behind interface | Global mutable state |

## MVVM Flow

```text
View event
  -> ViewModel command
  -> Controller/Facade
  -> Business use case
  -> Repository interface
  -> DAO + ConnectionPoolManager
  -> domain result
  -> immutable ViewModel state on UI thread
  -> View render
```

Verify that the ViewModel never imports a concrete DAO and the View never blocks on worker completion.

## Sync/Async Decision

Use synchronous execution only when the work is bounded, local, and safely below the UI or request latency budget. Otherwise define:

- Executor/worker owner.
- Queue capacity and overflow policy.
- Cancellation token and deadline.
- Retry owner, maximum attempts, and idempotency.
- Result/error marshaling.
- Shutdown and join order.

## Pool Manager Contract

```cpp
class IConnectionLease {
public:
    virtual ~IConnectionLease() = default;
    virtual IDbConnection& connection() = 0;
};

class IConnectionPool {
public:
    virtual ~IConnectionPool() = default;
    virtual std::unique_ptr<IConnectionLease> acquire(
        std::chrono::milliseconds timeout) = 0;
    virtual void shutdown() noexcept = 0;
};
```

The concrete lease must return or invalidate its connection in its destructor.

## DI Ownership Example

```cpp
struct ApplicationServices {
    std::shared_ptr<IConnectionPool> pool;
    std::unique_ptr<IRepository> repository;
    std::unique_ptr<IFeatureService> service;
    std::unique_ptr<FeatureFacade> facade;
};

ApplicationServices makeApplicationServices(const AppConfig& config);
```

Use `shared_ptr` for the pool only if workers genuinely outlive a single repository call and share the pool. Otherwise prefer `unique_ptr` and non-owning references.

## Concurrency Review

- Shared invariants are named.
- Every shared field has one synchronization strategy.
- Lock ordering is documented.
- No blocking I/O occurs under a lock.
- Callbacks execute outside locks.
- Worker queues are bounded.
- Cancellation and shutdown wake blocked waiters.
- UI observable state changes only on the UI thread.

## Test Matrix

- Pure domain and protocol unit tests.
- Interface contract tests across each adapter.
- DTO/domain mapping and schema migration tests.
- Transaction rollback and idempotency tests.
- Pool saturation, acquisition timeout, reconnect, and shutdown tests.
- ViewModel state/command tests without a real View or database.
- Worker cancellation, retry, queue pressure, and exception tests.
- Structured verification event order, correlation, redaction, and status callback tests.
- Native C++ leak, use-after-free, race, and deadlock checks with available sanitizers/tools.

## Completion Evidence

Report:

- Files and boundaries changed.
- Interfaces and schema versions added.
- DI lifetimes and shutdown order.
- Sync/async and data-structure choices with reasons.
- Verification log schema, callback sinks, and representative state-transition evidence.
- Commands run and exact results.
- Known risks or intentionally deferred work.
