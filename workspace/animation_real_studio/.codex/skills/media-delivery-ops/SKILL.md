---
name: media-delivery-ops
description: Design and operate the safe generation-job, media quality-control, private library, sharing, retention, and audit lifecycle for Animation Real Studio. Use when implementing provider adapters, queues, delivery manifests, signed media access, deletion, or operational recovery.
---

# Media Delivery Ops

Read `../../../docs/03-service-design.md` before changing jobs, assets, or state transitions.

1. Accept only an approved, immutable storyboard version and create the provider job with an idempotency key.
2. Persist provider references separately from user-facing state. Verify webhook signatures; make polling and duplicate events idempotent.
3. Run format, duration, dimension, checksum, malware, and post-generation policy checks before delivery.
4. Store video, captions, thumbnail, and a delivery manifest as one versioned bundle. Use private object storage and short-lived signed URLs.
5. Keep `private` as the default visibility. Create a share link only after explicit opt-in; support expiry and immediate revocation.
6. Record state changes, delivery actions, deletion requests, and operational overrides as audit events. Surface a recoverable user state for provider failures.

Do not expose provider credentials, permanently public object URLs, or failed moderation output.
