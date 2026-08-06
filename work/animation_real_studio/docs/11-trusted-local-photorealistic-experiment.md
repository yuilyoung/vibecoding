# Trusted-local photorealistic still and motion-GIF experiment

## Scope

This is an opt-in local experiment, not a public or production media service. When `STUDIO_HEADLESS_IMAGEGEN=1` is set on a trusted machine already signed in to Codex, `/real` can create one original 9:16 photorealistic PNG from either:

- a user-authored prompt plus structured visual conditions; or
- one user-attested original 2D PNG, JPEG, or WebP still plus the same conditions.

After that one PNG is validated, the caller may choose a deterministic 2 to 30 frame, 10fps 9:16 motion GIF. The GIF applies a small local pan/zoom to the same generated still; it is not AI video and does not invoke the image generator for every frame.

The structured controls cover subject, adult age band, era, setting, presentation, framing/body area, camera angle, clothing, and people count. All people are restricted to fictional adults. The server remains authoritative for allow-listed values, prompt composition, simple unsafe-text rejection, and the original-content acknowledgement.

For 2D-to-photo requests, hard safety and rights constraints are highest priority; structured conditions and the user story define the subject action, emotion, event, and intended scene change; the reference then supplies only non-conflicting visual continuity such as silhouette, clothing, composition, background layout, lighting, and palette.
## Data boundary

The browser sends the prompt and, only for 2D-to-photo mode, one source raster capped at 6 MB to the loopback Studio API for validation. The adapter writes that original PNG/JPEG/WebP to a disposable local workspace as `source.<extension>` and invokes the signed-in local Codex CLI with exactly one `--image <absolute staged path>` attachment. This is the only visual-reference egress path: it lets the image generator interpret the selected pixels for this one request. Text-to-photo mode does not stage a source file or attach an image. The API never puts the source data URI, filename, source bytes, or absolute path into a returned project, job, audit record, output directory, or provider diagnostic. The whole workspace, including the staged reference, is deleted after success or failure; a Windows cleanup lock returns only the workspace leaf name and OS code as a local warning. A still result is kept only in the ignored local `generated/user-photorealistic-stills/` directory. A requested motion GIF is additionally written to ignored `generated/user-motion-gifs/`; both are returned only through the in-memory local API session response.

This attestation and narrow validation are not media scanning, identity verification, a rights decision, a privacy decision, or a production safety workflow.

## Progress and ETA

Codex image generation does not expose model-render percent or a provider ETA to this local process. The server records actual milestones: validated, workspace/input prepared, provider started, PNG output validated, optional GIF encoding with its encoded frame count, and terminal completion or failure.

The progress bar always reflects observed server lifecycle checkpoints, not a model-render percentage: validation (10%), workspace prepared (30%), provider started only after the Codex process has spawned (55%), output validated (90%), optional GIF encoding from actual encoded-frame callbacks (91 to 99%), and terminal completion (100%). After at least three completed jobs in the same mode/output bucket of the current local API session, each poll takes the greater of that lifecycle checkpoint and a server-calculated elapsed-time forecast based on the bucket median, capped at 90%. A terminal completed event with a validated still or GIF artifact is the only 100% state; a failed or forecast-exceeded job never reaches it. The separately displayed ETA uses the same matching median. The API default provider deadline is 300 seconds and can be bounded with `STUDIO_HEADLESS_IMAGEGEN_TIMEOUT_MS` (60 to 600 seconds).
## Operator requirements

- Start the local API with `STUDIO_HEADLESS_IMAGEGEN=1` only on a trusted local machine.
- An explicit button click starts one job; the signed-in Codex/ChatGPT image allowance can be consumed and completion can take minutes.
- Keep the API bound to `127.0.0.1`; do not expose the in-memory capability or Codex authentication outside the local machine.
- Stop the API process or remove the environment switch to disable the feature.
- Do not use real people, celebrity likenesses, minors, sexual content, copyrighted characters, logos, watermarks, or unowned source artwork.

## Deliberate exclusions

There is no hosted account, persistent database, public URL, share/download flow, AI-video or frame-by-frame AI generation, provider webhooks, media quarantine/scanning, entitlement or billing control, or production deletion/retention workflow. The local motion GIF is a deterministic derivative of one generated still, not a video-provider integration. A public release requires the release gates in ADR-008.