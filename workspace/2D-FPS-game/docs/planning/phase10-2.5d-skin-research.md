# Phase 10 Research - 2.5D Character Skin Direction

- Research date: 2026-08-11
- Status: research complete; architecture and implementation deferred to 2026-08-12
- Runtime baseline: Phaser 3.90, TypeScript, Vite
- Recommended starting point: CC0 3D characters rendered to 8-direction 2D atlases

## Objective

Raise the current top-down prototype from coherent placeholder art to a more convincing commercial web-game presentation without replacing Phaser, changing collision, or expanding combat rules.

This research selects candidate sources and a safe production direction. It does not authorize an asset purchase, download, architecture change, or runtime implementation.

## Current Constraints

- `workspace/2D-FPS-game` remains the executable baseline.
- Existing actor physics, aim geometry, weapon balance, stage content, and 960x540 playfield must remain stable during the first visual proof of concept.
- Runtime paths continue to be owned by `VisualAssetCatalog` and the sprite asset contract.
- Browser delivery exposes downloaded textures to the client. Paid assets therefore require explicit game/web distribution rights and must not be shipped as reusable source packs.
- `MainScene.ts` is already close to its 850-line limit, so a new actor-visual controller is required before scene integration.

## Market Findings

| Candidate | What it provides | License / cost observed | Web-game fit | Decision |
| --- | --- | --- | --- | --- |
| [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) + [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) | Six bases, hairstyles, humanoid rig, 120+ animations including 8-direction locomotion and gun actions; FBX/glTF/Blend | CC0; free core download | Best legal and production flexibility; needs military outfit/material authoring and Blender render pipeline | **Recommended POC source** |
| [Synty POLYGON War](https://syntystore.com/products/polygon-war-pack) | 24 characters, 24 vehicles, 23 weapons, 588 total assets, FBX source | USD 99.99 observed; engine/platform-independent game license, source redistribution prohibited | Strongest coherent military art direction; browser delivery terms should be confirmed before purchase | Paid final-art candidate |
| [JustCreate3D Modular Soldiers](https://justcreate3d.itch.io/stylized-military-characters-modular-soldiers) | High-detail male/female modern soldiers, modular gear, FBX, humanoid/Mixamo compatibility | USD 49.99 observed; compiled-project use, no source sharing; animations not included | High character quality, but higher setup cost and browser-source exposure needs confirmation | Premium character candidate |
| [8WayPixels Adam](https://8waypixels.itch.io/top-down-adam) / [Cora](https://8waypixels.itch.io/top-down-cora) | Pre-rendered sprites around 150px, 8 directions, broad action set; Adam advertises a normal map | USD 3 each observed | Excellent visual reference and fast integration shape | Reference only until written commercial/web license is obtained |
| [CraftPix TDS Modern](https://craftpix.net/product/tds-modern-hero-weapons-props/) | 96 PNG, weapons, shooting/explosion art, shadows, PSD source | USD 4.50 observed; royalty-free game distribution under CraftPix license | Easy Phaser integration but reads as polished pixel/2D rather than premium 2.5D | Low-cost fallback |

Prices are observations from 2026-08-11 and may change.

## Licensing Assessment

- Quaternius explicitly marks the recommended character and animation packs CC0 and permits personal and commercial use. It is the safest browser-distribution baseline.
- Synty's current one-time license permits incorporation and distribution in video games across engines, operating systems, platforms, and devices, but prohibits sharing source files. Confirm that pre-rendered browser atlases are accepted incorporated derivatives before purchase.
- CraftPix permits commercial games and unlimited projects, but prohibits distributing reusable art/source files. A compiled game is allowed; source art must remain private.
- itch.io does not impose one common asset license. Adam and Cora do not display a license on their product pages. Another pack from the same seller, Bolt, is currently suspended following a copyright or trademark claim, so those packs are not production-safe without written clarification.

## Recommended Visual Pipeline

Use a 3D-to-2D production pipeline instead of adding live 3D rendering to the Phaser game:

```text
CC0 rigged model
  -> 8-direction animation in Blender
  -> orthographic color render + optional normal render
  -> trimmed 192-256 px frames
  -> PNG/WebP texture atlas
  -> Phaser Sprite / Light2D / contact shadow
```

The intended presentation layers are:

1. Lower body: idle, run, strafe, dodge in eight directions.
2. Upper body: aim, fire, reload, hit, and death; evaluate eight versus sixteen aim directions.
3. Weapon: independent catalog-driven weapon layer so six weapons do not multiply whole-body atlases.
4. Readability: soft contact shadow, restrained rim light, muzzle flash, recoil, hit mask, and team accent.
5. Skins: BLUE and RED material variants first; helmets, armor, backpacks, and camouflage become later catalog variants.

Phaser 3 supports sprite sheets/texture atlases, Y-based depth sorting, and WebGL `Light2D` normal-map lighting. The POC should compare baked lighting against `Light2D`; it should not assume dynamic lighting is automatically faster or clearer.

## Recommended First Slice

The first implementation should prove one visual contract, not build the whole skin store:

- One BLUE and one RED infantry skin from the same CC0 rig.
- Idle, run, fire, hit, and death animations in eight directions.
- One carbine upper-body/weapon presentation.
- Separate contact shadow and optional normal map.
- Existing physics body, combat logic, and weapon values unchanged.
- One explicit generated/legacy fallback retained during migration.
- Browser evidence for direction switching, aim readability, weather stacking, and clear-state cleanup.

Expansion to all six weapons, cosmetics, vehicles, or progression is conditional on POC readability, bundle size, and frame-time evidence.

## Tomorrow's Design Decisions

1. Confirm the art source: Quaternius CC0 POC (recommended) or a paid military pack.
2. Confirm actor semantics: replace the current world tank presentation with infantry, or introduce infantry as a separate visual mode.
3. Choose full-body frames versus lower-body/upper-body/weapon compositing.
4. Lock direction count, animation frame counts, atlas dimensions, target download size, and GPU-memory budget.
5. Decide baked lighting only versus optional normal maps and `Light2D`.
6. Define `ActorSkinDefinition`, `ActorAnimationState`, fallback behavior, preload ownership, and scene-lifetime controller interfaces.
7. Define deterministic catalog tests, animation-state tests, browser screenshots, console gate, and performance acceptance.
8. Obtain product-owner approval, then create the Phase 10 architecture, WBS, and task JSON before code changes.

## Proposed Acceptance Questions

- Does the skin read clearly at the current gameplay zoom and 960x540 playfield?
- Can BLUE and RED be distinguished without depending only on hue?
- Does aiming remain readable while moving in a different direction?
- Do rain, fog, sandstorm, and storm obscure the actor or normal-map response?
- Is the first-load asset size acceptable for a web game?
- Can the licensed runtime atlas be distributed without exposing prohibited reusable source content?
- Can the actor visual be replaced without touching collision, balance, or progression?

## Official References

- [Phaser frame animation and atlas concepts](https://docs.phaser.io/phaser/concepts/animations)
- [Phaser normal-map lighting example](https://phaser.io/examples/v3.85.0/loader/image/view/load-normal-map-with-light)
- [Phaser depth sorting](https://docs.phaser.io/phaser/concepts/gameobjects/components)
- [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html)
- [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html)
- [Synty one-time purchase license](https://syntystore.com/pages/one-time-purchase-licence)
- [CraftPix file licenses](https://craftpix.net/file-licenses/)
