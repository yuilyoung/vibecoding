# Session handoff — 2026-07-31

## Delivered this session

- Added project-local Codex execution settings in `.codex/config.toml` (`approval_policy = "never"`, workspace-write). Platform-managed sandbox rules still take precedence.
- Added a Vite-proxied local Studio API and browser client contract.
- Implemented the local-only request flow: request → `local_preflight_ready` → mock queue → mock completion.
- Added narrow deterministic text prechecks for obvious protected-work, copied-scene, and real-person requests.
- Kept reference input as uninspected metadata only. No media bytes, provider credentials, external generation call, MP4, or delivery asset is created.
- Added provider boundary ADR and clarified that the local precheck is **not** a rights, likeness, privacy, or media-safety approval.
- Added deterministic service and HTTP boundary tests.

## Verification

- `npm run test:api` — 7 passing tests.
- `npm run build` — passed.
- `npx designmd lint DESIGN.md` — 0 errors, 0 warnings.
- Independent reviewer: pass, with the retained caveat that this is deliberately a local simulation.

## Remote history

- Studio implementation commit: `6530002 feat(animation-real-studio): add local generation workflow`
- Pushed integration commit: `94a2dfe Merge remote-tracking branch 'origin/feature/phase8-audio-loop-ci' into codex/animation-real-studio-push-sync`

The primary local checkout intentionally remains behind the remote integration commit because it has unrelated, uncommitted root and `2D-FPS` changes. Do not force-reset it. Synchronize only after those changes have been reviewed or isolated.

## Next release gate

Actual video generation remains blocked until all of the following are available:

1. Dedicated video-provider account/key, secret handling, cost cap, and kill switch.
2. Confirmed commercial, data-use, retention/deletion, and region terms.
3. Server-side quarantine upload, scan, sanitization, and deletion flow for reference media.
4. Owned storage, private delivery, provider webhook verification, trim/QC, captions, thumbnail, and manifest.

See [provider and rendering ADR](08-provider-and-rendering-adr.md) for the decision record.
## Shutdown note

The Studio Vite server on port `5173` was stopped at session close. Persistent local API availability is not a handoff guarantee: start `npm run dev:api` only after confirming that port `4174` is free. The automated service and HTTP-boundary tests above are the canonical verification record.