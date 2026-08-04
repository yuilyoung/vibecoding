# Local headless image-generation probe

## Purpose

This is a developer-only capability probe for one original, non-identifying 9:16 photorealistic PNG. It runs `codex exec` with the local Codex login and `$imagegen`; it is not an OpenAI Image API integration or a public feature.

## Enable locally

Run only on a trusted local machine that is already signed in to Codex:

```powershell
$env:STUDIO_HEADLESS_IMAGEGEN = "1"
npm run dev:api
npm run dev
```

Open a project page and select **Generate test photorealistic image**. The generated PNG is local-only under `generated/headless-image-probe/`, which is ignored by Git.

## Hard boundaries

- Disabled by default; the endpoint returns `provider_not_configured` until the environment switch is set.
- The prompt is fixed. Project scene text, reference-media metadata or bytes, and user prompts never reach the headless generator.
- Codex runs in a newly created empty temporary workspace with `workspace-write`. Its child process receives only a small OS/Codex-login environment allowlist, not unrelated developer environment variables. The output target is 9:16; to accommodate provider pixel rounding, a decoded raster is accepted when its aspect ratio is within 0.1% of 9:16. The Studio records the returned pixel dimensions and does not crop, upscale, or relabel them. PNG chunks must have valid CRCs and IDAT data must decompress to valid non-interlaced scanlines before the result is copied into the ignored local output directory. The temporary workspace is removed after the run; on Windows `EBUSY`, `EPERM`, or `ENOTEMPTY`, cleanup retries up to three times with 100ms then 200ms backoff. If it remains locked, the generated asset or original provider/validation error is preserved with a safe local cleanup warning; the empty temporary workspace may remain locally for later OS cleanup. The warning contains only the workspace leaf name and OS error code, never prompts, image bytes, credentials, or project data.
- The local API issues an in-memory capability token through its same-origin GET response. A POST without that token is rejected; no CORS policy is enabled and the API remains bound to `127.0.0.1`. This is a local browser-control boundary, not a replacement for user authentication.
- The probe has no uploads, storage service, downloads, sharing, video, or public access. It permits at most three fixed, developer-only probes per local API session and only one may be in flight. Each explicit button click consumes one allowance; restart the local API deliberately resets this in-memory allowance and attempt history.
- Codex authentication is sensitive. Do not commit, copy, or expose `$CODEX_HOME/auth.json` to the browser, logs, source tree, or another machine.
- It consumes the signed-in Codex/ChatGPT image-generation allowance and may take several minutes. Stop the local API or unset the switch as the kill mechanism.

## Not a production provider decision

This probe does not satisfy ADR-008's provider-selection, rights, retention, regional, cost-cap, deletion, or public-delivery gates. A user-driven image feature still needs a server-side provider adapter, approved safety workflow, and the documented release evidence.
