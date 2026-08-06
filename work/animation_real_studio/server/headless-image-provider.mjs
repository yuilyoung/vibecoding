import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { MotionGifRenderer } from "./motion-gif-renderer.mjs";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHILD_ENVIRONMENT_KEYS = ["PATH", "PATHEXT", "SystemRoot", "SYSTEMROOT", "WINDIR", "ComSpec", "COMSPEC", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA", "CODEX_HOME", "TEMP", "TMP"];
const TARGET_ASPECT_RATIO = 9 / 16;
const TARGET_ASPECT_RATIO_TOLERANCE = 0.001;
const USER_REFERENCE_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const DEFAULT_TIMEOUT_MS = 300_000;
const MIN_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 600_000;
const STDERR_DIAGNOSTIC_LIMIT = 8 * 1024;
const PROBE_PROMPT = `
Use $imagegen to create exactly one original, non-identifying photorealistic still for a local capability probe.

Use case: photorealistic-natural
Asset type: local Animation Real Studio developer-only image-generation probe
Scene/backdrop: an empty rain-wet commuter platform at blue hour, distant train lights and softly glowing safety signage with no readable words
Subject: no people, no faces, no animals; a single empty red bench and two closed umbrellas resting beside it
Style/medium: cinematic photorealistic digital still, natural textures, physically plausible wet concrete and metal reflections
Composition/framing: vertical 9:16 portrait, 1152 by 2048 pixels, generous clear space in the upper third
Lighting/mood: cool blue ambient rain light balanced by warm train lights; quiet, reflective mood
Constraints: create an original scene only; do not use project files, user-provided scene text, reference media, characters, brands, logos, readable text, watermarks, or personal data
Avoid: people, faces, copyrighted characters, celebrity likenesses, signatures, captions, and UI chrome
`;

export class HeadlessImageProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function imageDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 45 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  let offset = 8;
  let dimensions = null;
  let imageSpec = null;
  const imageData = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return null;
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== bytes.readUInt32BE(offset + 8 + length)) return null;
    if (offset === 8) {
      if (type !== "IHDR" || length !== 13) return null;
      const width = bytes.readUInt32BE(offset + 8);
      const height = bytes.readUInt32BE(offset + 12);
      const bitDepth = bytes[offset + 16];
      const colorType = bytes[offset + 17];
      const compressionMethod = bytes[offset + 18];
      const filterMethod = bytes[offset + 19];
      const interlaceMethod = bytes[offset + 20];
      const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
      const validBitDepths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }[colorType];
      if (!width || !height || !channels || !validBitDepths?.includes(bitDepth) || compressionMethod !== 0 || filterMethod !== 0 || interlaceMethod !== 0) return null;
      const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
      const expectedBytes = height * (rowBytes + 1);
      if (!Number.isSafeInteger(expectedBytes) || expectedBytes > 32 * 1024 * 1024) return null;
      dimensions = { width, height };
      imageSpec = { rowBytes, expectedBytes };
    }
    if (type === "IDAT" && length > 0) imageData.push(bytes.subarray(offset + 8, offset + 8 + length));
    if (type === "IEND") {
      if (length !== 0 || end !== bytes.length || !dimensions || !imageSpec || !imageData.length) return null;
      try {
        const decoded = inflateSync(Buffer.concat(imageData), { maxOutputLength: imageSpec.expectedBytes });
        if (decoded.length !== imageSpec.expectedBytes) return null;
        for (let row = 0; row < decoded.length; row += imageSpec.rowBytes + 1) if (decoded[row] > 4) return null;
        return dimensions;
      } catch {
        return null;
      }
    }
    offset = end;
  }
  return null;
}
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function boundedTimeoutMs(value, fallback = DEFAULT_TIMEOUT_MS) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.floor(parsed)));
}

function diagnosticCodeForSpawnError(error) {
  if (error?.code === "EPERM" || error?.code === "EACCES") return "process_permission_denied";
  if (error?.code === "ENOENT") return "codex_command_not_found";
  return "provider_start_failed";
}

function diagnosticCodeForStderr(stderr) {
  const normalized = stderr.toLowerCase();
  if (/not logged|sign in|authentication|auth(?:entication)? required/.test(normalized)) return "codex_not_authenticated";
  if (/sandbox|permission denied|approval required/.test(normalized)) return "sandbox_rejected";
  if (/rate limit|quota|allowance/.test(normalized)) return "quota_or_rate_limited";
  return "provider_exit_nonzero";
}

function providerFailure(execution) {
  const error = new HeadlessImageProviderError("provider_failed", "Codex headless image generation ended before it produced result.png.");
  if (execution?.providerDiagnostics) error.providerDiagnostics = execution.providerDiagnostics;
  return error;
}

function runCodexExec({ command, args, cwd, environment, timeoutMs, onStarted = () => {} }) {
  return new Promise((resolveRun, rejectRun) => {
    let finished = false;
    let timeout;
    const startedAt = Date.now();
    let stderrBytes = 0;
    let stderrTruncated = false;
    let capturedStderrBytes = 0;
    const stderrChunks = [];
    const diagnostics = (extra = {}) => ({ elapsedSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)), stderrBytes, stderrTruncated, ...extra });
    const finish = (action) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      action();
    };
    const child = spawn(command, args, { cwd, env: environment, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    child.once("spawn", onStarted);
    child.stderr?.on("data", (chunk) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stderrBytes += bytes.length;
      if (stderrBytes > STDERR_DIAGNOSTIC_LIMIT) stderrTruncated = true;
      if (capturedStderrBytes < STDERR_DIAGNOSTIC_LIMIT) {
        const retained = bytes.subarray(0, STDERR_DIAGNOSTIC_LIMIT - capturedStderrBytes);
        stderrChunks.push(retained);
        capturedStderrBytes += retained.length;
      }
    });
    timeout = setTimeout(() => {
      child.kill();
      const error = new HeadlessImageProviderError("provider_timeout", `Headless image generation timed out after ${Math.ceil(timeoutMs / 1000)} seconds. The provider did not save result.png before the deadline.`);
      error.providerDiagnostics = diagnostics({ diagnosticCode: "provider_timeout", timeoutSeconds: Math.ceil(timeoutMs / 1000) });
      finish(() => rejectRun(error));
    }, timeoutMs);
    child.once("error", (spawnError) => {
      const error = new HeadlessImageProviderError("provider_unavailable", "Codex headless execution could not be started.");
      error.providerDiagnostics = diagnostics({ diagnosticCode: diagnosticCodeForSpawnError(spawnError) });
      finish(() => rejectRun(error));
    });
    child.once("exit", (exitCode, signal) => {
      const capturedStderr = Buffer.concat(stderrChunks).toString("utf8");
      stderrChunks.length = 0;
      const providerDiagnostics = diagnostics({ exitCode, ...(signal ? { signal } : {}), ...(exitCode === 0 ? {} : { diagnosticCode: diagnosticCodeForStderr(capturedStderr) }) });
      finish(() => resolveRun({ exitCode, signal, providerDiagnostics }));
    });
  });
}

function matchesTargetAspect({ width, height }) {
  return Math.abs(((width / height) / TARGET_ASPECT_RATIO) - 1) <= TARGET_ASPECT_RATIO_TOLERANCE;
}

function sanitizedEnvironment(environment) {
  return Object.fromEntries(CHILD_ENVIRONMENT_KEYS.flatMap((key) => {
    const value = environment[key];
    return typeof value === "string" && value.length ? [[key, value]] : [];
  }));
}
function cleanupWarning(workspace, osCode, code = "cleanup_warning") {
  return { code, workspace: basename(workspace), osCode };
}

export async function cleanupProbeWorkspace({ workspace, temporaryDirectory, remove = rm, wait = delay, attempts = 3 }) {
  const safeTemporaryDirectory = resolve(temporaryDirectory);
  const safeWorkspace = resolve(workspace);
  const containedPath = relative(safeTemporaryDirectory, safeWorkspace);
  if (!containedPath || containedPath.startsWith("..") || isAbsolute(containedPath) || !basename(safeWorkspace).startsWith("ars-headless-imagegen-")) {
    return cleanupWarning(safeWorkspace, "invalid_target", "cleanup_target_invalid");
  }
  const totalAttempts = Math.max(1, attempts);
  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    try {
      await remove(safeWorkspace, { recursive: true, force: true });
      return null;
    } catch (error) {
      const osCode = typeof error?.code === "string" ? error.code : "unknown";
      const retryable = osCode === "EBUSY" || osCode === "EPERM" || osCode === "ENOTEMPTY";
      if (!retryable || attempt === totalAttempts - 1) return cleanupWarning(safeWorkspace, osCode);
      try { await wait(100 * (attempt + 1)); }
      catch (waitError) { return cleanupWarning(safeWorkspace, typeof waitError?.code === "string" ? waitError.code : "wait_failed"); }
    }
  }
  return cleanupWarning(safeWorkspace, "unknown");
}
export class HeadlessCodexImageProvider {
  constructor({
    environment = process.env,
    command = "codex",
    run = runCodexExec,
    outputDirectory = resolve(PROJECT_ROOT, "generated", "headless-image-probe"),
    userOutputDirectory = resolve(PROJECT_ROOT, "generated", "user-photorealistic-stills"),
    motionGifOutputDirectory = resolve(PROJECT_ROOT, "generated", "user-motion-gifs"),
    motionGifRenderer = new MotionGifRenderer(),
    temporaryDirectory = tmpdir(),
    timeoutMs = null,
    newId = randomUUID,
    cleanup = rm,
    wait = delay,
    cleanupAttempts = 3,
  } = {}) {
    this.environment = environment;
    this.command = command;
    this.run = run;
    this.outputDirectory = outputDirectory;
    this.userOutputDirectory = userOutputDirectory;
    this.motionGifOutputDirectory = motionGifOutputDirectory;
    this.motionGifRenderer = motionGifRenderer;
    this.temporaryDirectory = temporaryDirectory;
    this.timeoutMs = boundedTimeoutMs(timeoutMs ?? environment.STUDIO_HEADLESS_IMAGEGEN_TIMEOUT_MS);
    this.newId = newId;
    this.cleanup = cleanup;
    this.wait = wait;
    this.cleanupAttempts = cleanupAttempts;
  }

  status() {
    const enabled = this.environment.STUDIO_HEADLESS_IMAGEGEN === "1";
    return {
      enabled,
      provider: "codex-headless-imagegen",
      mode: "fixed_original_probe",
      notice: enabled
        ? "Developer-only local probe enabled. It uses saved Codex authentication and never receives project, reference-media, or user-prompt data."
        : "Headless image generation is disabled. Set STUDIO_HEADLESS_IMAGEGEN=1 only on a trusted local development machine.",
    };
  }

  async generateProbe() {
    if (!this.status().enabled) throw new HeadlessImageProviderError("provider_not_configured", "Headless image generation is disabled on this Studio API process.");
    const id = `probe-${this.newId()}`;
    const outputPath = resolve(this.outputDirectory, `${id}.png`);
    const workspace = await mkdtemp(join(this.temporaryDirectory, "ars-headless-imagegen-"));
    const isolatedOutputPath = resolve(workspace, "result.png");
    const prompt = `${PROBE_PROMPT}\nSave the final PNG to this exact relative path: result.png\nDo not read, create, or edit any other file. In your final response, report only whether result.png was saved.`;
    let asset;
    let primaryError;
    try {
      const execution = await this.run({
        command: this.command,
        args: ["exec", "--ephemeral", "--sandbox", "workspace-write", "--skip-git-repo-check", "--cd", workspace, prompt],
        cwd: workspace,
        environment: sanitizedEnvironment(this.environment),
        timeoutMs: this.timeoutMs,
        outputPath: isolatedOutputPath,
        prompt,
      });
      if (execution.exitCode !== 0) throw providerFailure(execution);
      let bytes;
      try {
        bytes = await readFile(isolatedOutputPath);
      } catch {
        throw new HeadlessImageProviderError("provider_output_missing", "Codex completed without saving the expected PNG output.");
      }
      const dimensions = imageDimensions(bytes);
      if (!dimensions || !matchesTargetAspect(dimensions)) throw new HeadlessImageProviderError("provider_invalid_output", "The generated probe is not within the 0.1% 9:16 aspect-ratio tolerance.");
      await mkdir(this.outputDirectory, { recursive: true });
      await writeFile(outputPath, bytes);
      asset = {
        id,
        kind: "headless_photorealistic_probe",
        origin: "codex_headless_imagegen",
        generatedByAi: true,
        mimeType: "image/png",
        width: dimensions.width,
        height: dimensions.height,
        targetAspectRatio: "9:16",
        returnedAspectRatio: `${dimensions.width}:${dimensions.height}`,
        dataUri: `data:image/png;base64,${bytes.toString("base64")}`,
        notice: "Developer-only fixed original probe. No project scene, user prompt, or reference media was sent to the generator.",
      };
    } catch (error) {
      primaryError = error;
    }
    const warning = await cleanupProbeWorkspace({ workspace, temporaryDirectory: this.temporaryDirectory, remove: this.cleanup, wait: this.wait, attempts: this.cleanupAttempts });
    if (primaryError) {
      if (warning && typeof primaryError === "object") primaryError.cleanupWarning = warning;
      throw primaryError;
    }
    return warning ? { ...asset, cleanupWarning: warning } : asset;
  }
  async generateUserImage({ prompt, reference = null, output = { kind: "still", frameCount: 1 }, onPhase = () => {} } = {}) {
    if (!this.status().enabled) throw new HeadlessImageProviderError("provider_not_configured", "Headless image generation is disabled on this Studio API process.");
    if (typeof prompt !== "string" || !prompt.trim()) throw new HeadlessImageProviderError("invalid_prompt", "A validated image prompt is required.");
    if (reference && (!Buffer.isBuffer(reference.bytes) || !USER_REFERENCE_EXTENSIONS[reference.mimeType])) throw new HeadlessImageProviderError("invalid_reference", "The 2D reference image is invalid.");
    if (!output || !["still", "motion_gif"].includes(output.kind) || (output.kind === "motion_gif" && (!Number.isInteger(output.frameCount) || output.frameCount < 2 || output.frameCount > 30))) throw new HeadlessImageProviderError("invalid_output", "Choose a still or a 2 to 30 frame motion GIF output.");
    const id = `photo-${this.newId()}`;
    const outputPath = resolve(this.userOutputDirectory, `${id}.png`);
    const motionGifOutputPath = resolve(this.motionGifOutputDirectory, `${id}.gif`);
    const workspace = await mkdtemp(join(this.temporaryDirectory, "ars-headless-imagegen-"));
    const isolatedOutputPath = resolve(workspace, "result.png");
    const stagedReferencePath = reference ? resolve(workspace, `source.${USER_REFERENCE_EXTENSIONS[reference.mimeType]}`) : null;
    const sourceInstruction = reference ? "Reference precedence: after hard safety/rights constraints and the validated visual brief plus story direction, use the attached user-attested original 2D image as the primary visual reference for rendering continuity. The story direction wins for the subject's action, emotion, event, and intentional scene change; do not let the unchanged source pose or background replace that story. For all non-conflicting traits, first inspect and preserve: subject count; fictional adult silhouette and pose; non-identifying hairstyle; clothing category, colour, and material; non-logo accessories; camera angle, framing, and perspective; background setting, layout, focal-object placement, lighting, weather, and colour palette. Preserve only original, non-identifying design traits: never reproduce a real-person likeness or face identity, a celebrity, a copyrighted character or protected distinctive design, a logo, signature, watermark, or readable text. If a source trait conflicts with the validated brief, story direction, or safety constraints, replace only that conflicting trait while preserving the remaining visual continuity." : "There is no source image. Create the image from the validated visual brief and story direction only.";
    const providerPrompt = `Use $imagegen to create exactly one original, non-identifying photorealistic still for the trusted-local Animation Real Studio experiment.\n\n${sourceInstruction}\n\n${prompt.trim()}\n\nFollow the validated story direction for action, emotion, event, and intentional scene change; use the source only for non-conflicting visual continuity.\nComposition/framing: vertical 9:16 portrait, 1152 by 2048 pixels.\nHard constraints: all people must be clearly fictional adults; do not create a recognisable real person, celebrity, copyrighted character, logo, signature, watermark, readable text, graphic sexual content, or violence.\nSave the final PNG to this exact relative path: result.png.\nDo not read, create, or edit any other file except the attached reference and result.png. In your final response, report only whether result.png was saved.`;
    let asset;
    let primaryError;
    try {
      if (stagedReferencePath) await writeFile(stagedReferencePath, reference.bytes);
      onPhase("workspace_prepared");
      let providerStarted = false;
      const onProviderStarted = () => { if (!providerStarted) { providerStarted = true; onPhase("provider_started"); } };
      const execution = await this.run({ command: this.command, args: ["exec", "--ephemeral", "--sandbox", "workspace-write", "--skip-git-repo-check", "--cd", workspace, providerPrompt, ...(stagedReferencePath ? ["--image", stagedReferencePath] : [])], cwd: workspace, environment: sanitizedEnvironment(this.environment), timeoutMs: this.timeoutMs, outputPath: isolatedOutputPath, prompt: providerPrompt, onStarted: onProviderStarted });
      if (execution.exitCode !== 0) throw providerFailure(execution);
      let bytes;
      try { bytes = await readFile(isolatedOutputPath); }
      catch { throw new HeadlessImageProviderError("provider_output_missing", "Codex completed without saving the expected PNG output."); }
      const dimensions = imageDimensions(bytes);
      if (!dimensions || !matchesTargetAspect(dimensions)) throw new HeadlessImageProviderError("provider_invalid_output", "The generated image is not within the 0.1% 9:16 aspect-ratio tolerance.");
      onPhase("output_validated");
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, bytes);
      if (output.kind === "motion_gif") {
        onPhase("gif_encoding", { currentFrame: 0, frameCount: output.frameCount });
        const encoded = await this.motionGifRenderer.render({ sourceBytes: bytes, frameCount: output.frameCount, onFrame: ({ currentFrame, frameCount }) => onPhase("gif_encoding", { currentFrame, frameCount }) });
        await mkdir(dirname(motionGifOutputPath), { recursive: true });
        await writeFile(motionGifOutputPath, encoded.bytes);
        asset = { id, kind: "user_motion_gif", origin: "local_motion_gif_from_generated_still", generatedByAi: true, mimeType: encoded.mimeType, width: encoded.width, height: encoded.height, aspectRatio: "9:16", frameCount: encoded.frameCount, fps: encoded.fps, durationSeconds: encoded.durationSeconds, byteLength: encoded.byteLength, dataUri: `data:image/gif;base64,${encoded.bytes.toString("base64")}`, notice: "Trusted-local deterministic motion GIF built from one generated photorealistic still. It is not AI video or frame-by-frame image generation." };
      } else {
        asset = { id, kind: "user_photorealistic_still", origin: "codex_headless_imagegen", generatedByAi: true, mimeType: "image/png", width: dimensions.width, height: dimensions.height, aspectRatio: "9:16", frameCount: 1, fps: null, durationSeconds: null, byteLength: bytes.length, dataUri: `data:image/png;base64,${bytes.toString("base64")}`, notice: reference ? "Trusted-local experimental image. The user-attested 2D reference was attached to Codex for this request." : "Trusted-local experimental image generated from the validated visual brief." };
      }
      onPhase("artifact_ready");
    } catch (error) { primaryError = error; }
    const warning = await cleanupProbeWorkspace({ workspace, temporaryDirectory: this.temporaryDirectory, remove: this.cleanup, wait: this.wait, attempts: this.cleanupAttempts });
    if (primaryError) {
      if (warning && typeof primaryError === "object") primaryError.cleanupWarning = warning;
      throw primaryError;
    }
    return warning ? { ...asset, cleanupWarning: warning } : asset;
  }
}
