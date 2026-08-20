# Product V1 Map-Object Source Provenance

- Generated: 2026-08-21
- Mode: OpenAI built-in image generation
- Style reference: `docs/reports/phase12-t0-evidence/phase12-foundry-target-frame-v5.png`
- Output contract: twelve independent opaque low-poly props on a flat `#00ff00` background, then local border-key soft-matte/despill conversion to immutable alpha PNG sources.
- Rejected output: the first damaged-crate variant used a dark studio background and was not promoted.
- Source byte lengths and SHA-256 hashes are pinned by `tools/world-object-atlas/source-lock.json`.

## Shared prompt

`Use case: stylized-concept or precise-object-edit. Asset type: production game sprite source. Match the approved Foundry v5 camera, low-poly steel/navy materials, orange accents, crisp dark outline, and upper-left internal lighting. Render exactly one complete centered object on a perfectly flat solid #00ff00 chroma-key background with generous padding. No cast/contact shadow, floor, scene, character, text, letters, numbers, logo, watermark, triangle, cross, plus, skull, explicit glyph, icon, extra object, or UI.`

## Per-source prompt deltas

| Source | Requested subject/state |
| --- | --- |
| `barrel-idle.png` | Upright reinforced orange-red barrel, intact, two dark bands and plain cap. |
| `barrel-damaged.png` | Same barrel with one dent, two short physical cracks, edge wear, and scorch discoloration; not exploded. |
| `mine-idle.png` | Squat circular steel/navy mine with orange rim hardware, recessed dark center, and energy cells off. |
| `mine-armed.png` | Same mine with six separated amber lights and contained cyan recessed-center energy. |
| `crate-idle.png` | Closed navy supply crate with amber corner armor, dark latches, and three separated amber lenses. |
| `crate-damaged.png` | Same closed crate with one shallow dent, one cracked corner guard, and restrained edge wear. |
| `cover-idle.png` | Wide three-panel armored cover with dark top cap/end posts and restrained lower amber wear. |
| `cover-damaged.png` | Same cover with a dented center plate, short upper split, gouges, and restrained scorch wear. |
| `bounce-wall-idle.png` | Two armored pylons joined by a dark rail; energy cells off and no beam. |
| `bounce-wall-active.png` | Same assembly with contained cyan cells and one narrow straight cyan energy band. |
| `teleporter-idle.png` | Low circular platform with segmented violet ring, dark center, orange fasteners, and energy off. |
| `teleporter-active.png` | Same platform with contained cyan-violet seams and an opaque faceted violet-blue center disk. |

The damaged/active variants used their idle source as an identity and framing reference. No CLI fallback, API key, or native-transparency model was used.
