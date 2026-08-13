# Phase 2 Sprint 2 WBS - Advanced Map Objects

- Date: 2026-04-21
- Owner: ultron
- Status: complete
- Handoff: `../../../../docs/handoffs/current-handoff.json` (id: `phase-2-sprint2-advanced-map-objects`)

## Summary

Sprint 2 extends the stage-definition slice for three advanced map object kinds: `cover`, `bounce-wall`, and `teleporter`. This slice is limited to balance schema, stage content schema/validation, conservative default placements for the three shipped stages, and tests that lock the data contract before scene/runtime workers wire the new behaviors.

## Pre-work and Contracts

- Balance data remains rooted in `assets/data/game-balance.json`; Sprint 1 `barrel`, `mine`, and `crate` values must not change.
- `StageContentDefinition` owns stage-level validation for map-object caps and required placement metadata.
- `bounce-wall` requires `angleDegrees`; `teleporter` requires `pairId`, and each `pairId` must appear exactly twice inside one stage.
- Conservative placements only: stage-1 adds cover, stage-2 adds one bounce wall and one teleporter pair, stage-3 adds two bounce walls.
- Spawner behavior stays normalization-first: invalid stage content fails before an active plan is stored.

## Tasks

| ID | Work | Approx Lines | Depends | Acceptance | Status |
|----|------|-------------|---------|-----------|--------|
| T0 | Extend `game-balance.json` and `scene-types.ts` for `cover` / `bounceWall` / `teleporter` config | ~40 | - | A1 | complete |
| T1 | Expand `StageContentDefinition.ts` kinds, optional fields, validation, and stage caps | ~90 | T0 | A2, A3 | complete |
| T2 | Keep `StageContentSpawner.ts` compatible with normalized advanced map object payloads | ~0-10 | T1 | A4 | complete |
| T3 | Update `StageContentDefinition.test.ts` for shipped placements, field normalization, cap failures, and pair validation | ~140 | T1 | A5 | complete |
| T4 | Update `StageContentSpawner.test.ts` for field preservation and invalid-plan rejection | ~80 | T2 | A6 | complete |
| T5 | Author Sprint 2 WBS aligned to Sprint 1 structure and under 200 lines | ~40 | T0-T4 | A7 | complete |

Acceptance numbering follows the scope of this owned slice, not the full sprint handoff.

## Dependency Graph

```text
T0 -> T1 -> T2
        -> T3
T2 -> T4
T0..T4 -> T5
```

`T0` establishes the balance/schema baseline. `T1` defines the stage-content contract that both data and tests depend on. `T2` confirms the spawner continues to normalize through that contract. `T3` and `T4` lock the behavior with data-driven tests. `T5` records the slice for parallel workers.

## Data Schema

```jsonc
{
  "mapObjects": {
    "cover": { "hp": 60, "width": 48, "height": 16, "blocksBullets": true },
    "bounceWall": { "width": 48, "height": 8, "maxReflections": 3 },
    "teleporter": { "radius": 24, "cooldownMs": 1500 }
  }
}
```

## Stage Placement Plan

```text
stage-1 foundry:
  keep barrel x2, crate x1
  add cover x2

stage-2 relay-yard:
  keep barrel x4, mine x3, crate x2
  add cover x3
  add bounce-wall x1
  add teleporter x2 (pairId relay-alpha)

stage-3 storm-drain:
  keep barrel x6, mine x2, crate x1
  add cover x2
  add bounce-wall x2
```

## Validation Rules

- Legacy caps stay in force: `mine <= 12`, `barrel <= 16`.
- New caps: `cover <= 20`, `bounce-wall <= 16`, `teleporter <= 8` (`4` pairs).
- `bounce-wall` entries without `angleDegrees` are invalid.
- `teleporter` entries without `pairId` are invalid.
- A teleporter `pairId` with `1` or `3+` entries is invalid.
- Duplicate ids still keep the first normalized entry.

## Risks

| Risk | Mitigation |
|------|------------|
| Runtime workers may assume normalization silently caps invalid content | Validation now fails fast with explicit errors so invalid stage data is visible immediately. |
| Parallel edits could change stage layouts outside this slice | Only owned files are touched; placements are conservative and preserve all Sprint 1 objects. |
| New schema fields could drift from tests | Balance, stage data, and tests are updated together in the same slice. |

## Out of Scope

- Runtime logic for cover blocking, bounce reflection, or teleport resolution.
- Scene/controller rendering for the new map object kinds.
- Execution report updates and full sprint verification gates.

## References

- Previous sprint WBS: `./phase2-sprint1-map-objects-wbs.md`
- Handoff: `../../../../docs/handoffs/current-handoff.json`
- Tasks: `./phase2-sprint2-tasks.json`
