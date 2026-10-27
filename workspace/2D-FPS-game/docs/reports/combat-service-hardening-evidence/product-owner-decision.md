# Product-owner decision — combat roster and online readiness

## Goal

Harden reload/fire/hit, selected weather, and generated map music; deliver a
playable 1v3 CPU slice; and define online authority/transport contracts without
claiming a hosted service.

## Scope boundaries

- Preserve the current Phaser baseline and unrelated dirty work.
- Replace player/dummy assumptions only where needed for a roster-backed 1v3
  vertical slice.
- Keep deployed many-versus-many unavailable until server, identity, capacity,
  disconnect, hosting, and operational decisions are approved.

## Acceptance criteria

- Reload, impact ordering, damage-once, cleanup, weather application/reset, and
  generated map-motif lifecycle have deterministic and browser evidence.
- Three CPU actors have independent identity, health, AI, weapons, reload,
  collision, and rendering; the team result is emitted exactly once.
- Architecture/UML and versioned online contracts accurately separate local
  calls from future RPC/event transport.

## Required manuals

- `codex/manuals/handoff-execution.md`
- `codex/manuals/game-verification.md`
- `codex/manuals/reliability-gate.md`

## Verification plan

Run focused domain/integration tests, type-check, lint, all unit tests, build,
relevant and full browser tests, independent review, manual drift, and
postflight. Treat online protocol tests separately from deployed network proof.

Decision: approved
