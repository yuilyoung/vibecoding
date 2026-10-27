# Arcade Character Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two arcade characters and apply four distinct character gameplay profiles to the player.

**Architecture:** A pure player-domain profile owns character traits and weapon-stat transformation. Actor skin definitions reference that profile; the selection UI and arcade route accept the same IDs, while `MainScene` and the weapon-slot factory apply the profile at composition time.

**Tech Stack:** TypeScript, Phaser scene composition, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-10-27-character-variants-design.md`

## Global Constraints

- Keep classic actor definitions neutral and unchanged.
- Preserve arcade's existing five-times ammo capacity scaling.
- Apply character traits to the player only; do not buff the dummy.
- Do not add dependencies or external assets.

## Review Focus

- Unsupported character query: resolve to the safe arcade bunny default.
- Classic actor profile: all trait multipliers/bonuses remain neutral.
- Ammo order of operations: character bonuses are applied before arcade's five-times scaling.
- Reload edge cases: reload duration stays positive and air-strike zero-duration behavior is preserved.
- Selection markup: exactly four character inputs expose profile copy and all IDs submit through the existing route.

### Task 1: Character profile contract

**Files:**
- Create: `src/domain/player/CharacterGameplayProfile.ts`
- Create: `tests/CharacterGameplayProfile.test.ts`
- Modify: `src/domain/visual/ActorSkinCatalog.ts`

**Interfaces:**
- `CharacterGameplayProfile` exposes `magazineBonus`, `reserveAmmoBonus`, `movementSpeedMultiplier`, `maxHealthBonus`, `reloadTimeMultiplier`, `traitLabel`, and `traitDescription`.
- `getCharacterGameplayProfile(id: string | null | undefined)` returns a known profile or neutral profile.
- `applyCharacterWeaponProfile(config, profile)` returns transformed magazine, reserve, and reload values.

- [x] Write failing tests for all four exact profiles, neutral fallback, and weapon transformation.
- [x] Run `npm test -- CharacterGameplayProfile` and confirm the missing module/profile failure.
- [x] Implement the pure profile module and attach a profile to actor definitions.
- [x] Run the focused profile and actor catalog tests and confirm they pass.

### Task 2: Four-character route and presentation

**Files:**
- Modify: `src/domain/visual/ArcadeExperience.ts`
- Modify: `src/ui/SelectionFlow.ts`
- Modify: `src/ui/CozyArcadePicker.ts`
- Modify: `src/styles.css`
- Modify: `src/ui/cozy-arcade.css`
- Modify: `src/scenes/arcade-actor-art.ts`
- Modify: `tests/ArcadeExperience.test.ts`
- Modify: `tests/SelectionFlow.test.ts`

**Interfaces:**
- Arcade route resolution accepts all four IDs.
- Selection cards use the profile label/description and submit the selected character.
- Generated vector rendering selects bunny, bear, fox, or cat silhouette details.

- [x] Extend route and UI tests to assert four IDs and trait copy.
- [x] Run focused tests and confirm the new IDs fail before implementation.
- [x] Add fox/cat definitions, cards, CSS shapes, and species-aware generated art.
- [x] Run focused UI/route tests and confirm they pass.

### Task 3: Runtime stat application

**Files:**
- Modify: `src/domain/player/PlayerLogic.ts`
- Modify: `src/scenes/MainScene.ts`
- Modify: `src/scenes/weapon-slot-factory.ts`
- Modify: `tests/PlayerLogic.test.ts`
- Modify: `tests/WeaponLogic.test.ts` or add a focused factory test as needed.

**Interfaces:**
- `MovementConfig` accepts an optional base `movementSpeedMultiplier` without changing existing callers.
- `createPlayerWeaponSlots(gameBalance, characterProfile?)` remains backward-compatible and applies a profile when supplied.

- [x] Write failing tests for configured movement multiplier and profile-driven weapon values.
- [x] Run the focused tests and confirm the new behavior fails.
- [x] Apply health/movement traits in `MainScene` and ammo/reload traits before arcade scaling in the factory.
- [x] Run focused tests and confirm they pass.

### Task 4: Verification

- [x] Run `npm run type-check`.
- [x] Run `npm run lint`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Confirm the local server responds at `http://127.0.0.1:5173/`.
- [x] Review the current diff and report the browser E2E timing limitation explicitly.
