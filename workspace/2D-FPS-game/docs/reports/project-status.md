# 2D-FPS-game Project Status Report

- Date: 2026-08-24
- Author: ultron
- **Phase:** Phase 12 T3 - Full-Inventory Cohesion and Performance Closeout
- Previous Phase: Phase 11 - Quaternius Animated Character POC (complete, 2026-08-20)
- Status: Phase 11 complete; Phase 12 T0-T2 complete, T3 pending

| Key | Value |
| --- | --- |
| Active milestone | Phase 12 T3 - Complete eleven-family cohesion/performance closeout |
| Product program | Phase 11-13 Visual Productization Vertical Slice |
| Development status | T0-T5 complete; T4 retains the absolute failure and passes the approved final one-shot display-cadence exception. |
| Verification | T2 deterministic/runtime/browser/reviewer/drift/postflight gates passed |

## Summary

Phase 10 remains complete as the recovery baseline. Following direct user feedback on 2026-08-20, `/` now requests the Quaternius BLUE/RED atlases through the Phaser-independent catalog/manifest boundary and extracted scene-lifetime composition. `?actorSkin=legacy-vehicle` remains the explicit comparison/recovery route, Kenney remains available, and any invalid animated input still falls back both actors to Ground Shaker.

The product-default pass also removes prototype/POC/license wording from the primary shell, adds one idempotent PLAY/Enter path, defers the tutorial until entry, places both preview actors inside the arena, and disables the noisy generated weather oscillator by leaving production weather sound channels empty. Short combat SFX and existing settings remain intact; no gameplay or persistence rule changed.

The product objective is now explicit: the default `/` route must become a coherent, saleable-looking visual vertical slice. Phase 11 delivers animated characters, Phase 12 replaces the 11 player-visible object families with authored skins, and Phase 13 integrates state animation and promotes the complete visual pack to the default. Planning progress is not counted as a visual improvement.

## Visual Productization Roadmap

| Phase | User-visible outcome | Current state |
| --- | --- | --- |
| Phase 11 | Default BLUE/RED animated characters with five states and eight directions | complete 2026-08-20; absolute fail retained, cadence exception passed |
| Phase 12 | Authored skins for six map objects, three arena-prop families, gate, hazard, and two pickups | v5 approved; all eleven families integrated and T2 complete at opt-in `product-v1`; T3 pending |
| Phase 13 | Object/interactions animation, integrated visual polish, and default-route promotion | locked behind Phase 12 runtime/reviewer pass |

The detailed product goal, object inventory, architecture boundaries, budgets, and promotion gate are in `../planning/phase11-13-visual-productization-roadmap.md`.

## Completed Contract Work

- Re-verified the official Quaternius source pages as CC0 on 2026-08-13 and approved their free-core downloads for a later vendoring slice, subject to acquisition-time re-verification and SHA-256 recording.
- Locked one BLUE and one RED character, one external carbine presentation, idle/run/fire/hit/death, eight directions, and 176 frames/team.
- Locked one 2048x2048, 128px-cell WebP atlas per team: at most two atlases, 8 MiB combined transfer, and 32 MiB raw RGBA GPU memory.
- Locked p95 frame time at or below 16.7 ms and regression at or below 1.0 ms in the same fixed 960x540 scenario.
- Defined pinned Blender 4.5.12, offline one-command generation, stable frame keys/order, validated staging plus atomic promotion, source/generator/output hashes, and byte-identical clean regeneration.
- Implemented that contract with exact Blender/archive/executable and Sharp locks, frozen 68-bone/five-action mapping, typed JSONL state transitions, transactional promotion/rollback, and decoded-pixel reproducibility checks.
- Extracted actor presentation composition before runtime integration and kept `MainScene.ts` at 850/850 lines.

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

## Phase 11 T3 Animated Runtime Integration - 2026-08-19

- Added the explicit `?actorSkin=quaternius-animated` route while leaving `/` on Ground Shaker and preserving `?actorSkin=kenney-infantry`.
- Extended `ActorSkinCatalog` with the exact five-state/eight-direction clip matrix, stable BLUE/RED frame keys, atlas descriptors, movement-versus-aim direction policy, and fail-closed manifest/availability validation without Phaser imports.
- Extracted opt-in preload, body/external-weapon construction, controller wiring, animation registration, resolved-skin UI metadata, and idempotent shutdown into `ActorPresentationComposition`; one-shot scene shutdown plus explicit stage-object release preserve restart safety, and `MainScene.ts` is 850/850 lines.
- Animated bodies use movement direction for idle/run/hit/death, aim direction for fire, and no second body rotation; the external carbine remains independently aim-driven.
- Focused catalog/composition tests passed 20/20, generator contracts passed 13/13, type-check and lint passed, full Vitest passed 59 files/358 tests, production build passed, the four-scenario Quaternius browser contract and Phase 10 three-scenario regression passed, and the full Playwright suite passed 41/41 after correcting shutdown ordering.
- T4 performance, full five-weather readability, complete browser console matrix, and measured p95 comparison remain intentionally pending.

## Phase 11 T4 Product-Default Amendment and Verification - 2026-08-20

- Direct user feedback identified two product blockers: the default still looked like the legacy game and generated continuous weather audio sounded like loud noise. Product-owner review approved an actor-only default promotion and default weather-loop shutdown without widening into Phase 12 object art.
- `/` now requests Quaternius; explicit legacy, Kenney, animated, and unknown fail-safe routes are deterministic. The default shell uses Arena Strike branding, Vanguard team badges, one PLAY/Enter CTA, deferred tutorial presentation, and visible BLUE/RED spawn previews.
- Production `weather.soundChannels` is empty, so clear/rain/fog/sandstorm/storm start no generated oscillator and keep `activeWeatherLoopCue` null. One-shot combat SFX and master/SFX settings are unchanged.
- Current acceptance passed 15/15 with all 80 clips, seven total-fallback cases, exact transfer/GPU/mipmap contracts, 30 unique 960x540 weather/state/team captures, and zero console/page/request/unhandled errors. Focused production preview passed 12/12; full Vitest passed 60 files/361 tests; type-check, lint, LOC 850/850, and production build passed.
- Stable Chrome hardware D3D11 preserves the original absolute result: legacy and animated p95 are 16.9 ms against the unchanged 16.7 ms limit, so `absolutePassed` remains false. Product-owner decision introduced a separate schema 1.1.0 cadence exception instead of rewriting that result.
- The fixed schema 1.1.0 evaluator passes 7/7 contracts and rejects missing or forged AB/BA/AB routes, sequence numbers, pair order, and pair values. The preserved sibling rerun passes only as auxiliary evidence, and the later 1789-sample/17.0 ms/missed-refresh failure remains preserved.
- Offline distribution showed no actor-specific regression evidence and was consistent with a route-independent transient scheduling disturbance without claiming a proven host cause. Product-owner review approved one final, pre-declared acceptance run with unchanged runtime/evaluator inputs and no concurrent work.
- That official one-shot collection passed: 1800/1800/1800/1800/1800/1801 samples, every p95 16.9 ms, max 18.2 ms, zero frames above 25 ms, zero runtime errors, and three 0.0 ms deltas. It records `absolutePassed=false`, `cadenceQualified=true`, and `qualification=display-cadence-exception`, closing T4 without rewriting the absolute result.
- Evidence is stored under `docs/reports/phase11-t4-evidence/`, including the product screenshot, 30-image readability matrix, budget JSON, every performance report, the official one-shot raw report, and its frozen-input decision record.

## Phase 11 T5 Final Verification - 2026-08-20

- Current cadence evaluator contracts passed 7/7, `MainScene.ts` remains 850/850, type-check and lint passed, full Vitest passed 60 files/361 tests, and a fresh production build transformed 1795 modules successfully.
- The first full Playwright run passed 57/59 and exposed two test-contract defects rather than product regressions: the Phase 4 smoke still expected the tutorial before PLAY, and the bazooka test read destruction before its delayed explosion callback. The tests now assert deferred tutorial entry and poll the unchanged destroyed-state contract.
- Focused correction verification passed 4/4. The current-fingerprint one-worker rerun passed all 59/59 browser scenarios in 5.9 minutes, including gameplay, map objects, animated/default/fallback skins, weather audio, stage/weather systems, and shutdown/restart paths.
- Current T5 gates pass LOC 850/850, type-check, lint, 60 files/361 unit tests, the 1,795-module production build, 7/7 evaluator contracts, 59/59 browser scenarios, Codex preflight, harness audit, and diff check. Independent review reported no finding; manual drift and Codex postflight pass on the synchronized completion fingerprint.

## Phase 12 T1 Six-Family Runtime Slice - 2026-08-21

- The user explicitly approved v5, and the product owner approved the exact six-family opt-in architecture before implementation.
- Twelve generated alpha sources are pinned to the approved target-frame hash and deterministically packed into one 1024x1024 lossless WebP. Strict transfer is 295024 bytes, raw RGBA is 4194304 bytes, and mipmaps are disabled.
- `WorldObjectSkinCatalog` validates the full manifest/frame/texture/dimension/hash/budget contract and exact ordered target/generator/source provenance. `WorldObjectPresentationComposition` owns all overlays and lifecycle while existing map-object anchors, bounds, states, combat, AI, projectiles, balance, and persistence remain unchanged.
- Only `?worldSkin=product-v1` loads the atlas. `/`, explicit legacy, and unknown routes retain legacy world art; any invalid input falls all six families back atomically.
- Focused unit passed 24/24, the atlas contracts passed 6/6, full Vitest passed 62 files/385 tests, type-check/lint/LOC 842/850/build passed, the explicit visual matrix passed 1/1 with fifteen 960x540 captures, and the final full Playwright run passed 64 scenarios with one intentional evidence-refresh skip.
- The final production AB-BA-AB measurement passed with product p95 0.1ms and -0.3ms to -0.5ms relative regression. Evidence is in `phase12-t1-evidence/`.
- Current-fingerprint independent review found no blocking or material issue; Codex preflight, Hermes audit, harness contracts 17/17, diff check, manual drift, and Codex postflight passed.
- Phase 12 is not complete: arena obstacles, service gate, hazard/vent surfaces, ammo pickup, and health pickup remain T2, and world-art default promotion remains locked.

## Phase 12 T2 Eleven-Family Runtime Slice - 2026-08-24

- Added the five remaining families through eight authored source images: arena-obstacle core/tower/barrier, service-gate closed/open, active vent hazard, available ammo pickup, and available health pickup.
- Expanded the deterministic release to 11 families / 20 frames in one 2048x1024 atlas. World-object transfer is 508,220 bytes, raw RGBA is 8,388,608 bytes, and mipmaps are disabled. Combined actors plus world art use 1,297,048 transfer bytes and 41,943,040 raw RGBA bytes, within the approved 12 MiB / 64 MiB T2 limits.
- Reused one shared scene-lifetime presentation port across `MapObjectController` and `StageGeometryManager`; existing gameplay, collision, positions, gate/pickup behavior, respawn, AI, audio, and input remain in their original owners.
- Product obstacle variants, gate state, hazard placement, and pickup availability/visibility now synchronize through the atlas. `/`, explicit legacy, unknown, corrupt, and incomplete inputs still retain total legacy fallback, and `product-v1` remains opt-in.
- Atlas contracts pass 6/6, focused tests pass 27/27, full Vitest passes 63 files / 388 tests, type-check/lint/build pass, and `MainScene.ts` is 837/850.
- Focused browser contracts pass 5/5 including gate redeploy closure. The current post-review-fix full run passed all 64 runnable scenarios with the explicit evidence refresh skipped. Two earlier pre-fix runs each had one different pre-existing transient, and each exact case passed alone. The explicit evidence refresh passed 1/1 and produced fifteen 960x540 captures with all 11 families and zero runtime errors.
- Current evidence is in `phase12-t2-evidence/`. Independent re-review found no blocking/material issue; harness 17/17, manual drift, diff check, and Codex postflight passed. T2 is complete; T3 retains complete inventory cohesion/performance closeout.

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
- T3 added only the catalog/manifest policy, scene-lifetime actor presentation composition, opt-in atlas playback, focused tests, and resolved-skin UI metadata.
- The 2026-08-20 product amendment changes browser default selection, product-shell copy/entry presentation, initial preview position, and production weather-audio activation only. It does not change collision, combat, balance, weather mechanics, progression, persistence, input semantics, stage content, generated assets, or atlas bytes.
- Phase 12 T2 authorizes only the eleven object families recorded above. Paid assets, live 3D, normal maps, `Light2D`, expanded weapon art, cosmetics, persistence, Phase 13 animation, and complete visual-pack promotion remain unauthorized here.
- Preserved unrelated dirty workspace changes.

## Blocking Issues

No Phase 11 or Phase 12 T2 blocker remains. The Phase 11 absolute 16.7 ms result and prior failed cadence collections remain recorded rather than hidden or reclassified. Phase 12 overall remains open for T3 cohesion/performance closeout.

## Immediate Next Tasks

| Priority | ID | Task | Owner | Estimate |
| --- | --- | --- | --- | --- |
| 1 | Phase 12 T3 | Run complete 11-family cohesion, fallback, lifecycle, budget, browser, and performance closeout. | product_owner + ultron + reviewer | phase closeout |

Phase 11 and Phase 12 T2 are complete. The eleven-family world pack remains opt-in, so this is not Phase 12 completion or default promotion. T3 is the next product slice.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Upstream free-core contents or license presentation changes after acquisition. | high | Keep T2 pinned to the vendored T1 archives and their recorded hashes; require a new acquisition check before replacing either input. |
| 128px cells lose detail at gameplay zoom. | high | Require fixed-zoom five-weather screenshots; budget changes require a new product decision. |
| Tool/encoder drift breaks reproducibility. | high | Pin Blender and packer versions/hashes; compare two clean generations byte-for-byte. |
| Scene integration exceeds its line/lifetime budget. | medium | Keep actor preload/construction/teardown in the extracted composition and enforce the 850-line check. |
| T3 integration is mistaken for final animated delivery. | medium | Keep Phase 11 implementation-in-progress until T4 performance/readability/browser evidence and T5 final gates pass. |
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
