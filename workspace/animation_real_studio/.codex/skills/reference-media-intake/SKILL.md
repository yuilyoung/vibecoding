---
name: reference-media-intake
description: Safely assess and prepare a user-supplied image or short video reference for Animation Real Studio. Use when designing or implementing reference-media upload, quarantine, metadata stripping, policy decisions, retention, deletion, or provider handoff.
---

# Reference media intake

Treat every uploaded asset as untrusted until its scan and policy decision pass. Accept at most one permitted visual reference for an explicitly selected purpose: setting, lighting/color, camera composition, or movement rhythm.

1. Require a rights and non-personal-data attestation before creating an upload intent.
2. Upload to a project-scoped quarantine location through a short-lived signed URL. Do not expose a public URL or forward the original to a provider.
3. Validate MIME, size, duration, and malware; remove EXIF GPS/device metadata and audio; make inspection frames only in quarantine.
4. Run policy checks for faces or children, personal data, ID/plate text, third-party footage, anime stills, logos, and unsafe content. Record an outcome and reason codes; send ambiguous assets to review.
5. Forward only a policy-approved sanitized derivative, with an explicit asset-use record, to a provider that contractually supports the input and deletion terms.
6. Enforce separate original, sanitized, and delivery storage; scheduled deletion; owner-only access; and immutable minimal audit events.

Never promise identity or character reproduction. Block or review reference assets containing real persons, children, third-party copyrighted footage, original clips, or audio for P0. Read `docs/07-reference-media-input-design.md` before changing the workflow or its policy fixtures.
