import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { cleanupProbeWorkspace, HeadlessCodexImageProvider, HeadlessImageProviderError } from "./headless-image-provider.mjs";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function portraitPng(width = 9, height = 16) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  const pixels = Buffer.alloc((width + 1) * height);
  return Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(pixels)), pngChunk("IEND", Buffer.alloc(0))]);
}

test("headless provider invokes Codex in a disposable workspace and maps a complete PNG", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "ars-headless-provider-output-"));
  let invocation;
  const provider = new HeadlessCodexImageProvider({
    environment: { STUDIO_HEADLESS_IMAGEGEN: "1", OPENAI_API_KEY: "not-forwarded", PATH: "allowed-path", UNRELATED_SECRET: "not-forwarded" },
    outputDirectory,
    temporaryDirectory: tmpdir(),
    newId: () => "fixed",
    run: async (call) => {
      invocation = call;
      await writeFile(call.outputPath, portraitPng(1080, 1920));
      return { exitCode: 0 };
    },
  });
  try {
    const asset = await provider.generateProbe();
    assert.equal(asset.generatedByAi, true);
    assert.equal(asset.width, 1080);
    assert.equal(asset.height, 1920);
    assert.match(asset.dataUri, /^data:image\/png;base64,/);
    assert.deepEqual(invocation.args.slice(0, 7), ["exec", "--ephemeral", "--sandbox", "workspace-write", "--skip-git-repo-check", "--cd", invocation.cwd]);
    assert.notEqual(invocation.cwd, outputDirectory);
    assert.equal(invocation.environment.OPENAI_API_KEY, undefined);
    assert.equal(invocation.environment.PATH, "allowed-path");
    assert.equal(invocation.environment.UNRELATED_SECRET, undefined);
    assert.match(invocation.prompt, /\$imagegen/);
    assert.match(invocation.prompt, /result\.png/);
    assert.doesNotMatch(invocation.prompt, /street-light\.jpg|A commuter pauses at a rain-soaked station/);
    await assert.rejects(access(invocation.cwd));
  } finally { await rm(outputDirectory, { recursive: true, force: true }); }
});

test("headless provider accepts provider pixel rounding within 0.1% of 9:16 and records actual dimensions", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "ars-headless-provider-output-"));
  try {
    const accepted = new HeadlessCodexImageProvider({
      environment: { STUDIO_HEADLESS_IMAGEGEN: "1" },
      outputDirectory,
      run: async (call) => { await writeFile(call.outputPath, portraitPng(941, 1672)); return { exitCode: 0 }; },
    });
    const asset = await accepted.generateProbe();
    assert.equal(asset.width, 941);
    assert.equal(asset.height, 1672);
    assert.equal(asset.targetAspectRatio, "9:16");
    assert.equal(asset.returnedAspectRatio, "941:1672");
    for (const [width, height] of [[941, 1671], [1024, 1792]]) {
      const rejected = new HeadlessCodexImageProvider({
        environment: { STUDIO_HEADLESS_IMAGEGEN: "1" },
        outputDirectory,
        run: async (call) => { await writeFile(call.outputPath, portraitPng(width, height)); return { exitCode: 0 }; },
      });
      await assert.rejects(rejected.generateProbe(), (error) => error instanceof HeadlessImageProviderError && error.code === "provider_invalid_output");
    }
  } finally { await rm(outputDirectory, { recursive: true, force: true }); }
});
test("headless provider rejects PNGs without image data or with corrupt checksums", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "ars-headless-provider-output-"));
  const invalidPngs = [
    Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", Buffer.from([0, 0, 0, 9, 0, 0, 0, 16, 8, 0, 0, 0, 0])), pngChunk("IEND", Buffer.alloc(0))]),
    Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", Buffer.from([0, 0, 0, 9, 0, 0, 0, 16, 8, 0, 0, 0, 0])), pngChunk("IDAT", Buffer.from("not-zlib", "ascii")), pngChunk("IEND", Buffer.alloc(0))]),
    (() => { const bytes = portraitPng(); bytes[41] ^= 1; return bytes; })(),
  ];
  try {
    for (const bytes of invalidPngs) {
      const provider = new HeadlessCodexImageProvider({
        environment: { STUDIO_HEADLESS_IMAGEGEN: "1" },
        outputDirectory,
        run: async (call) => { await writeFile(call.outputPath, bytes); return { exitCode: 0 }; },
      });
      await assert.rejects(provider.generateProbe(), (error) => error instanceof HeadlessImageProviderError && error.code === "provider_invalid_output");
    }
  } finally { await rm(outputDirectory, { recursive: true, force: true }); }
});
test("headless provider is off by default and does not start Codex", async () => {
  let invoked = false;
  const provider = new HeadlessCodexImageProvider({ run: async () => { invoked = true; return { exitCode: 0 }; } });
  await assert.rejects(provider.generateProbe(), (error) => error instanceof HeadlessImageProviderError && error.code === "provider_not_configured");
  assert.equal(invoked, false);
});

test("headless provider preserves a timeout failure code and deletes its temporary workspace", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "ars-headless-provider-output-"));
  let invocation;
  const provider = new HeadlessCodexImageProvider({
    environment: { STUDIO_HEADLESS_IMAGEGEN: "1" },
    outputDirectory,
    run: async (call) => { invocation = call; throw new HeadlessImageProviderError("provider_timeout", "timed out"); },
  });
  try {
    await assert.rejects(provider.generateProbe(), (error) => error instanceof HeadlessImageProviderError && error.code === "provider_timeout");
    await assert.rejects(access(invocation.cwd));
  } finally { await rm(outputDirectory, { recursive: true, force: true }); }
});

test("headless provider uses a bounded configurable execution deadline", () => {
  const defaultProvider = new HeadlessCodexImageProvider({ environment: { STUDIO_HEADLESS_IMAGEGEN: "1" } });
  assert.equal(defaultProvider.timeoutMs, 300_000);
  const configuredProvider = new HeadlessCodexImageProvider({ environment: { STUDIO_HEADLESS_IMAGEGEN: "1", STUDIO_HEADLESS_IMAGEGEN_TIMEOUT_MS: "120000" } });
  assert.equal(configuredProvider.timeoutMs, 120_000);
  const clampedProvider = new HeadlessCodexImageProvider({ environment: { STUDIO_HEADLESS_IMAGEGEN: "1", STUDIO_HEADLESS_IMAGEGEN_TIMEOUT_MS: "1" } });
  assert.equal(clampedProvider.timeoutMs, 60_000);
  const upperBoundProvider = new HeadlessCodexImageProvider({ environment: { STUDIO_HEADLESS_IMAGEGEN: "1", STUDIO_HEADLESS_IMAGEGEN_TIMEOUT_MS: "900000" } });
  assert.equal(upperBoundProvider.timeoutMs, 600_000);
  const invalidProvider = new HeadlessCodexImageProvider({ environment: { STUDIO_HEADLESS_IMAGEGEN: "1", STUDIO_HEADLESS_IMAGEGEN_TIMEOUT_MS: "not-a-number" } });
  assert.equal(invalidProvider.timeoutMs, 300_000);
});

function lockedCleanupError(code = "EBUSY") {
  const error = new Error(`cleanup ${code}`);
  error.code = code;
  return error;
}

test("headless provider retries every supported Windows cleanup lock without losing a valid PNG", async () => {
  for (const cleanupCode of ["EBUSY", "EPERM", "ENOTEMPTY"]) {
    const outputDirectory = await mkdtemp(join(tmpdir(), "ars-headless-provider-output-"));
    let invocation;
    let cleanupAttempts = 0;
    const delays = [];
    const provider = new HeadlessCodexImageProvider({
      environment: { STUDIO_HEADLESS_IMAGEGEN: "1" },
      outputDirectory,
      newId: () => `retry-${cleanupCode.toLowerCase()}`,
      run: async (call) => { invocation = call; await writeFile(call.outputPath, portraitPng()); return { exitCode: 0 }; },
      cleanup: async (workspace, options) => { cleanupAttempts += 1; if (cleanupAttempts < 3) throw lockedCleanupError(cleanupCode); return rm(workspace, options); },
      wait: async (milliseconds) => { delays.push(milliseconds); },
    });
    try {
      const asset = await provider.generateProbe();
      assert.equal(asset.generatedByAi, true);
      assert.equal(asset.cleanupWarning, undefined);
      assert.equal(cleanupAttempts, 3);
      assert.deepEqual(delays, [100, 200]);
      await assert.rejects(access(invocation.cwd));
    } finally { await rm(outputDirectory, { recursive: true, force: true }); }
  }
});

test("permanent cleanup failure returns a valid asset with a safe warning", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "ars-headless-provider-output-"));
  const leftovers = [];
  let cleanupAttempts = 0;
  const provider = new HeadlessCodexImageProvider({
    environment: { STUDIO_HEADLESS_IMAGEGEN: "1" },
    outputDirectory,
    newId: () => "warning-success",
    run: async (call) => { await writeFile(call.outputPath, portraitPng()); return { exitCode: 0 }; },
    cleanup: async (workspace) => { leftovers.push(workspace); cleanupAttempts += 1; throw lockedCleanupError(); },
    wait: async () => {},
  });
  try {
    const asset = await provider.generateProbe();
    assert.equal(asset.generatedByAi, true);
    assert.deepEqual({ code: asset.cleanupWarning.code, osCode: asset.cleanupWarning.osCode }, { code: "cleanup_warning", osCode: "EBUSY" });
    assert.equal(cleanupAttempts, 3);
    await access(join(outputDirectory, "probe-warning-success.png"));
  } finally { await Promise.all(leftovers.map((workspace) => cleanupProbeWorkspace({ workspace, temporaryDirectory: tmpdir() }))); await rm(outputDirectory, { recursive: true, force: true }); }
});

test("permanent cleanup failure preserves provider and validation errors", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "ars-headless-provider-output-"));
  const leftovers = [];
  const cleanup = async (workspace) => { leftovers.push(workspace); throw lockedCleanupError(); };
  const assertWarning = (expectedCode) => (error) => {
    assert.equal(error.code, expectedCode);
    assert.deepEqual({ code: error.cleanupWarning.code, osCode: error.cleanupWarning.osCode }, { code: "cleanup_warning", osCode: "EBUSY" });
    return true;
  };
  try {
    const providerFailure = new HeadlessCodexImageProvider({ environment: { STUDIO_HEADLESS_IMAGEGEN: "1" }, outputDirectory, cleanup, wait: async () => {}, run: async () => { throw new HeadlessImageProviderError("provider_timeout", "timed out"); } });
    await assert.rejects(providerFailure.generateProbe(), assertWarning("provider_timeout"));
    const validationFailure = new HeadlessCodexImageProvider({ environment: { STUDIO_HEADLESS_IMAGEGEN: "1" }, outputDirectory, cleanup, wait: async () => {}, run: async (call) => { await writeFile(call.outputPath, portraitPng(941, 1671)); return { exitCode: 0 }; } });
    await assert.rejects(validationFailure.generateProbe(), assertWarning("provider_invalid_output"));
  } finally { await Promise.all(leftovers.map((workspace) => cleanupProbeWorkspace({ workspace, temporaryDirectory: tmpdir() }))); await rm(outputDirectory, { recursive: true, force: true }); }
});

test("workspace cleanup rejects sibling and parent paths", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "ars-cleanup-root-"));
  const sibling = await mkdtemp(join(tmpdir(), "ars-headless-imagegen-sibling-"));
  const marker = join(sibling, "marker.txt");
  let cleanupCalled = false;
  try {
    await writeFile(marker, "keep");
    const warning = await cleanupProbeWorkspace({ workspace: sibling, temporaryDirectory, remove: async () => { cleanupCalled = true; } });
    assert.deepEqual({ code: warning.code, osCode: warning.osCode }, { code: "cleanup_target_invalid", osCode: "invalid_target" });
    assert.equal(cleanupCalled, false);
    await access(marker);
  } finally { await rm(temporaryDirectory, { recursive: true, force: true }); await rm(sibling, { recursive: true, force: true }); }
});
test("headless provider attaches an attested 2D input only to the Codex invocation", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "ars-headless-provider-output-"));
  let invocation;
  const phases = [];
  const reference = portraitPng();
  const provider = new HeadlessCodexImageProvider({
    environment: { STUDIO_HEADLESS_IMAGEGEN: "1" },
    outputDirectory,
    userOutputDirectory: join(outputDirectory, "user-photorealistic-stills"),
    newId: () => "user-photo",
    run: async (call) => {
      invocation = call;
      call.onStarted();
      const imageArgumentIndex = call.args.indexOf("--image");
      assert.equal(call.args.filter((argument) => argument === "--image").length, 1);
      assert.ok(imageArgumentIndex >= 0 && imageArgumentIndex < call.args.indexOf(call.prompt));
      assert.equal(call.args[imageArgumentIndex + 1], join(call.cwd, "source.png"));
      assert.deepEqual(await readFile(call.args[imageArgumentIndex + 1]), reference);
      await writeFile(call.outputPath, portraitPng(1080, 1920));
      return { exitCode: 0 };
    },
  });
  try {
    const asset = await provider.generateUserImage({ prompt: "Create an original adult-safe rain-lit portrait.", reference: { mimeType: "image/png", bytes: reference }, onPhase: (phase) => phases.push(phase) });
    assert.equal(asset.kind, "user_photorealistic_still");
    assert.equal(asset.aspectRatio, "9:16");
    assert.deepEqual(phases, ["workspace_prepared", "provider_started", "output_validated", "artifact_ready"]);
    assert.match(invocation.prompt, /original adult-safe rain-lit portrait/);
    assert.match(invocation.prompt, /Reference handling: use the attached user-attested original 2D image only through the requested visual domains/);
    assert.match(invocation.prompt, /First compare the source with that contract/);
    assert.match(invocation.prompt, /Follow the validated story direction for action, emotion, event/);
    assert.match(asset.notice, /attached to Codex/);
    await assert.rejects(access(invocation.cwd));
    await access(join(outputDirectory, "user-photorealistic-stills", "photo-user-photo.png"));
  } finally { await rm(outputDirectory, { recursive: true, force: true }); }
});
test("headless provider removes an attached 2D source when Codex fails", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "ars-headless-provider-output-"));
  let invocation;
  const phases = [];
  const provider = new HeadlessCodexImageProvider({
    environment: { STUDIO_HEADLESS_IMAGEGEN: "1" },
    outputDirectory,
    run: async (call) => {
      invocation = call;
      await access(call.args[call.args.indexOf("--image") + 1]);
      return { exitCode: 1, providerDiagnostics: { diagnosticCode: "provider_exit_nonzero", exitCode: 1, stderrBytes: 128, stderrTruncated: false } };
    },
  });
  try {
    await assert.rejects(provider.generateUserImage({ prompt: "Create an original adult-safe rain-lit portrait.", reference: { mimeType: "image/png", bytes: portraitPng() }, onPhase: (phase) => phases.push(phase) }), (error) => error instanceof HeadlessImageProviderError && error.code === "provider_failed" && error.providerDiagnostics?.diagnosticCode === "provider_exit_nonzero");
    assert.deepEqual(phases, ["workspace_prepared"]);
    await assert.rejects(access(invocation.cwd));
  } finally { await rm(outputDirectory, { recursive: true, force: true }); }
});
test("headless provider assembles a requested motion GIF only after validating the generated PNG", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "ars-headless-provider-output-"));
  const phases = [];
  let receivedSource;
  const provider = new HeadlessCodexImageProvider({
    environment: { STUDIO_HEADLESS_IMAGEGEN: "1" },
    outputDirectory,
    userOutputDirectory: join(outputDirectory, "stills"),
    motionGifOutputDirectory: join(outputDirectory, "gifs"),
    motionGifRenderer: { render: async ({ sourceBytes, frameCount, onFrame }) => {
      receivedSource = sourceBytes;
      onFrame({ currentFrame: 1, frameCount });
      onFrame({ currentFrame: frameCount, frameCount });
      return { bytes: Buffer.from("GIF89a"), mimeType: "image/gif", width: 432, height: 768, frameCount, fps: 10, durationSeconds: frameCount / 10, byteLength: 6 };
    } },
    newId: () => "motion-gif",
    run: async (call) => {
      call.onStarted();
      assert.equal(call.args.includes("--image"), false);
      await assert.rejects(access(join(call.cwd, "source.png")));
      await writeFile(call.outputPath, portraitPng(1080, 1920));
      return { exitCode: 0 };
    },
  });
  try {
    const asset = await provider.generateUserImage({ prompt: "Create an original adult-safe rain-lit portrait.", output: { kind: "motion_gif", frameCount: 12 }, onPhase: (...event) => phases.push(event) });
    assert.equal(asset.kind, "user_motion_gif");
    assert.equal(asset.mimeType, "image/gif");
    assert.equal(asset.frameCount, 12);
    assert.equal(asset.fps, 10);
    assert.equal(receivedSource.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), true);
    assert.deepEqual(phases.map(([phase]) => phase), ["workspace_prepared", "provider_started", "output_validated", "gif_encoding", "gif_encoding", "gif_encoding", "artifact_ready"]);
    await access(join(outputDirectory, "gifs", "photo-motion-gif.gif"));
  } finally { await rm(outputDirectory, { recursive: true, force: true }); }
});