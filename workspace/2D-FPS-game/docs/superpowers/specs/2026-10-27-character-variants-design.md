# Arcade Character Variants Design

## Intent

Expand the arcade duel entry from two selectable characters to four. Each arcade character must be visually distinct and carry a readable, deterministic gameplay profile that affects magazine capacity, reserve ammo, movement speed, max health, and reload duration.

## Goals

- Support `arcade-bunny`, `arcade-bear`, `arcade-fox`, and `arcade-cat` in the arcade route and selection flow.
- Keep character gameplay traits in a domain profile rather than hard-coding them in the UI.
- Apply the selected profile only to the player; the rival keeps the existing baseline balance.
- Preserve the existing five-times arcade ammo scaling, applying character bonuses before that multiplier.
- Show each character's trait summary in the selection screen.

## Non-goals

- No new payment, ranking, unlock, persistence, or online matchmaking behavior.
- No change to classic vehicle/infantry balance.
- No replacement of the existing animation atlas pipeline; new arcade visuals remain generated vector atlas frames.

## Character balance proposal

| Character | Trait | Magazine | Reserve | Move | Max HP | Reload time |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Soda Bunny | Quick paws | +2 | +12 | 1.08x | +0 | 0.90x |
| Honey Bear | Cozy tank | +4 | +24 | 0.90x | +36 | 1.12x |
| Turbo Fox | Dash scout | +1 | +8 | 1.18x | +8 | 0.82x |
| Mochi Cat | Smooth loader | +3 | +16 | 1.04x | +18 | 0.72x |

The profile stores both the machine-readable values and short presentation copy. Lower reload-time multipliers mean faster reloads. Non-arcade definitions use a neutral profile so classic behavior remains unchanged.

## Approaches

- UI-only labels: rejected because the character choice would not affect gameplay.
- Route-specific balance overrides: rejected because it duplicates balance logic and makes classic/arcade behavior fragile.
- Shared character gameplay profile injected into domain and scene wiring: selected because it gives one source of truth for UI copy, player construction, and weapon construction while preserving the current architecture.

## Implementation boundary

- `src/domain/player/CharacterGameplayProfile.ts` owns the profile contract and weapon-stat transformation.
- `src/domain/visual/ActorSkinCatalog.ts` associates every actor definition with a profile and adds the two generated arcade skins.
- `src/domain/visual/ArcadeExperience.ts`, `src/ui/SelectionFlow.ts`, and `src/ui/CozyArcadePicker.ts` accept all four arcade IDs.
- `src/scenes/MainScene.ts` applies health and movement traits to the player, while `src/scenes/weapon-slot-factory.ts` applies ammo and reload traits.
- `src/scenes/arcade-actor-art.ts` renders species-specific vector silhouettes.

## Acceptance

- Four character cards render and each submitted ID round-trips through the arcade URL.
- Profile tests prove exact trait values and neutral fallback behavior.
- Player tests prove max health, movement speed, and weapon tests prove ammo/reload transformations.
- Existing unit tests, lint, type-check, and production build remain green.
