# Arcade arena / service-style HUD delivery

## Scope and outcome

User-requested workspace slice, designed and implemented on 2026-09-07. Product-owner approval preceded implementation; existing Phase 12/13 work and root handoff state are not promoted or replaced by this slice.

- Default route now uses a beveled tile arena, inlaid paths, stage-specific colors, edge caps and highlighted obstacle housings. Existing animated actors, gameplay geometry and colliders are preserved.
- Score and round are grouped above the arena. The bottom dock groups numerical HP, segmented energy bar, weapon identity, magazine/reserve ammunition, reload/cooldown readiness and six selectable weapon slots.
- Damage, hit, healing, round score and equip notices expire and reset on redeployment/restart. Low HP and knockout have explicit labels. Energy means actual HP, not a newly invented sprint resource.
- Weapon buttons and keyboard share the guarded combat controller. Locked/dead/non-combat inputs cannot equip; settings and HUD pointer presses cannot shoot into the arena. Keyboard button activation retains focus; pointer selection returns focus to the arena.
- Settings and help are secondary surfaces; narrow layout and reduced-motion styling are included. Entry/settings become available only after the scene is active.

## Architecture and source ownership

The development-engineering and Hermes skills kept this change presentation-first, with a pure snapshot projection, a passive DOM view, existing combat contracts, and separate deterministic verification/review.

| Responsibility | Files |
| --- | --- |
| Layout, lifecycle and intent routing | `src/main.ts`, `src/ui/arcade-hud.css` |
| Snapshot-to-feedback projection and passive DOM view | `src/ui/arcade-hud-state.ts`, `src/ui/ArcadeHud.ts` |
| Cached floor and procedural obstacle artwork | `src/scenes/arcade-arena-art.ts`, `arena-textures.ts`, `stage-visual-controller.ts` |
| Guarded equip, canvas-only pointer fire, keyboard ownership | `src/scenes/MainScene.ts`, `combat-controller.ts`, `match-flow-controller.ts` |
| Verification | `tests/ArcadeHudState.test.ts`, `tests/e2e/arcade-hud.spec.ts`, deterministic fixture correction in `tests/e2e/map-objects-sprint2.spec.ts` |

`MainScene.ts` remains 845 lines under the 850-line boundary. Its pre-existing modification is retained. New floor image lifetime follows the scene; its cached texture follows the game. No per-frame texture generation, network asset acquisition, persistence, worker or new gameplay resource is introduced. `product-v1` world-object presentation stays opt-in; recovery and comparison routes remain available.

## Evidence

- [Before](arcade-hud-evidence/before.png), [default combat after](arcade-hud-evidence/foundry-clear.png).
- Entry/layout: [1440 px](arcade-hud-evidence/entry-1440.png), [960 px](arcade-hud-evidence/entry-960.png), [390 px](arcade-hud-evidence/entry-390.png).
- [Three stages × five weather states](arcade-hud-evidence/weather-contact-sheet.png); individual `{stage}-{weather}.png` captures are alongside it.
- [Hit](arcade-hud-evidence/hit.png), [score](arcade-hud-evidence/score.png).
- Existing actor atlas regression captures were redirected to `arcade-hud-evidence/actor-regression/`, preserving historical Phase 11 evidence.

## Verification ledger

Commands run from `workspace/2D-FPS-game` unless noted otherwise.

| Check | Result |
| --- | --- |
| `npm run type-check` | Pass |
| `npm run lint` | Pass on final source and test fixture |
| `npm run test` | 65 files, 402 tests passed; final run 16.68 seconds |
| `npm run build` | Pass; TypeScript + 1,803 modules, Vite build 22.07 seconds |
| Full Playwright run, 73 selected | 66 passed, 4 failed, 1 intentionally gated skip, 2 serial did-not-run; 18.0 minutes |
| Fresh-process rerun of product-default and weather-system files | All 6 passed at unchanged timeouts |
| Final deterministic map-objects-sprint2 rerun | All 3 passed, 17.1 seconds |
| Combined browser coverage | All 72 runnable scenarios have passing evidence across full run and focused reruns; not an uninterrupted green full-suite run |
| Independent read-only review | `Verdict: pass`; no unresolved blocking findings |
| Harness audit / manual drift | Both pass; drift run after reviewer pass |
| Workspace-scoped postflight | Pass: build present, linked screenshots present, MainScene budget preserved; no root handoff writes |
| Final scoped `git diff --check` | Pass |

Full browser command:

```powershell
$env:PHASE11_T4_ARTIFACT_DIR='docs/reports/arcade-hud-evidence/actor-regression'
node node_modules/@playwright/test/cli.js test --reporter=list --output=docs/reports/arcade-hud-evidence/full-test-results-final
```

Focused commands:

```powershell
node node_modules/@playwright/test/cli.js test tests/e2e/map-objects-sprint2.spec.ts tests/e2e/phase11-product-default-experience.spec.ts tests/e2e/weather-system.spec.ts --reporter=list --output=docs/reports/arcade-hud-evidence/focused-regression-final
node node_modules/@playwright/test/cli.js test tests/e2e/map-objects-sprint2.spec.ts --reporter=list --output=docs/reports/arcade-hud-evidence/map-object-regression-final
```

The new seven HUD scenarios passed in the full run: responsive geometry, real HP damage/recovery and expiration, held pointer and keyboard equip guards, actual fire/reload readiness, actual projectile scoring/restart/match confirmation, narrow settings access, and all 15 stage/weather combinations with browser-error capture. Existing actor animation, fallback, object-family and collider-parity scenarios also passed.

### Failures investigated, not hidden

1. Initial integration runs exposed early scene-handle publication, consumed numeric/Enter input, HUD pointer firing, and lifecycle feedback issues. Runtime fixes are covered by the new HUD scenarios.
2. Full-run bounce/teleport assertions were sensitive to live RAF advancing between separate manual evaluations. Sleeping RAF alone exposed deferred stage-transition bullet clearing and a non-advancing hit-stop clock. The final test fixture settles the transition before injection and advances `scene.time.now` together with manual delta. Assertions and gameplay logic are unchanged. Final three-test rerun passes. Intermediate failures remain in the evidence folders.
3. Product-entry and rain tests hit the 30-second overall timeout while waiting for scene readiness in the long full run; rain's serial group omitted fog/sandstorm. All six scenarios pass in a fresh process without runtime changes or increased timeout. This supports load-related flakiness, not a certified long-session performance result.
4. Historical Phase 12 visual-refresh capture is intentionally environment-gated; it was not enabled to overwrite historical assets. New visual evidence covers this slice.

## Limits and operational handoff

Final review/postflight recorded on 2026-09-08 KST. The verification transcript records a source-and-test SHA-256 over 13 scoped implementation/test files: `a956e85bb1ab5993d7c127c8c0353d3702367a56c22fb23ca516b7a0324e5768`. No source changed after final tests and review. The initial sandboxed manual-drift attempt could not spawn git (`EPERM`); the authorized read-only retry passed.

Reviewer findings: no unresolved blockers; canvas-origin firing guards, readiness, keyboard routing, weapon locks and redeployment feedback are handled. Visual evidence shows arena/HUD improvement. Required follow-up was manual drift and workspace-scoped postflight, both now recorded above.

- This is an arcade-style visual/HUD upgrade, not a claim of commercial Crazy Arcade asset parity. Existing actor sprites are not reauthored.
- The additional 960 × 540 RGBA floor is 2,073,600 bytes (about 1.98 MiB) before renderer overhead. Existing actor atlas budget checks are atlas-only; they do not certify total scene GPU memory. New full-scene GPU and p95 performance qualification were not performed.
- No commit, deployment, root handoff overwrite, or Phase 13 promotion was requested or performed. Existing dirty work is preserved.
- Hermes harness audit is available, but this session exposes neither a persisted `.codex/runtime/hermes` state nor its state-directory environment. Automatic `completed` hook state cannot be attested. Evidence and review are recorded honestly; hook events/state are not synthesized. Root `codex-postflight` is not used because it would overwrite the unrelated dirty root handoff report; a read-only workspace-scoped consistency check is used instead.
