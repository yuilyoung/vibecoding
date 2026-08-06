# Architecture Checklist

## Component View

Use this dependency shape unless repository constraints require a documented variant:

```mermaid
flowchart LR
  View --> ViewModel
  ViewModel --> UseCase
  UseCase --> RepositoryPort
  DataAdapter -.implements.-> RepositoryPort
  DataAdapter --> DAO
  DAO --> ConnectionManager
  DTO --> DataAdapter
  Domain --> UseCase
```

Check:

- Presentation owns display state and user intent, not domain policy.
- Business owns protocols, validation, use cases, and domain state.
- Data owns storage/transport details and DTO-to-domain mapping.
- Concrete infrastructure is assembled only at the composition root.

## Class View

```mermaid
classDiagram
  class IFeatureService {
    <<interface>>
    +execute(Request, Cancellation) Result
  }
  class FeatureFacade
  class IRepository {
    <<interface>>
    +load(Id) Entity
    +save(Entity) void
  }
  class SqlRepository
  class ConnectionPoolManager
  FeatureFacade --> IFeatureService
  SqlRepository ..|> IRepository
  SqlRepository --> ConnectionPoolManager
```

Show cardinality, ownership, interface realization, and inheritance. Do not add a base class solely to reduce a few duplicated lines.

## Sequence View

```mermaid
sequenceDiagram
  actor User
  participant View
  participant VM as ViewModel
  participant Worker
  participant Domain
  participant Data
  User->>View: command
  View->>VM: intent
  VM->>Worker: async request + cancellation
  Worker->>Domain: execute use case
  Domain->>Data: repository interface
  Data-->>Domain: result/error
  Domain-->>Worker: outcome
  Worker-->>VM: marshal to UI thread
  VM-->>View: immutable state
```

Assign timeout, cancellation, retry, and error translation at each async boundary.

## Schema-First Questions

- What are the tables/collections, primary keys, foreign keys, and uniqueness rules?
- Which invariants belong in the database versus the domain?
- Which queries need indexes, pagination, ordering, or optimistic concurrency?
- What is the migration and rollback path?
- Which operations require a transaction and what isolation level is justified?
- Are DTO fields nullable, versioned, encrypted, or sensitive?
- How are connection exhaustion, timeouts, and transient errors surfaced?

## Decision Record

For each material choice record:

- Context and constraint.
- Chosen option.
- Alternatives rejected.
- Consequences and operational risks.
- Verification evidence.

## Final Gate

- No circular dependency between layers.
- No framework or database type leaks into the domain API.
- Interface contracts cover error and concurrency behavior.
- Schema supports the required access patterns.
- Composition root and disposal order are explicit.
- Diagrams match the planned modules and names.
