# 2D-FPS-game Project Status Report

- Date: 2026-08-17
- Author: ultron
- **Phase:** Phase 11 - Quaternius Animated Character POC
- Previous Phase: Phase 10 - Character Skin Foundation POC (complete, 2026-08-12)
- Status: Phase 11 implementation in progress; T2 deterministic atlas build complete

| Key | Value |
| --- | --- |
| Active milestone | Phase 11 - Quaternius Animated Character POC |
| Product program | Phase 11-13 Visual Productization Vertical Slice |
| Development status | T0-T2 complete; T3-T5 implementation pending. |
| Verification | pass (T2 generator/artifact gate) |

## Summary

Phase 10 remains complete and is still the executable runtime baseline. Phase 11 T2 is now complete: `npm run assets:actor-atlas` verifies the exact T1 inputs, pinned Blender 4.5.12 Windows x64 archive/executable/build, frozen rig/action inventory, and `sharp@0.35.3`; renders two isolated clean builds; compares release bytes and decoded pixel hashes; and promotes only a complete matching release.

The generated BLUE/RED atlases are not integrated yet, so runtime behavior did not change. Ground Shaker vehicles remain the default/fallback and the opt-in Kenney static infantry remains the only selectable character-skin POC until T3.

The product objective is now explicit: the default `/` route must become a coherent, saleable-looking visual vertical slice. Phase 11 delivers animated characters, Phase 12 replaces the 11 player-visible object families with authored skins, and Phase 13 integrates state animation and promotes the complete visual pack to the default. Planning progress is not counted as a visual improvement.

## Visual Productization Roadmap

| Phase | User-visible outcome | Current state |
| --- | --- | --- |
| Phase 11 | Opt-in BLUE/RED animated characters with five states and eight directions | implementation in progress; T2 complete, T3-T5 pending |
| Phase 12 | Authored skins for six map objects, three arena-prop families, and two pickups | locked behind Phase 11 runtime/reviewer pass |
| Phase 13 | Object/interactions animation, integrated visual polish, and default-route promotion | locked behind Phase 12 runtime/reviewer pass |

The detailed product goal, object inventory, architecture boundaries, budgets, and promotion gate are in `../planning/phase11-13-visual-productization-roadmap.md`.

## Completed Contract Work

- Re-verified the official Quaternius source pages as CC0 on 2026-08-13 and approved their free-core downloads for a later vendoring slice, subject to acquisition-time re-verification and SHA-256 recording.
- Locked one BLUE and one RED character, one external carbine presentation, idle/run/fire/hit/death, eight directions, and 176 frames/team.
- Locked one 2048x2048, 128px-cell WebP atlas per team: at most two atlases, 8 MiB combined transfer, and 32 MiB raw RGBA GPU memory.
- Locked p95 frame time at or below 16.7 ms and regression at or below 1.0 ms in the same fixed 960x540 scenario.
- Defined pinned Blender 4.5.12, offline one-command generation, stable frame keys/order, validated staging plus atomic promotion, source/generator/output hashes, and byte-identical clean regeneration.
- Implemented that contract with exact Blender/archive/executable and Sharp locks, frozen 68-bone/five-action mapping, typed JSONL state transitions, transactional promotion/rollback, and decoded-pixel reproducibility checks.
- Required actor composition extraction before runtime integration because `MainScene.ts` is 848/850 lines.

## Phase 11 T1 Source Acquisition - 2026-08-17

- Re-verified both official Quaternius pages at acquisition time as CC0, free-tier, and permitted for commercial use.
- Vendored `Universal Base Characters[Standard].zip`: 128,968,391 bytes, 112 file entries, SHA-256 `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40`.
- Vendored `Universal Animation Library[Standard].zip`: 15,904,933 bytes, 9 file entries, SHA-256 `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724`.
- Recorded sorted streamed inventories for every archive entry: Base Characters inventory SHA-256 `38fd855a356379b2dd0bd32c389c997e8fc6a8d9e16ce1a89bcc80833ac192f9`; Animation Library inventory SHA-256 `237b76b03ee017fce45b34fafca61f68466d6061a276c9f8b4cff91b5b9cb98a`.
- Preserved dated official-page snapshots, byte-exact archive license files, canonical CC0 legal code, stable official download endpoints/upload IDs, and directory-scoped Git LFS rules.
- Deterministic provenance verification, independent review, manual drift, and Codex postflight passed. No runtime test was required because T1 changed no executable or served runtime path.

## Phase 11 T2 Deterministic Atlas Build - 2026-08-17

- Pinned official Blender `4.5.12 LTS` Windows x64 build `84afd5f785f7`: archive SHA-256 `103b9f7d0b41cbb5fd89ad1c5c4aafbbeb5bfd71297667910446d0141ce3b43a`, executable SHA-256 `7fbcc9f2b4a99ad19c1f9deb15c3e6786e62c7ccb624f66009b41b8203c0eba9`.
- Pinned `sharp@0.35.3` and lockfile integrity `sha512-ej0zVHuZGHCiABXcNxeYhpRnPNPAcvbG8RMdBAhDAxLKkCRVSpK3Iyu7qbqw3JMzoj0REeM6f3tJLtVwl0023Q==`.
- Froze matching `Armature` / `Armature.001` inventories with 68 exact bone names and actions `Idle_Loop`, `Jog_Fwd_Loop`, `Pistol_Shoot`, `Hit_Chest`, and `Death01` plus exact frame ranges.
- Two isolated 352-frame clean builds produced byte-identical and decoded-pixel-identical releases before promotion. BLUE and RED each contain 176 stable keys in one 2048x2048 lossless WebP plus valid Phaser JSON.
- Final hashes: BLUE WebP `fa0f63ab9c32b30c7250bc73f7e178bfd158e7b471bc11ff440fb7785e7f0be9`, BLUE JSON `4e76926875e40593edbf2da2359af6abcb9f40033202976aa1e81cf6ecc3afef`, RED WebP `7cda584fdadf2ef96285907486e65e0a37e81131950788287025866f7b26670f`, RED JSON `ea3ad0d862404097a21eae4e87a22f3c59bebc6fb49ebe6af95d6fe734fb9334`, manifest `2669d9fd0576af1d03b136898a252e0d5c8e70504b706907f24b1de6490a5249`.
- Combined transfer is `788828` bytes; raw RGBA GPU memory is `33554432` bytes; mipmaps are disabled; both atlases have zero non-zero RGB pixels under fully transparent alpha.
- Focused generator contracts passed 13 / 13, type-check and lint passed, the full Vitest baseline passed 58 files / 344 tests, production build passed, visual atlas inspection passed, and independent reviewer found no issue.
- T3 runtime/catalog/scene integration and T4 browser, performance, and five-weather readability evidence were intentionally excluded.

## Historical Phase 11 Contract Verification - 2026-08-13

These results belong to the original Phase 11 contract fingerprint. They are retained as planning-baseline evidence and do not certify the 2026-08-14 Visual Productization roadmap edit, which requires its own current-fingerprint review, drift, and postflight sequence.

| Gate | Result | Notes |
| --- | --- | --- |
| workspace/project status | **pass** | Phase 10 baseline and sole decision target identified by repository commands |
| harness audit | **pass** | Hermes audit returned zero errors before planning |
| product-owner gate | **pass** | Contract-only slice, exclusions, acceptance, manuals, and later deterministic checks approved |
| official source check | **pass** | Quaternius official character and animation pages displayed CC0 and commercial-use permission on 2026-08-13 |
| local baseline audit | **pass** | 31 runtime assets / 196,353 bytes; `MainScene.ts` 848/850; Blender absent from PATH and intentionally deferred |
| planning JSON | **pass** | Phase 11 task graph and cross-document contract consistency validated |
| scalable workspace fingerprint | **pass** | The original Phase 11 contract fingerprint was stable across repeated runs after replacing binary-patch buffering |
| independent review | **pass** | Reviewer found no defect on the original Phase 11 contract fingerprint |
| drift / postflight | **pass** | The original Phase 11 contract fingerprint passed manual drift and postflight |

The previous executable evidence remains 58 Vitest files / 344 tests, production build, and 37 / 37 Playwright scenarios from Phase 10. It is historical baseline evidence, not proof of the future animated implementation.

## Scope Audit

- T1 added the exact Quaternius free Standard source archives, local license/provenance evidence, and directory-scoped Git LFS rules.
- T2 added only the offline build adapter/tool lock/tests, exact Sharp dependency, and generated actor atlas release.
- Did not integrate the atlases into the catalog/scene or change runtime/gameplay behavior.
- Did not authorize paid assets, live 3D, normal maps, `Light2D`, all-six-weapons art, cosmetics, persistence, or making infantry the default.
- Preserved unrelated dirty workspace changes.

## Blocking Issues

None for T2. Blender remains an intentionally local, ignored portable tool cache verified by the offline command rather than a PATH dependency.

## Immediate Next Tasks

| Priority | ID | Task | Owner | Estimate |
| --- | --- | --- | --- | --- |
| 1 | Phase 11 T3 | Extract actor presentation composition and integrate the opt-in animated skin with total legacy fallback. | ultron | implementation |

T4-T5 remain dependency-locked behind T3 and are not yet actionable.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Upstream free-core contents or license presentation changes after acquisition. | high | Keep T2 pinned to the vendored T1 archives and their recorded hashes; require a new acquisition check before replacing either input. |
| 128px cells lose detail at gameplay zoom. | high | Require fixed-zoom five-weather screenshots; budget changes require a new product decision. |
| Tool/encoder drift breaks reproducibility. | high | Pin Blender and packer versions/hashes; compare two clean generations byte-for-byte. |
| Scene integration exceeds its line/lifetime budget. | medium | Extract actor presentation composition before adding animated wiring. |
| Generated T2 atlases are mistaken for animated runtime completion. | medium | Keep Phase 11 implementation-in-progress and runtime animation explicitly pending until T3-T5 pass. |
| Technical contracts are mistaken for product improvement. | high | Require current-fingerprint runtime evidence and default-route promotion before claiming visual product completion. |
| Character, object, and environment packs look unrelated. | high | Approve one fixed target frame before Phase 12 source lock and score final cohesion screenshots. |

## Reference Documents

- [Phase 11-13 Visual Productization Roadmap](../planning/phase11-13-visual-productization-roadmap.md)
- [Phase 11 Architecture](../planning/phase11-animated-character-poc-architecture.md)
- [Phase 11 WBS](../planning/phase11-wbs.md)
- [Phase 11 Tasks JSON](../planning/phase11-tasks.json)
- [Phase 10 Architecture](../planning/phase10-character-skin-architecture.md)
- [Phase 10 Research](../planning/phase10-2.5d-skin-research.md)
- [Execution Report](../../../../docs/handoffs/current-execution-report.md)
- [Implementation Handoff](../../../../docs/handoffs/current-handoff.json)
