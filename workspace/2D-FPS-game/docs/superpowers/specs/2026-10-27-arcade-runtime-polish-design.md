# Arcade Runtime Polish Design

## Intent

Make the default arcade entry and duel readable at a glance: every arena gets a distinct thumbnail, health is shown as whole numbers, weapons have clearly different damage and impact sizes, the HUD uses the selected arcade face instead of legacy operator art, weather is visibly applied, and combat/background audio is audible and varied by weapon and map.

## Goals

- Render all eight arcade maps in both selection surfaces with map-specific thumbnails and no shared Ground Shaker preview URL.
- Keep combat health as a continuous simulation value where needed, but format HUD and accessibility values as integers.
- Tune arcade weapons around the requested scale: Carbine 2, Bazooka 5, Air Strike 10, with explicit per-weapon direct hit radius and blast radius.
- Remove legacy portrait images from arcade markup while preserving classic-mode portraits.
- Preserve the existing weather renderer and make its runtime state visibly testable; configure the missing weather sound channels.
- Preserve existing hit/fire/reload/swap cue routing, add weapon-specific fire cues, and select a distinct procedural ambient motif for each arcade map.

## Non-goals and constraints

- Do not replace the existing Phaser stage artwork or add third-party audio/image dependencies.
- Do not round authoritative actor health or explosion damage; integer formatting belongs at the presentation boundary.
- Do not change classic-mode weapon tuning unless a shared contract requires it.
- Preserve unrelated dirty/untracked user files in the repository.
- Audio remains generated with Web Audio and starts after normal user interaction, subject to browser autoplay policy.

## Approaches

1. Replace all systems with new bitmap/audio assets. This would give the most visual control, but expands the asset pipeline and creates a new loading/licensing surface.
2. Patch each page and scene independently. This is fast locally, but duplicates map metadata and makes future maps drift between selection surfaces.
3. **Chosen:** keep the existing domain/presentation boundaries, add one shared arcade preview catalog, one arcade weapon tuning contract, presentation-only integer formatting, and extend the existing generated-audio/weather controllers. This fixes the observed wiring gaps while keeping the build deterministic and dependency-free.

## Acceptance evidence

- Unit tests prove all eight previews are rendered without the legacy URL, health formatting never emits decimals, and arcade weapon profiles expose the requested damage/radius differences.
- Unit tests prove each map resolves to a distinct ambient cue and weather balance produces play queue items.
- Browser evidence checks the arcade HUD contains mascot profiles rather than portrait images, selected weather updates the stage state, and a live fire/hit path still emits the expected runtime cue state.
- `npm run type-check`, `npm run lint`, `npm test`, `npm run build`, relevant Playwright tests, and manual drift checks pass after the final edit.
