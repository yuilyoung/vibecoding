# ADR-008: provider boundary and rendering path

Status: proposed for a credentialed spike; safe local simulation is accepted.

## Decision

Use a provider-neutral rendering boundary. The browser speaks only to the Studio API. The Studio API owns policy results, project state, provider job IDs, audit events, delivery manifests, and deletion work. It must never expose a provider secret or an original reference file to the browser.

For the first credentialed spike, evaluate OpenAI Sora 2 Pro as the primary candidate for a single 15-second vertical render. The implementation remains on the `mock` provider until an account owner supplies a dedicated project key, a hard spending cap, and the commercial/data-retention confirmation below.

## Capability evidence as of 2026-07-30

| Candidate | Fit for P0 | Constraint | Decision |
| --- | --- | --- | --- |
| OpenAI Sora 2 Pro | Supports 16- and 20-second generations, 1080x1920 output, image references, asynchronous status/webhooks, downloads, extensions and edits. | The 15-second product cut must be generated as 16 seconds then trimmed in our controlled delivery stage. Image inputs with human faces, real people, copyrighted characters and copyrighted music are rejected. Uploaded external-video editing is account-eligibility gated. | Credentialed spike candidate. |
| Google Veo 3 | Supports 9:16, 720p/1080p image-to-video and MP4 output. | Current documented clips are 4, 6 or 8 seconds. Image-to-video is Preview under Pre-GA terms; video input is unsupported on the documented Veo 3.0 page. A 15-second short needs a multi-shot assembly workflow. | Not a P0 single-render provider. |
| Local mock | Records self-attestation, narrow local text precheck, state transitions, audit events and no-delivery behavior without credentials. It is not a policy decision. | It never creates, uploads, retains or represents an MP4 as real; it also does not inspect reference media. | Accepted for UI/API integration. |

## Normalized provider contract

`submitRender(project)` accepts only an approved original storyboard, a policy-approved sanitized reference asset URL, `1080x1920`, and `15` requested seconds. It returns `{ providerJobId, status }`. Provider callbacks are idempotent and only move a matching project state forward. Download URLs are copied into owned storage before expiry; the browser receives only short-lived owned URLs.

Because Sora supports 16 and 20 seconds rather than a 15-second setting, the production adapter will request 16 seconds and pass the owned result through a deterministic one-second trim and QC stage. This is an explicit release condition, not a hidden prompt trick.

## Required release gates before switching from mock

1. Dedicated provider account, secret management, least-privilege service identity and cost ceiling.
2. Written confirmation of commercial terms, retention/deletion behavior, training/data-use terms and region acceptability for every user media path.
3. Provider contract test using an original, non-identifying 9:16 reference image and an English provider prompt; no copyrighted characters, music, faces or personal data.
4. Quarantine upload/scan/sanitize/delete worker (ARS-024) and an approved-derivative-only handoff.
5. MP4 trim, caption, thumbnail, manifest, watermark/disclosure and private-delivery QC evidence.

## Sources

- [OpenAI Sora video generation guide](https://developers.openai.com/api/docs/guides/video-generation)
- [Google Veo 3 model capabilities](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-0-generate)