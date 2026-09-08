# Cozy Arcade delivery — 2026-09-08 to 2026-09-09

Status: implemented and scoped for the user's explicit commit/push request.
Unconditional delivery remains blocked by the evidence-preservation incident and
the unavailable trusted-hook terminal gate described below.

## Scope and entry

The explicit user request and product-owner approval authorize this new named
experience. The follow-up PO decision preserves historical defaults while making
Cozy Arcade discoverable from the ordinary `/` entry. Open the selection panel,
choose a friend and playground, then launch; `?arcade=cozy` is the direct route.

- Original Soda Bunny and Honey Bear skins: BLUE/RED variants, five states,
  eight directions, independent external blaster, unchanged actor hitboxes.
- Garden Maze, Bubble Bay and Picnic Plaza: distinct geometry, shaded materials,
  water/boardwalk, ribbon gate, fountain, star charge and heart snack.
- Bubble/star/comet projectile art follows authoritative projectiles. Real
  collision and object damage/destruction drive bounded fragments. No damage,
  weapon statistics, legacy routes, or authoritative projectile bounds change.
- Keyboard-native picker selection is isolated from gameplay input. Scene
  shutdown synchronously clears authoritative shots and their presentation;
  restart recreates effects without retaining invisible projectiles.

The user's explicit parallel request authorized actor/stage implementation agents;
the main thread owned integration and verification. A read-only PO approved the
scope and a read-only reviewer challenged the diff. Architecture/implementation
skills kept selection and catalogs independent of Phaser and confined cosmetics
to scene-owned presentation.

## Verification

After the last runtime/test source edit, type/lint/unit/build all passed. Browser
evidence distinguishes the complete run from the subsequent test-only correction:

- `npm run type-check`: pass.
- `npm run lint`: pass.
- `npm test`: 69 files, 423 tests passed.
- `npm run build`: pass, 1,810 modules; final application chunk
  `dist/assets/index-CI5J6h1G.js` (328.40 kB, gzip 90.76 kB).
- Focused production-browser gate: 3/3 passed (2.1 min). UI/keyboard/persistence
  22.5s; three stages by five weather states 52.7s; real shots/destruction/three
  restarts 46.8s.
- Full production regression: 76 passed, 1 failed, 1 intentionally skipped
  (12.5 min), recorded in `cozy-arcade-regression-results.json`. The skipped case
  is the explicit Phase 12 evidence refresh, not gameplay coverage.
- The single failure was the existing Phase 4 test polling a transient boss reward
  message after a later AI intent could overwrite it. The test now captures the
  actual win and HUD in one browser task, retaining both exact reward-label and
  `airStrike` unlock assertions. No game behavior changed. Three repeated runs
  then passed (16.7s, 15.4s, 16.0s; 57s total). After the user's wrap-up/push
  instruction, the full suite was not rerun again; **do not call it a clean full
  regression pass**.
- MainScene: 847 lines, below the 850-line boundary.
- Harness audit: pass. Manual drift precheck: pass. Terminal review/gate status
  is reported separately below, not silently converted to completion.

Earlier browser attempts exposed and corrected a HUD mascot selector mismatch,
picker key capture, cover-label contrast, and synchronous projectile cleanup.
Some diagnostic runs were invalidated by Vite watching trace-generated HTML under
`docs/reports`; final traces are stored outside the Vite root under root `.cache`.
Cold loads and three restarts also exceeded the original combined 90-second test
budget. The new four-page-entry and triple-restart cases allow 180 seconds without
loosening their gameplay assertions. Tests are rerun against the production build.

## Visual evidence and limits

- Latest clean stages and headless observations:
  [stage-observations.json](cozy-arcade-evidence/stage-observations.json).
- Both actor sheets and in-game captures: `cozy-arcade-actor-evidence/`.
- Final production screenshots (15 stage/weather views plus destruction):
  `cozy-arcade-production-evidence/`.
- Stage art is original procedural canvas art, not copied commercial assets.
- Actor and stage captures verify integration/readability, not demographic
  preference or commercial art acceptance. The requested audience is a product
  design hypothesis requiring user playtesting.
- 120 rAF intervals per stage in the shared headless environment had medians
  83.3–116.8 ms and p95 116.6–150.1 ms. These are **not** 60fps qualification or
  a controlled legacy comparison. Hardware-browser performance remains unqualified.
- All-three-stage art cache upper bound: 6,593,248 raw RGBA bytes. Per-stage
  observed arcade/cozy-selected textures including bunny atlases and the existing
  base floor were approximately 17.5 MB. CPU canvas duplication and driver overhead
  are excluded. Cosmetic fragment limit is 96 per renderer, maximum 192 across the
  two scene-owned renderers; effects are evicted/expired deterministically.

## OpenViking installation

Installed with user authorization from the official project:

1. `uv tool install --python 3.12 --no-build openviking==0.4.19`
2. `codex plugin marketplace add volcengine/OpenViking --ref v0.4.19 --json`
3. `codex plugin add openviking-memory@openviking --json`

The Python environment is isolated at
`C:/Users/yuiy/AppData/Roaming/uv/tools/openviking`; entry points are under
`C:/Users/yuiy/.local/bin`. Import reports version 0.4.19; native server help loads;
`uv pip check` reports all 163 packages compatible. Codex lists
`openviking-memory@openviking` version 0.8.1 installed and enabled, preserving the
existing development-engineering and Hermes plugins.

Marketplace commit: `f3afef11637f2d7c11e4b1f36ed2f90630737cdc`.
Cached and pinned-source `hooks/hooks.json` SHA256 both match:
`fb24ee84b8052bf344fc7e8e0b085b8445ec6d069fbdd5e40ebf0b8e5bff28c5`.

The client points only to `http://127.0.0.1:1933`. No provider/key, paid API call,
project ingestion, or hook trust was assumed. The offline memory doctor reports
0 failures and a POSIX mode warning on Windows; actual ACL allows only the user,
Administrators and SYSTEM, and the file contains no credential. Its Codex PATH
probe is inconclusive on this Windows wrapper, so install status was checked
separately using the real Codex CLI.

Remaining activation: choose a model/provider, configure and start the local
server, then open a new Codex session and review/approve hooks with `/hooks`.
Automatic capture can include conversation/tool content after activation; no
capture or recall has been tested. The current session has no OpenViking MCP tools.
Installation does not connect the repository dashboard's contract-only adapter.

Official references: [Codex integration](https://docs.openviking.ai/en/agent-integrations/04-codex)
and [server setup](https://docs.openviking.ai/en/getting-started/04-setup-for-agent).

## Delivery gate and scope protection

The scoped read-only postflight hashes runtime/test sources, verifies the build is
newer, and checks MainScene's limit. It does not rewrite unrelated dirty root
handoff/status records. The root postflight script unconditionally writes those
records, so it is intentionally not used for this explicit workspace request.

Scoped source/config fingerprint (201 files, SHA256):
`4fd4540e5776c0815df3b8097aae949c4d3575fd9ad4b7c6cf47e5ddcc820907`.
The observed production build is newer than those files. This scoped checksum is
not a substitute for Hermes' full-workspace trusted-hook fingerprint.

### Existing screenshot overwrite disclosure

The first full regression attempt ran the preexisting HUD test's hardcoded
screenshot paths before that output hazard was discovered. Its 6 tracked images
(`entry-1440`, `entry-960`, `entry-390`, `foundry-clear`, `hit`, `score`) were clean
in the reviewer's initial complete status snapshot. Their regenerated copies were
backed up under root `.cache/cozy-regenerated-hud-backup`, then only those 6
original images were restored from HEAD; the explicit 6-file diff is empty.

The same test also regenerated 14 **preexisting untracked** weather images in
`docs/reports/arcade-hud-evidence`: `foundry-{fog,rain,sandstorm,storm}.png`,
`relay-yard-{clear,fog,rain,sandstorm,storm}.png`, and
`storm-drain-{clear,fog,rain,sandstorm,storm}.png`. Their earlier bytes are not in
Git. No exact recovery was found in a bounded search; do not claim these were preserved
or replace them with approximate images. Existing root coordination files and
Phase 11/12 evidence were not refreshed by this task.

To prevent further overwrites, the four HUD screenshot call sites now use
`test.info().outputPath`, preserving every assertion. The final full regression
also redirects `PHASE11_T4_ARTIFACT_DIR` to root `.cache/cozy-phase11-evidence`,
keeps `PHASE12_CAPTURE_EVIDENCE=0`, and stores all standard test output outside
the Vite root. The first full run was stopped after 12 passing tests for this
output-isolation correction; type/lint/423-unit/build gates were then rerun.

No current Hermes runtime `completed` record was found. The delivery-runbook
requires that trusted-hook state before an unconditional completion claim.
The installed [delivery-runbook skill](C:/Users/yuiy/.codex/plugins/cache/local-project-plugins/hermes-ssot/0.1.0+codex.20260809160349/skills/delivery-runbook/SKILL.md)
states: “Claim completion only after the hook state reaches `completed`.”
Do not fabricate a record or bypass `/hooks`; report the terminal gate as pending.
The user subsequently explicitly requested a scoped commit and push. Only this
task's source, tests, design, report and selected new captures are included; all
existing dirty coordination/Phase 11/12 files and the 14 regenerated untracked HUD
images are excluded. No deployment, paid model selection, or external message was made.
