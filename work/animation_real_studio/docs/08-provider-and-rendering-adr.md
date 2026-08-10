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
## Additive trusted-local photorealistic-still experiment

The local 2D preview remains the default MVP path described above. A separate opt-in local experiment now exists for a trusted developer machine with `STUDIO_HEADLESS_IMAGEGEN=1`: it produces one actual 9:16 photorealistic PNG through local `codex exec` and `$imagegen`, either from a structured/user-authored prompt or from one user-attested original 2D still.

This is deliberately not a provider selection or a public product launch. The API remains loopback-only, no browser secret is exposed, source 2D bytes are limited to one PNG/JPEG/WebP under 6 MB and live only in a disposable local workspace, and the result remains in the ignored local `generated/` directory plus the in-memory session response. The server rejects unsupported conditions and obvious protected-work, real-person, minor, and sexual wording, but this is not image scanning, identity verification, or a complete policy review.

The interface shows observed server lifecycle milestones and GIF frame encoding progress. Before the provider actually starts, numeric progress remains at 0%. Once the provider-started milestone is observed, progress begins at 5%. Before three matching successful local-session duration samples exist, the UI uses a clearly labelled bootstrap estimate from the configured provider deadline plus a bounded output-validation/encoding buffer; after three samples, it switches automatically to the matching bucket median without lowering existing high-water progress. For either ETA source, the server divides the estimate into 100 equal time slices and advances the forecast by 1 percentage point per completed slice, capped at 90%. At 90%, a completion-wait panel reports whether the service is waiting for provider output, validating the returned image, encoding GIF frames, or saving the artifact; the numeric bar stays at 90% through those operations. Only a validated terminal artifact reaches 100%; failed jobs never do. Codex still exposes neither model-render percent nor a provider ETA. In 2D-to-photo mode only, the validated source is staged in the disposable workspace and passed once to the signed-in Codex CLI with `--image <absolute staged path>`, so the image generator can use it as a visual reference while the user story remains authoritative for the intended action, emotion, and event. Text-to-photo mode has no attachment. The workspace is deleted after the nested command and the source bytes, filename, and path are not retained in project, audit, or generated output records. See [trusted-local experiment](11-trusted-local-photorealistic-experiment.md) for the operating boundary.
## Motion-GIF addendum

The trusted-local experiment may encode a 2 to 30 frame, 10fps, 9:16 GIF only after its one generated PNG has been validated. The encoder uses a deterministic local pan/zoom over that single still and writes an ignored local artifact. It is neither AI video nor per-frame AI regeneration, does not consume extra image-generation allowance, and does not satisfy any of the future video release gates above. The observed lifecycle bar remains below 100% until terminal artifact validation.
