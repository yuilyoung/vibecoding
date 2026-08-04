import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHILD_ENVIRONMENT_KEYS = ["PATH", "PATHEXT", "SystemRoot", "SYSTEMROOT", "WINDIR", "ComSpec", "COMSPEC", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA", "CODEX_HOME", "TEMP", "TMP"];
const TARGET_ASPECT_RATIO = 9 / 16;
const TARGET_ASPECT_RATIO_TOLERANCE = 0.001;
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
function runCodexExec({ command, args, cwd, environment, timeoutMs }) {
  return new Promise((resolveRun, rejectRun) => {
    let finished = false;
    let timeout;
    const finish = (action) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      action();
    };
    const child = spawn(command, args, { cwd, env: environment, windowsHide: true, stdio: "ignore" });
    timeout = setTimeout(() => {
      child.kill();
      finish(() => rejectRun(new HeadlessImageProviderError("provider_timeout", "Headless image generation timed out.")));
    }, timeoutMs);
    child.once("error", () => finish(() => rejectRun(new HeadlessImageProviderError("provider_unavailable", "Codex headless execution could not be started."))));
    child.once("exit", (exitCode) => finish(() => resolveRun({ exitCode })));
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
    temporaryDirectory = tmpdir(),
    timeoutMs = 180_000,
    newId = randomUUID,
    cleanup = rm,
    wait = delay,
    cleanupAttempts = 3,
  } = {}) {
    this.environment = environment;
    this.command = command;
    this.run = run;
    this.outputDirectory = outputDirectory;
    this.temporaryDirectory = temporaryDirectory;
    this.timeoutMs = timeoutMs;
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
      if (execution.exitCode !== 0) throw new HeadlessImageProviderError("provider_failed", "Codex headless image generation did not complete successfully.");
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
}
