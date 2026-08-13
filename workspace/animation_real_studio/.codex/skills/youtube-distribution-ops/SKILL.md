---
name: youtube-distribution-ops
description: Design or implement the safe YouTube OAuth, upload, caption, processing, publishing, deletion, and analytics lifecycle for Animation Real Studio. Use when connecting a YouTube channel, publishing a generated short, managing YouTube status, or reviewing API quota and compliance requirements.
---

# YouTube Distribution Ops

Read `../../../docs/05-platform-and-youtube-operations.md` before changing a YouTube integration.

1. Keep studio private delivery separate from external YouTube publication. Require a current policy pass and named owner approval before creating a publication job.
2. Use server-side OAuth for the channel owner. Never use a service account, store refresh tokens in plaintext, or expose OAuth secrets to the browser.
3. Persist a `youtube_publication` with an idempotency key before uploading. Use resumable upload, persist the YouTube video ID immediately, and poll processing before claiming success.
4. Upload timed captions only after processing succeeds; record caption state and errors. Apply metadata, thumbnail, playlists, privacy change, and scheduling as separate audited operations.
5. Default to private. Treat unlisted, public, scheduled, revocation, external deletion, and internal deletion as distinct state transitions.
6. Stop public automation when API audit, quota, consent, policy recheck, channel connection, or rights evidence is unresolved. Preserve a recoverable error and an operator action.

Follow the linked official Google documentation in the platform design for current API requirements; do not hard-code limits or provider behavior into application policy.
