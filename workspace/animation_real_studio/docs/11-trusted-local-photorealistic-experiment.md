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

The numeric bar is an elapsed-time forecast, not a model-render percentage. Before the provider starts, validation and workspace preparation remain at 0%. When the Codex child process emits its actual started event, the forecast begins at 5%. The server divides the current estimate by 100; every completed time slice adds 1%, with a monotonic high-water mark and a hard 90% cap. Output validation, optional GIF encoding with its real encoded-frame count, artifact storage, and a provider that runs beyond the estimate are represented by an explicit completion-wait state at 90%, rather than fabricated 91 to 99 values. Before three completed jobs exist in the same mode/output bucket of the current local API session, the server provides a clearly labelled bootstrap estimate calculated from its configured provider deadline plus a bounded output-validation/encoding buffer. After three samples, the estimate source automatically switches to the bucket median without lowering the stored high-water value. The active UI exposes the estimate source and has a nonessential loading indicator that respects reduced-motion preference. A terminal completed event with a validated still or GIF artifact is the only 100% state; a failed job never reaches it. The API default provider deadline is 300 seconds and can be bounded with `STUDIO_HEADLESS_IMAGEGEN_TIMEOUT_MS` (60 to 600 seconds).
## Operator requirements

- Start the local API with `STUDIO_HEADLESS_IMAGEGEN=1` only on a trusted local machine.
- An explicit button click starts one job; the signed-in Codex/ChatGPT image allowance can be consumed and completion can take minutes.
- Keep the API bound to `127.0.0.1`; do not expose the in-memory capability or Codex authentication outside the local machine.
- Stop the API process or remove the environment switch to disable the feature.
- Do not use real people, celebrity likenesses, minors, sexual content, copyrighted characters, logos, watermarks, or unowned source artwork.

## Reproducible launch lesson

Progress UI changes cannot repair a provider process that never started. On Windows, `spawn()` can throw `EPERM` synchronously before an `error` listener or the provider-started callback is installed, especially when the API itself runs under a parent sandbox that denies child-process creation. The adapter therefore normalizes both synchronous throws and asynchronous process errors to `provider_unavailable` with the safe diagnostic `process_permission_denied`; it never exposes raw `spawn EPERM` as the job error. The operational correction is to restart `npm run dev:api` from a trusted local terminal that permits child processes. Re-tuning bootstrap ETA, lifecycle percentages, or the 90% panel is not a substitute for that launch check.

## Deliberate exclusions

There is no hosted account, persistent database, public URL, share/download flow, AI-video or frame-by-frame AI generation, provider webhooks, media quarantine/scanning, entitlement or billing control, or production deletion/retention workflow. The local motion GIF is a deterministic derivative of one generated still, not a video-provider integration. A public release requires the release gates in ADR-008.
