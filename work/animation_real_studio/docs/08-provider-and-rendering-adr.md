# ADR-008: local 2D preview and deferred video-provider boundary

Status: accepted local MVP slice; video-provider selection deferred.

## Decision

The current MVP ends at a local 2D still-preview gallery. The browser speaks only to the Studio API. For an original request that passes the narrow local text precheck, the API returns four deterministic fixed-template SVG stills (1080x1920, 9:16) and Korean caption drafts.

These are not AI-generated or photorealistic images, photographs, video, uploads, downloads, or a policy decision. The templates use only fixed palettes, fixed labels, approved storyboard-beat metadata, and an allow-listed direction. They never contain user scene text, user-reference bytes, provider credentials, or external URLs.

Video APIs are deferred. No video provider is selected or integrated.

## Why this replaces the prior Sora candidate

OpenAI discontinued the Sora web and app experiences on April 26, 2026, and has announced removal of the Videos API and Sora 2 models on September 24, 2026. The official API deprecation notice lists no replacement. Sora is therefore not a viable provider candidate for a new production path.

## Local MVP contract

| Item | Current behavior | Explicit limit |
| --- | --- | --- |
| Eligibility | Original requests only after the existing narrow local text precheck | The precheck is not rights, likeness, privacy, or media-safety approval. |
| Output | Four fixed-template SVG still previews with Korean caption drafts | No real photos, AI-generated images, MP4, VTT/SRT, thumbnail, or delivery manifest. |
| Inputs | Scene text for storyboard only; allow-listed direction | Reference media remains metadata only and is never read into a preview. |
| Provider | local-template | No external API, credentials, upload, storage, webhook, or payment path. |
| Quotas | Five daily generation submissions; three hourly retries are recorded in ARS-001 | Not enforced until identity, persistence, and a retry endpoint exist. |

## Future video release gates

Before selecting or integrating any video provider, obtain:

1. A dedicated provider account, secret management, least-privilege service identity, a hard spending cap, and a kill switch.
2. Written commercial, data-use, retention/deletion, training, and region confirmation for every media path.
3. An original, non-identifying provider contract test with no copyrighted characters, music, faces, or personal data.
4. Quarantine upload/scan/sanitize/delete handling and an approved-derivative-only handoff.
5. Owned private delivery, provider webhook verification, media QC, caption, disclosure, and deletion evidence.

## Sources

- [OpenAI Sora discontinuation notice](https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation)
- [OpenAI API deprecations](https://developers.openai.com/api/docs/deprecations)