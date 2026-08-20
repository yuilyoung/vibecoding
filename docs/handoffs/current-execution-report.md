# Execution Report - phase-12-product-v1-authored-object-kit

- **Handoff ID:** phase-12-product-v1-authored-object-kit
- **From:** vision / product_owner
- **To:** ultron
- **Date:** 2026-08-21
- **Status:** in progress; T0-T1 complete, T2 pending

## Summary

Phase 11 remains complete. The user approved Phase 12 target frame v5 on 2026-08-21, and the first six-family runtime slice is implemented and deterministically verified at `?worldSkin=product-v1`. Default world art remains legacy; arena obstacles, service gate, hazard/vent surfaces, and two pickups remain T2. Phase 12 overall and default promotion are not complete.

## Phase 12 T1 deliverables and verification - 2026-08-21

- Generated and pinned twelve alpha sources for barrel, mine, crate, cover, bounce-wall, and teleporter states from the approved v5 language.
- Added a two-build byte-reproducible Sharp 0.35.3 atlas pipeline with source/target/output hashes, schema validation, staging, atomic promotion, and rollback.
- Emitted one 1024x1024 lossless WebP plus Phaser JSON and manifest: 295024 strict transfer bytes, 4194304 raw RGBA bytes, and mipmaps disabled.
- Added a Phaser-independent catalog and one scene-lifetime presentation composition. Existing domain state, anchors, positions, collision bounds, damage, interactions, AI, projectiles, persistence, and audio remain unchanged.
- `/`, explicit legacy, and unknown routes keep legacy objects. `?worldSkin=product-v1` activates only after complete validation; every invalid case falls all six families back together.
- Focused tests pass 24/24 including exact target/generator/source provenance mutations, atlas contracts pass 6/6, full Vitest passes 62 files/385 tests, type-check/lint/LOC 842/850/build pass, and the final full Playwright run passes 64 scenarios with one intentionally gated visual-evidence refresh skipped.
- The explicit evidence refresh passes 1/1 and records fifteen 960x540 unobstructed combat captures across three stages and five weather states, all six families, exact domain/overlay counts, pixel checks, and zero runtime errors.
- Final hardware Chrome production AB-BA-AB samples pass: product p95 is 0.1ms in all three captures and relative regression is -0.3ms to -0.5ms against the 0.5ms limit.
- Earlier full runs exposed test scheduling gaps, not runtime regressions. The product state case passed 5/5 after freezing its future-time sample, wind passed 15/15 after flushing pending clear before injection, the barrel file passed 9/9 after fixed-weather polling, and the final entire suite passed.
- Current-fingerprint independent review found no blocking or material issue. Codex preflight, Hermes audit, harness contracts 17/17, diff check, manual drift, and Codex postflight pass for the T1 slice.

## Deliverables

- Product-owner-approved Phase 11 architecture, WBS, task JSON, boundaries, exclusions, and verification contract.
- Fixed matrix of five states, eight directions, 176 frames/team, 128px cells, and one 2048px WebP atlas per team.
- Explicit 8 MiB combined transfer, 32 MiB GPU, 16.7 ms p95, and +1.0 ms regression budgets.
- Pinned Blender 4.5.12 offline generation contract with stable keys/order, validated staging, atomic promotion, provenance hashes, and byte-identical regeneration.
- Total Ground Shaker fallback and a required actor-composition extraction before runtime work.
- Exact free Standard archives with local official-page, archive-license, canonical CC0 evidence, and deterministic per-entry inventories.
- Implemented and independently reviewed the complete offline adapter, tool locks, focused contracts, transactional promotion/rollback, and generated atlas release.
- Added exact manifest/atlas validation, 80 team/state/direction clips, movement-driven body direction, aim-driven fire/external-carbine direction, and zero second rotation for directional atlas bodies.
- Extracted opt-in preload, actor/weapon construction, controller wiring, resolved-skin UI metadata, idempotent shutdown, and explicit stage-object release while keeping `MainScene.ts` at 850/850 lines.
- Promoted the validated animated actor to `/`, retained explicit Ground Shaker and Kenney recovery/comparison routes, and preserved total atomic fallback.
- Removed prototype/POC/license copy from the primary shell, added Vanguard team identity and one idempotent PLAY/Enter CTA, deferred the tutorial until entry, and placed both preview actors inside the arena.
- Disabled the noisy generated weather oscillator through an empty production weather sound-channel contract while preserving short combat SFX and existing volume settings.

### Phase 11 T4 Product-Default Verification - 2026-08-20

| Gate | Result | Evidence |
| --- | --- | --- |
| product-default routes | pass | `/` animated; explicit legacy/Kenney/animated and unknown fail-safe deterministic; invalid atlas input falls back both actors |
| product entry/audio | pass | branded PLAY and first Enter share one idempotent transition; tutorial is deferred; five weather states enqueue no loop and keep active cue null |
| animation/readability/budgets | pass | 15/15 acceptance, all 80 clips, seven fallback cases, 30 unique 960x540 captures, 788828-byte atlas payload, 32 MiB GPU, mipmaps off, zero runtime errors |
| static/unit/build/browser | pass | type-check, lint, 60 files/361 Vitest, LOC 850/850, production build, 12/12 focused production-preview scenarios |
| relative performance | pass | three AB/BA/AB deltas are 0.0 ms against the +1.0 ms limit |
| absolute performance | **fail retained** | every animated capture is 16.9 ms p95 against the unchanged 16.7 ms limit; `absolutePassed=false` |
| display-cadence exception | pass | fixed evaluator contracts pass 7/7; the declared final one-shot run has at least 1800 samples/capture, every p95 16.9 ms, max 18.2 ms, zero frames over 25 ms, D3D11, zero runtime errors, and `cadenceQualified=true`; all prior reports remain preserved |

### Phase 11 T5 Final Verification - 2026-08-20

| Gate | Result | Evidence |
| --- | --- | --- |
| cadence evaluator contracts | pass | 7/7 absolute/cadence/route-order/pair-integrity/missed-refresh/renderer/regression/common-failure Node tests |
| static and scene budget | pass | current type-check, lint, diff check, and `MainScene.ts` 850/850 |
| full unit | pass | 60 Vitest files / 361 tests |
| production build | pass | 1795 modules transformed; production bundle emitted successfully |
| full browser | pass | current-fingerprint one-worker run passed 59/59 in 5.9 minutes after the earlier focused test-contract corrections |
| independent review | pass | current official one-shot, fixed evaluator, status, v5 concept evidence, and runtime lock reviewed with no finding |
| drift / postflight | pass | manual drift and Codex postflight pass on the synchronized completion fingerprint |

These current-fingerprint deterministic results close T5 after the final one-shot collection closed T4 through the explicit cadence exception. Codex preflight, harness audit, diff check, independent review, manual drift, and postflight also pass.

## Verification

### Phase 11 T3 Animated Runtime Integration Verification - 2026-08-19

| Gate | Result | Evidence |
| --- | --- | --- |
| product-owner gate | pass | T3/A5-A6 composition, catalog, total fallback, playback, lifecycle, exclusions, and deterministic verification were approved before editing |
| catalog/manifest contract | pass | exact 352-frame order, BLUE/RED paths, five clip rates/repeat rules, eight directions, 2048px dimensions, and transfer/GPU claims validate without Phaser imports |
| total fallback | pass | missing/malformed/over-budget manifest, missing team/frame/texture, or wrong dimensions resolve the complete presentation to Ground Shaker before actor creation |
| presentation/lifecycle | pass | 80 animations registered once; movement drives body direction, one-shot aim direction is latched, external weapon aim remains independent, directional body rotation is zero, and one-shot shutdown plus stage-object release are restart-safe |
| focused/static/full | pass | 20/20 catalog/composition tests, 13/13 generator contracts, type-check, lint, 59 files/358 Vitest tests, production build, LOC 850/850, and diff check passed |
| focused browser smoke | pass | Phase 11 valid activation/team swap, five-state frame advance, real incomplete-atlas fallback, and restart passed 4/4; Phase 10 default/Kenney/shutdown-restart regression passed 3/3 |
| full browser regression | pass | all 41 Playwright scenarios passed with one worker, including the shared MainScene, HUD, gameplay, map-object, weather, and weapon suites |

T3 does not prove the T4 fixed-scene p95 limits, full five-weather readability, complete animation/fallback browser matrix, or full console suite.

### Phase 11 T2 Deterministic Atlas Build Verification - 2026-08-17

| Gate | Result | Evidence |
| --- | --- | --- |
| product-owner gate | pass | T2/A3-A4 scope, exact inputs/tooling, fail-closed behavior, verification, and T3/T4 exclusions approved before implementation |
| toolchain lock | pass | Blender 4.5.12 LTS Windows x64 build `84afd5f785f7`; archive SHA-256 `103b9f7d0b41cbb5fd89ad1c5c4aafbbeb5bfd71297667910446d0141ce3b43a`; executable SHA-256 `7fbcc9f2b4a99ad19c1f9deb15c3e6786e62c7ccb624f66009b41b8203c0eba9`; Sharp 0.35.3 integrity matched |
| exact input/rig mapping | pass | both T1 archive sizes/hashes, 68 target/source bone names, five action names/slots/ranges, base/render object inventory, and source entry paths matched |
| real clean regeneration | pass | two isolated 352-frame Blender builds matched all five final files byte-for-byte and both decoded atlas pixel hashes before promotion |
| atlas/schema/budgets | pass | 176 stable keys/team; two 2048x2048 lossless WebPs + Phaser JSON; `788828` transfer bytes; `33554432` GPU bytes; mipmaps false; zero dirty transparent pixels |
| focused contracts | pass | 13 / 13 schema/order/hash/version/action/staging/budget/rollback/status tests |
| static/full verification | pass | type-check, lint, 58 Vitest files / 344 tests, production build, scoped diff check, JSON/dimension/hash validation, and BLUE/RED visual inspection |
| independent review | pass | no blocking or material non-blocking finding; scope and T3/T4 exclusions confirmed |

Final artifact hashes are BLUE JSON `4e76926875e40593edbf2da2359af6abcb9f40033202976aa1e81cf6ecc3afef`, BLUE WebP `fa0f63ab9c32b30c7250bc73f7e178bfd158e7b471bc11ff440fb7785e7f0be9`, RED JSON `ea3ad0d862404097a21eae4e87a22f3c59bebc6fb49ebe6af95d6fe734fb9334`, RED WebP `7cda584fdadf2ef96285907486e65e0a37e81131950788287025866f7b26670f`, and manifest `2669d9fd0576af1d03b136898a252e0d5c8e70504b706907f24b1de6490a5249`.

T2 does not prove T3 runtime integration or T4 browser, performance, five-weather readability, console, or final Phase 11 acceptance.

### Phase 11 T1 Source Acquisition Verification - 2026-08-17

| Gate | Result | Evidence |
| --- | --- | --- |
| product-owner gate | pass | T1/A2 limited to exact source acquisition and provenance; T2-T5 excluded |
| acquisition-time official source check | pass | both official pages displayed CC0, free-tier, and commercial-use terms |
| Base Characters archive | pass | `128968391` bytes; SHA-256 `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40`; 112 entries; inventory SHA-256 `38fd855a356379b2dd0bd32c389c997e8fc6a8d9e16ce1a89bcc80833ac192f9` |
| Animation Library archive | pass | `15904933` bytes; SHA-256 `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724`; 9 entries; inventory SHA-256 `237b76b03ee017fce45b34fafca61f68466d6061a276c9f8b4cff91b5b9cb98a` |
| local license evidence | pass | official-page snapshots, byte-exact archive licenses, and canonical CC0 legal code are stored and hashed |
| Git LFS | pass | both ZIPs resolve to directory-scoped LFS attributes; pointer OIDs and sizes match the actual archives |
| deterministic provenance verifier | pass | archive bytes/hashes/counts, streamed per-entry inventories, evidence hashes, manifest fields, and absence of partial files all matched |
| independent review | pass | no blocking or material issue; no required follow-up |
| drift / postflight | pass | current T1 asset fingerprint passed manual drift and Codex postflight before status synchronization |

No runtime test was required for T1 because only source archives, license/provenance evidence, and source documentation changed. These results do not prove Blender generation, atlas budgets, animation, browser behavior, or full Phase 11 completion.

### Historical Phase 11 Contract Verification - 2026-08-13

The results in this table are bound to the original Phase 11 contract fingerprint. They establish the pre-addendum planning baseline only; they do not validate the 2026-08-14 Visual Productization addendum, whose current-fingerprint reviewer, drift, and postflight gates must run after its latest edit.

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm run workspace-status` | pass | active runtime and roadmap baselines identified |
| `npm run project-status` | pass | Phase 11 contract gate passed; Phase 10 remains the executable runtime baseline; T1-T5 are pending |
| `npm run next-tasks` | pass | Phase 11 T1 source/provenance acquisition is the next implementation task |
| Hermes harness audit | pass | zero errors before planning |
| Codex preflight | pass | handoff and active baseline present |
| product-owner gate | pass | five required sections, actionable scope, and `Decision: approved` |
| official source re-check | pass | Quaternius character and animation official pages displayed CC0/commercial permission on 2026-08-13 |
| local constraints | pass | runtime assets 31 / 196,353 bytes; MainScene.ts 848/850; Blender not present on PATH and deferred |
| planning/status consistency | pass | Phase 11 JSON, project status, next tasks, and implementation handoff agree |
| scalable workspace fingerprint | pass | 17 / 17 harness tests; >8 MiB legacy-diff fixture; the original Phase 11 contract fingerprint was stable |
| independent review | pass | no blocking defect was found on the original Phase 11 contract fingerprint |
| drift / postflight | pass | the original Phase 11 contract fingerprint passed drift and postflight |

No runtime test was rerun for this documentation-only decision because no game code or asset changed. The Phase 10 58-file/344-test unit, build, and 37-scenario browser results remain historical executable-baseline evidence only.

## Scope Audit

- T1 added the two exact Quaternius free Standard source archives, deterministic entry inventories, local license/provenance evidence, and directory-scoped Git LFS rules.
- T2 added only the pinned offline build adapter/locks/tests, exact Sharp dependency, and generated actor atlas release.
- T3 added only the runtime catalog/manifest policy, actor presentation composition, animated opt-in playback, focused tests, and resolved-skin UI metadata.
- The product amendment changes only browser default selection, primary-shell presentation, initial actor preview positions, and weather-loop activation config. No collision, combat, balance, weather mechanics, progression, persistence, input semantics, stage content, generated atlas byte, or asset pipeline changed.
- Phase 12 T1 authorizes only its six recorded object families. No paid asset, live 3D, normal map, `Light2D`, expanded weapon art, cosmetic system, persistence, five-family T2 implementation, or complete-pack default switch was authorized by this slice.
- Ground Shaker remains the explicit/total fallback and Phase 10 remains complete.
- Unrelated dirty workspace files were preserved.

## 2026-08-14 Product Direction Addendum

The user clarified that the next product work is character skins, object skins, and animation because the current default runtime does not yet communicate commercial product quality. Product-owner review approved an ordered Phase 11-13 Visual Productization roadmap:

- Phase 11 remains the current character-only animated implementation handoff.
- Phase 12 applies authored skins to all 11 player-visible object families after Phase 11 runtime/reviewer acceptance.
- Phase 13 integrates state animation and combat feedback, then promotes the complete visual pack to `/` while retaining an explicit total legacy fallback.
- Documentation-only gates are planning progress, not user-visible improvements.

This addendum changes no game code, asset, Phase 11 T1-T5 dependency, or current executable baseline. The detailed target, inventory, architecture boundaries, measurable quality gates, and default-promotion rule are recorded in `workspace/2D-FPS-game/docs/planning/phase11-13-visual-productization-roadmap.md`.

## Next Direction

Begin Phase 12 T2 for arena obstacles, service gate, hazard/vent surfaces, ammo pickup, and health pickup. Reuse the approved v5 contract and keep product world art opt-in. Do not promote the complete world pack to `/` or begin Phase 13 state animation before Phase 12 full-inventory acceptance.

The repository harness no longer buffers a full binary diff for evidence freshness. It fingerprints HEAD, NUL-safe status, and current changed-file snapshots, allowing the existing large workspace migration to remain intact while retaining fail-closed review evidence.

## References

- `workspace/2D-FPS-game/docs/planning/phase11-13-visual-productization-roadmap.md`
- `workspace/2D-FPS-game/docs/planning/phase11-animated-character-poc-architecture.md`
- `workspace/2D-FPS-game/docs/planning/phase11-display-cadence-qualification-architecture.md`
- `workspace/2D-FPS-game/docs/planning/phase12-map-object-vertical-slice-architecture.md`
- `workspace/2D-FPS-game/docs/planning/phase11-wbs.md`
- `workspace/2D-FPS-game/docs/planning/phase11-tasks.json`
- `workspace/2D-FPS-game/docs/reports/project-status.md`
- `docs/handoffs/current-handoff.json`
