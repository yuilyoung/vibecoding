# Phase 11-13 Roadmap - Visual Productization Vertical Slice

- Date: 2026-08-14
- Owner: product + product_owner + ultron/codex
- Status: Phase 11 complete; Phase 12 T1 six-family runtime slice complete, T2 pending
- Active workspace: `workspace/2D-FPS-game`
- Current executable baseline: Phase 11 product-default amendment, with Quaternius selected on `/` and Ground Shaker retained as explicit/total fallback

## Product Goal

Turn the feature-complete test harness into a coherent, saleable-looking top-down arena-shooter vertical slice. Within the first ten seconds on the default `/` route, a player must see authored characters, authored world objects, and responsive state animation that belong to one visual language.

This roadmap defines a product-quality target, not a claim that the game is commercially complete. Gameplay rules remain the verified baseline while presentation is replaced around them.

## Current Gap

| Surface | Current runtime | Product gap |
| --- | --- | --- |
| Characters | Quaternius BLUE/RED animated infantry is selected on `/`; Ground Shaker remains the explicit and total fallback | Phase 11 complete; absolute p95 failure retained and separate cadence exception passed |
| World objects | `?worldSkin=product-v1` uses authored barrel, mine, crate, cover, bounce-wall, and teleporter art; `/` and five remaining families retain legacy presentation | Six-family T1 is proven; complete 11-family coverage and default promotion remain |
| Motion | Player and dummy use five authored actor states in eight directions; object state art remains absent | Object and interaction feedback still lacks authored motion cohesion |
| Delivery state | Phase 11 is complete; Phase 12 v5 is approved and its first deterministic runtime vertical slice is complete | Phase 12 T2 must cover arena props, gates, hazard/vent surfaces, and pickups |

## Target-Frame Gate

The user approved the fixed 960x540 v5 target frame on 2026-08-21. It locks:

- top-down projection and sprite scale;
- material, outline, shadow, and palette rules;
- actor-to-object contrast and team accents;
- the maximum acceptable amount of UI-like glyph or text in the world.

Asset production may not mix unrelated packs merely because each individual asset is licensed or technically convenient. The approved target frame is the visual contract for later screenshots.

## Roadmap

| Phase | Outcome | Entry gate | Exit gate | Default route |
| --- | --- | --- | --- | --- |
| Phase 11 - Animated Character Delivery | Quaternius BLUE/RED actors with five states, eight directions, and independent carbine aim | Current approved Phase 11 contract | Existing T1-T5 provenance, reproducibility, animation, readability, performance, and review gates pass | Animated actor promoted early by user decision; legacy remains explicit/total fallback |
| Phase 12 - Authored Object Skin Kit | Eleven visible object families use authored skins from one art direction | Phase 11 reviewer pass and approved target frame | Every inventory item is skinned in all three stages; production presentation no longer depends on debug shapes or glyphs | Product pack remains opt-in |
| Phase 13 - State Animation and Default Promotion | Actor, object, interaction, and combat feedback form one responsive motion system | Phase 12 reviewer pass | Integrated visual, lifecycle, screenshot, performance, and fallback gates pass | Product pack becomes default; legacy remains explicit total fallback |

The phases are intentionally sequential. Phase 11 stays character-only so the first real runtime delivery is not delayed by the object inventory. Phase 12 and Phase 13 receive detailed architecture/WBS contracts only after the preceding runtime phase passes.

## Authored Object Inventory

Phase 12 covers 11 player-visible families:

1. Blast barrel.
2. Proximity mine.
3. Supply crate.
4. Breakable cover.
5. Bounce wall.
6. Teleporter.
7. Arena obstacle family, including core, tower, and barrier variants.
8. Service gate.
9. Vent and hazard-surface family.
10. Ammo pickup.
11. Health pickup.

Collision primitives may remain invisible implementation details. In production presentation, circles, rectangles, single-letter glyphs, `VENT`/`COVER` labels, and percentage text may be used only by an explicit QA overlay, never as the primary visual identity.

## Product Acceptance

### Character gate

- Exactly two teams x five states x eight directions and 176 stable frame keys per team.
- Actual Phaser playback for `idle`, `run`, `fire`, `hit`, and `death`; no state may alias a static frame.
- State priority is `death > hit > fire > run > idle`.
- Movement direction and aim direction remain legible when they differ by at least 90 degrees.
- Phase 11 retains its stricter limits: at most 8 MiB transfer, 32 MiB raw GPU estimate, p95 at most 16.7 ms, and at most +1.0 ms versus legacy.

### Object gate

- Authored-skin coverage is 100% for the 11 families across all three stages.
- Each object exposes the applicable subset of `idle`, `active`, `damaged`, `disabled`, and `destroyed` presentation states.
- Existing collider, interaction bounds, damage, cooldown, and spawn-position values remain unchanged.
- Team, hazard, pickup, and traversal affordances remain readable without world text.

### Animation gate

- Required responses include mine arm/trigger, barrel explosion, crate and cover damage/destruction, bounce impact, teleport transfer, gate open/close, vent activation, and pickup collect/respawn.
- One-shot clips do not restart or overlap from duplicate event delivery.
- A presentation response starts no later than the render frame following its gameplay event.
- Twenty stage/weather transitions leave zero orphan tweens, duplicate animation keys, or live scene controllers.

### Integrated product gate

- The final visual pack is selected on `/` without a query parameter; an explicit legacy option restores the complete fallback.
- A deterministic 3-stage x 5-weather screenshot matrix contains no missing textures or production debug geometry.
- Console and page errors are zero.
- Combined product visual-pack transfer is at most 12 MiB and estimated raw GPU textures are at most 64 MiB.
- The fixed 960x540 storm scene remains at or below 16.7 ms p95 and at most +1.5 ms versus the current legacy baseline.
- Independent review scores art cohesion, actor focus, team readability, object affordance, and state readability at least 4/5 in every category.

## Architecture Boundaries

| Layer | Responsibility | Planned ownership |
| --- | --- | --- |
| Presentation | Preload immutable manifests, create scene-lifetime actor/object views, select clips, apply transforms, and dispose textures/tweens/controllers | extracted actor composition, `VisualController` successor, `MapObjectController`, `StageGeometryManager`, scene composition root |
| Business | Define pack selection, actor and object skin contracts, state priority, fallback, anchors, scale, clip metadata, and budget validation without Phaser types | `ActorSkinCatalog`, new `WorldObjectSkinCatalog`, pure manifest validators |
| Data/build | Preserve source/license/hash evidence and produce immutable runtime atlases/manifests with deterministic tools | `public/assets/source`, build adapters under `tools`, `public/assets/runtime` |

```mermaid
flowchart LR
  SRC[Vendored sources and licenses] --> BUILD[Deterministic asset builders]
  BUILD --> MANIFEST[Immutable visual-pack manifests]
  MANIFEST --> ACTOR[ActorSkinCatalog]
  MANIFEST --> OBJECT[WorldObjectSkinCatalog]
  ACTOR --> AP[Actor presentation owner]
  OBJECT --> OP[Object presentation owner]
  EVENTS[Existing gameplay events and state] --> AP
  EVENTS --> OP
  SCENE[MainScene composition root] --> AP
  SCENE --> OP
```

The catalogs own presentation policy but do not own damage, collision, cooldowns, spawning, or balance. Runtime code never imports Blender, encoder, or source-model types. There is no persistence schema or network acquisition in this program.

### Boundary contracts

```ts
type VisualPackId = "legacy" | "product-v1";
type ObjectPresentationState = "idle" | "active" | "damaged" | "disabled" | "destroyed";

interface WorldObjectSkinDefinition {
  readonly kind: MapObjectKind | ArenaPropKind;
  readonly textureKey: string;
  readonly anchor: Readonly<{ x: number; y: number }>;
  readonly scale: number;
  readonly clips: Readonly<Partial<Record<ObjectPresentationState, AnimationClipDefinition>>>;
  readonly fallback: WorldObjectSkinDefinitionRef;
}

interface VisualPackManifest {
  readonly id: VisualPackId;
  readonly sources: readonly ProvenanceRecord[];
  readonly actorManifest: string;
  readonly objectManifest: string;
  readonly transferBytes: number;
  readonly estimatedGpuBytes: number;
}
```

One scene-lifetime owner is responsible for each actor or object presentation. The composition root creates owners after preload and destroys them before Phaser releases scene objects. Missing, incomplete, or over-budget product manifests activate the total legacy pack; mixed partial activation is forbidden.

## Ordered Delivery

1. Capture the current default screenshot, transfer/GPU estimate, frame-time sample, and collider/bounds baseline.
2. Execute Phase 11 T1-T5 unchanged: provenance, deterministic generator, actor composition extraction, opt-in runtime, and verification.
3. Phase 11 passed and the user approved v5; the first six-family Phase 12 source/catalog/runtime slice completed on 2026-08-21.
4. Deliver Phase 12 as repeated vertical slices: the first six-family catalog/preload/presentation slice passed on 2026-08-21; next expand the same contract to the remaining five families.
5. Create and execute the Phase 13 event-to-animation contract, integrated screenshot/performance suite, and default-promotion migration.
6. Synchronize task JSON, project status, handoff, active baseline, reviewer evidence, drift, and postflight after every runtime phase.

## Delivery Rules

- A documentation-only contract is planning progress, not a visual improvement.
- A visual phase cannot be called complete without runtime evidence from its current workspace fingerprint.
- A hidden query option is a QA milestone, not a product-delivery endpoint.
- The complete actor/object visual-pack promotion still occurs in Phase 13. The actor-only default was promoted early on 2026-08-20 by direct user decision; this does not certify Phase 12/13 art.
- User approval is required for the target frame and final default-promotion capture.

## Risks and Non-Scope

Primary risks are mixed art direction, sprite/collider mismatch, weather readability loss, atlas/GPU growth, scene-lifetime leaks, and leaving improvements permanently hidden behind opt-in flags. Each is bound to the target-frame, baseline-preservation, budget, lifecycle, or promotion gate above.

This program excludes new gameplay rules, balance changes, maps, weapons, modes, skin commerce or persistence, paid assets, live 3D, normal maps, `Light2D`, and a full HUD redesign.
