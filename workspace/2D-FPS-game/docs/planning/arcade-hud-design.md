# Arcade arena and combat HUD

User request: improve the default game image quality and score, hit, energy and weapon UX.
Product-owner decision: approved (2026-09-07). This is a new workspace-scoped slice, not Phase 13 promotion.

## Contract

- Presentation: a compact scoreboard, unobstructed 960×540 arena, bottom energy/weapon dock, collapsible arena guide. Bright beveled floor and props are authored in Phaser; existing character atlases, selectors, object fallback and colliders remain authoritative.
- Business: existing HudSnapshot supplies health, score, reload, cooldown, inventory and unlocks. A pure HUD state projection derives readiness and transient feedback from consecutive snapshots. Energy means HP; unlimited sprint does not gain a fictitious resource.
- Data: existing asset catalog and pinned atlases remain unchanged. No new acquisition or asset build boundary.
- Composition: main.ts owns the DOM view and routes weapon button intent through MainScene to the same guarded combat controller used by keyboard input. MainScene remains below 850 lines.
- Lifetime: HUD feedback belongs to the page view; reset/respawn clears transient state. The floor belongs to StageVisualController and is destroyed with the scene. Render operations remain on the browser thread; no workers or persistence are added.

## Acceptance and verification

Default-route before/after captures must show actual arena improvement. Score at top; numerical and visual HP energy, active weapon, ammo, reload, cooldown and lock state below. Hit, healing, score and weapon feedback must expire and clear at lifecycle transitions. Buttons must not fire weapons or bypass combat locks. Preserve settings/tutorial and all skin recovery routes. Check desktop and narrow layouts, all 3 stages × 5 weather states, scene restart and browser errors.

Run focused HUD state and runtime tests, then type-check, lint, all unit tests, production build, all Playwright scenarios, independent reviewer, manual drift and postflight. Preserve pre-existing dirty files and historical evidence. Do not claim commercial-quality equivalence or performance certification solely from these checks.

Selected manuals: handoff-execution, game-verification, reliability-gate.
