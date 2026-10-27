# Arena Strike Selection and Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a data-driven deployment picker for the existing FPS game and extend generated audio feedback without breaking the current classic route.

**Architecture:** Keep selection parsing in the domain layer, render controls in a dedicated UI module, and pass the normalized selection into the existing scene bootstrap. Extend the existing sound cue contract and generated tone player; keep audio lifecycle owned by the scene audio controller.

**Tech Stack:** TypeScript, Phaser, Vite, Vitest, existing generated Web Audio tones.

**Spec:** `docs/superpowers/specs/2026-10-27-arena-strike-deployment-selection-design.md`

## Global Constraints

- Preserve the existing classic gameplay route and existing tests.
- Reuse existing stage, weapon, actor skin, world skin, and weather catalogs.
- Keep secrets and payment implementation out of this gameplay slice.
- Keep the deployment picker URL-normalized and safe for arbitrary query input.
- Keep generated audio casual and low-volume; stop loops during scene shutdown.

## Review Focus

- Invalid query values must fall back to safe defaults rather than altering gameplay unexpectedly.
- Keyboard focus in the picker must not fire or move the Phaser scene.
- Repeated weapon/fire/impact events must respect the existing audio cap and cooldown.
- A suspended or unavailable AudioContext must leave the game playable.
- Existing classic route behavior must remain unchanged when no picker values are supplied.

### Task 1: Selection domain contract

**Files:**
- Create: `src/domain/deployment/DeploymentSelection.ts`
- Test: `tests/DeploymentSelection.test.ts`

- [ ] Write failing tests for defaults, normalization, and deterministic query creation.
- [ ] Run the focused test and observe the missing-module failure.
- [ ] Implement the normalized selection contract for weapon, stage, enemy count, weather, actor skin, and world skin.
- [ ] Run the focused test and the existing selection-related tests.

### Task 2: Deployment picker UI

**Files:**
- Create: `src/ui/DeploymentPicker.ts`
- Modify: `src/main.ts`, `src/styles.css`
- Test: `tests/DeploymentPicker.test.ts`

- [ ] Write failing render/bind tests for image cards, 1-4 enemy controls, and normalized submit navigation.
- [ ] Implement the picker with existing visual asset paths and keyboard shielding.
- [ ] Mount it on the classic route and preserve the existing cozy picker route.
- [ ] Run focused UI tests and the full unit suite.

### Task 3: Scene selection wiring

**Files:**
- Modify: `src/main.ts`, scene bootstrap/runtime selection boundaries
- Test: `tests/DeploymentSelection.test.ts`, relevant scene tests

- [ ] Add failing assertions that selected stage/weather/skin values reach the runtime configuration.
- [ ] Wire the normalized selection into scene startup while keeping default values identical.
- [ ] Add the enemy-count field to runtime state and preserve count=1 behavior.
- [ ] Run type-check, focused tests, and the full unit suite.

### Task 4: Casual generated audio

**Files:**
- Modify: `src/domain/audio/SoundCueLogic.ts`, `src/domain/audio/AudioCueLogic.ts`, `src/domain/audio/GeneratedAudioCuePlayer.ts`, `src/scenes/audio-feedback-controller.ts`
- Test: `tests/SoundCueLogic.test.ts`, `tests/GeneratedAudioCuePlayer.test.ts`, `tests/AudioCueLogic.test.ts`

- [ ] Write failing tests for impact, weapon swap, fire, and ambient cue resolution/tone contracts.
- [ ] Add low-volume casual tones and an ambient loop with explicit start/stop lifecycle.
- [ ] Connect existing combat and swap events where they are already emitted; do not duplicate events.
- [ ] Run focused audio tests and the full unit suite.

### Task 5: Browser verification and handoff

**Files:**
- Create: `tests/e2e/deployment-picker.spec.ts`
- Modify: `docs/reports/project-status.md` only if evidence requires a status update

- [ ] Verify the picker renders and preserves query selection in a browser.
- [ ] Verify the classic route remains playable with the default selection.
- [ ] Run type-check, lint, full unit tests, build, and relevant Playwright tests.
- [ ] Perform read-only review of the final diff and record remaining multi-enemy implementation work.
