import assert from "node:assert/strict";
import test from "node:test";
import { StudioService } from "./studio-service.mjs";

const validRequest = { scene: "A commuter pauses at a rain-soaked station, then gives a hand-written apology to a friend before the final train departs.", sourceRelationship: "original", rightsAccepted: true, direction: "rainy-station" };
test("creates a local preflight record with a fixed 15-second vertical storyboard", () => { const result = new StudioService().createProject(validRequest); assert.equal(result.status, 201); assert.equal(result.project.status, "local_preflight_ready"); assert.equal(result.project.localPrecheck.status, "not_a_policy_decision"); assert.equal(result.project.storyboard.seconds, 15); assert.equal(result.project.storyboard.format, "1080x1920"); });
test("does not queue inspired material without rights review", () => { const service = new StudioService(); const created = service.createProject({ ...validRequest, sourceRelationship: "inspired" }); assert.equal(created.project.status, "review_required"); assert.equal(service.approveStoryboard(created.project.id).status, 409); });
test("blocks obvious protected-work, copied-scene, and real-person requests in local precheck", () => { const service = new StudioService(); for (const scene of ["원피스 루피가 등장하는 장면을 정확하게 재현해 줘. 카메라는 원작과 똑같이 움직인다.", "유명인 얼굴과 목소리로 실제 인터뷰 장면을 만들어 줘. 현실의 인물을 그대로 재현한다."]) { const result = service.createProject({ ...validRequest, scene }); assert.equal(result.status, 422); assert.equal(result.errors[0].field, "scene"); } });
test("stores reference input only as unverified metadata", () => { const result = new StudioService().createProject({ ...validRequest, referenceMedia: { name: "street-light.jpg", mimeType: "image/jpeg", purpose: "lighting" } }); assert.equal(result.status, 201); assert.equal(result.project.referenceMedia.transfer, "metadata_only"); assert.equal(result.project.referenceMedia.screening, "not_performed"); });
test("completes an original project with four fixed local 2D preview stills", () => {
  const scheduled = [];
  const service = new StudioService({ schedule: (work) => scheduled.push(work) });
  const created = service.createProject({ ...validRequest, referenceMedia: { name: "street-light.jpg", mimeType: "image/jpeg", purpose: "lighting" } });
  assert.equal(service.approveStoryboard(created.project.id).status, 202);
  const queued = service.getProject(created.project.id).project;
  assert.equal(queued.status, "queued");
  assert.equal(queued.job.status, "queued");
  assert.equal(queued.job.progress, 0);
  scheduled.shift()();
  const inProgress = service.getProject(created.project.id).project;
  assert.equal(inProgress.status, "in_progress");
  assert.equal(inProgress.job.status, "in_progress");
  assert.equal(inProgress.job.progress, 58);
  scheduled.shift()();
  const project = service.getProject(created.project.id).project;
  assert.equal(project.status, "completed");
  assert.equal(project.job.status, "completed");
  assert.equal(project.job.progress, 100);
  assert.equal(project.delivery.mode, "local_2d_preview");
  assert.equal(project.delivery.assets.length, 4);
  for (const asset of project.delivery.assets) {
    assert.equal(asset.kind, "local_2d_preview");
    assert.equal(asset.origin, "fixed_local_template");
    assert.equal(asset.generatedByAi, false);
    assert.equal(asset.mimeType, "image/svg+xml");
    assert.equal(asset.width, 1080);
    assert.equal(asset.height, 1920);
    assert.equal(asset.aspectRatio, "9:16");
    assert.equal(typeof asset.captionDraft, "string");
    const markup = decodeURIComponent(asset.dataUri.split(",", 2)[1]);
    assert.equal(markup.includes(validRequest.scene), false);
    assert.equal(markup.includes("street-light.jpg"), false);
  }
});

const nextTick = () => new Promise((resolve) => setImmediate(resolve));
const fixedProbeAsset = (id, cleanupWarning) => ({ id, mimeType: "image/png", width: 9, height: 16, targetAspectRatio: "9:16", returnedAspectRatio: "9:16", dataUri: "data:image/png;base64,AA==", ...(cleanupWarning ? { cleanupWarning } : {}) });

test("requires a local capability and allows one completed probe to be explicitly retried", async () => {
  let called = 0;
  let resolveProbe;
  const provider = {
    status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
    generateProbe: () => { called += 1; return new Promise((resolve) => { resolveProbe = resolve; }); },
  };
  const service = new StudioService({ headlessImageProvider: provider, createLocalCapabilityToken: () => "test-local-token", maxHeadlessImageProbeAttempts: 2 });
  assert.equal(service.startHeadlessImageSpike().status, 403);
  const initial = service.getHeadlessImageSpike();
  assert.equal(initial.capabilityToken, "test-local-token");
  assert.equal(initial.remainingAttempts, 2);
  const started = service.startHeadlessImageSpike(initial.capabilityToken);
  assert.equal(started.status, 202);
  assert.equal(started.remainingAttempts, 1);
  const duplicate = service.startHeadlessImageSpike(initial.capabilityToken);
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.error, "probe_in_flight");
  await nextTick();
  assert.equal(called, 1);
  resolveProbe(fixedProbeAsset("fixed-one", { code: "EBUSY", workspace: "ars-probe-1" }));
  await nextTick();
  const firstCompleted = service.getHeadlessImageSpike().generation;
  assert.equal(firstCompleted.status, "completed");
  assert.equal(firstCompleted.id, "headless-0001");
  assert.equal(service.headlessImageProbeActiveAttemptId, null);
  assert.equal(service.headlessImageProbeHistory.length, 1);
  assert.deepEqual(service.headlessImageProbeHistory[0].dimensions, { width: 9, height: 16, targetAspectRatio: "9:16", returnedAspectRatio: "9:16" });
  assert.deepEqual(service.headlessImageProbeHistory[0].cleanupWarning, { code: "EBUSY", workspace: "ars-probe-1" });
  assert.equal(JSON.stringify(service.headlessImageProbeHistory).includes("data:image"), false);
  const retried = service.startHeadlessImageSpike(initial.capabilityToken);
  assert.equal(retried.status, 202);
  assert.equal(retried.generation.id, "headless-0002");
  assert.equal(retried.remainingAttempts, 0);
  await nextTick();
  assert.equal(called, 2);
  resolveProbe(fixedProbeAsset("fixed-two"));
  await nextTick();
  assert.equal(service.getHeadlessImageSpike().generation.status, "completed");
  assert.deepEqual(service.headlessImageProbeHistory.map((attempt) => attempt.id), ["headless-0001", "headless-0002"]);
  const exhausted = service.startHeadlessImageSpike(initial.capabilityToken);
  assert.equal(exhausted.status, 429);
  assert.equal(exhausted.error, "probe_allowance_exhausted");
  assert.equal(called, 2);
});

test("reports an explicit disabled headless provider state after local capability validation", () => {
  const provider = { status: () => ({ enabled: false, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "disabled" }), generateProbe: async () => { throw new Error("must not run"); } };
  const service = new StudioService({ headlessImageProvider: provider, createLocalCapabilityToken: () => "test-local-token" });
  assert.equal(service.startHeadlessImageSpike().status, 403);
  const result = service.startHeadlessImageSpike("test-local-token");
  assert.equal(result.status, 503);
  assert.equal(result.error, "provider_not_configured");
});

test("reports queued, generating, and completed headless image milestones", async () => {
  let resolveProbe;
  const result = new Promise((resolve) => { resolveProbe = resolve; });
  const provider = { status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }), generateProbe: () => result };
  const service = new StudioService({ headlessImageProvider: provider, createLocalCapabilityToken: () => "test-local-token" });
  const started = service.startHeadlessImageSpike("test-local-token");
  assert.deepEqual(started.generation.job, { mode: "developer_image_probe", phase: "queued", progress: 0 });
  await nextTick();
  assert.deepEqual(service.getHeadlessImageSpike().generation.job, { mode: "developer_image_probe", phase: "generating", progress: 50 });
  resolveProbe(fixedProbeAsset("probe"));
  await nextTick();
  const completed = service.getHeadlessImageSpike().generation;
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.job, { mode: "developer_image_probe", phase: "completed", progress: 100 });
});

test("releases the in-flight lock after a provider failure", async () => {
  let calls = 0;
  const provider = {
    status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
    generateProbe: () => { calls += 1; return calls === 1 ? Promise.reject(new Error("provider unavailable")) : Promise.resolve(fixedProbeAsset("retry")); },
  };
  const service = new StudioService({ headlessImageProvider: provider, createLocalCapabilityToken: () => "test-local-token" });
  service.startHeadlessImageSpike("test-local-token");
  await nextTick();
  const failed = service.getHeadlessImageSpike().generation;
  assert.equal(failed.status, "failed");
  assert.deepEqual(failed.job, { mode: "developer_image_probe", phase: "failed", progress: 50 });
  assert.equal(failed.asset, null);
  assert.deepEqual(failed.error, { code: "provider_failed", message: "provider unavailable" });
  const retry = service.startHeadlessImageSpike("test-local-token");
  assert.equal(retry.status, 202);
  await nextTick();
  assert.equal(service.getHeadlessImageSpike().generation.status, "completed");
});
const validPhotoConditions = { subject: "fictional_adult", age: "adult_30s", era: "contemporary", setting: "city_night", presentation: "unspecified", framing: "upper_body", cameraAngle: "three_quarter", clothing: "casual", peopleCount: "one" };
const validPhotoDraft = { mode: "text_to_photo", detailPrompt: "A fictional adult waits beneath rain reflections on an original city street, with cinematic but natural lighting.", conditions: validPhotoConditions, rightsAccepted: true, clientRequestId: "photo-request-0001" };
const validPngDataUrl = "data:image/png;base64,iVBORw0KGgo=";

test("creates a trusted-local photo job with observed lifecycle phases and no source-data leak", async () => {
  const scheduled = [];
  let resolveGeneration;
  let time = Date.parse("2026-08-05T12:00:00.000Z");
  let received;
  const provider = {
    status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
    generateUserImage: ({ prompt, reference, onPhase }) => {
      received = { prompt, reference };
      onPhase("workspace_prepared");
      onPhase("provider_started");
      return new Promise((resolve) => { resolveGeneration = resolve; });
    },
  };
  const service = new StudioService({ now: () => new Date(time), schedule: (work) => scheduled.push(work), headlessImageProvider: provider });
  const created = service.createPhotorealisticProject({ ...validPhotoDraft, mode: "animation_2d_to_photo", clientRequestId: "photo-request-0002", referenceImage: { mimeType: "image/png", dataUrl: validPngDataUrl } });
  assert.equal(created.status, 202);
  assert.equal(created.project.status, "queued");
  assert.equal(created.project.job.phase, "validated");
  assert.equal(created.project.job.progressBasis, "observed_server_lifecycle");
  assert.equal(JSON.stringify(created.project).includes("data:image"), false);
  scheduled.shift()();
  await nextTick();
  const active = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(active.status, "in_progress");
  assert.equal(active.job.phase, "provider_started");
  assert.equal(active.job.progress, 55);
  assert.equal(active.job.observedProgress, 55);
  assert.equal(active.job.forecastHighWater, 0);
  assert.equal(active.job.estimatedRemainingSeconds, null);
  assert.equal(active.job.etaState, "awaiting_observed_samples");
  assert.equal(received.reference.mimeType, "image/png");
  assert.equal(received.prompt.includes("A fictional adult waits"), true);
  time += 12_000;
  assert.equal(service.getPhotorealisticProject(created.project.id).project.job.estimatedRemainingSeconds, null);
  resolveGeneration({ id: "photo-result", kind: "user_photorealistic_still", origin: "codex_headless_imagegen", generatedByAi: true, mimeType: "image/png", width: 9, height: 16, aspectRatio: "9:16", dataUri: "data:image/png;base64,AA==", notice: "test" });
  await nextTick();
  const completed = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(completed.status, "completed");
  assert.equal(completed.job.phase, "completed");
  assert.equal(completed.job.estimatedRemainingSeconds, 0);
  assert.equal(completed.delivery.asset.generatedByAi, true);
  assert.equal(JSON.stringify(completed.audit).includes("data:image"), false);
  const duplicate = service.createPhotorealisticProject({ ...validPhotoDraft, mode: "animation_2d_to_photo", clientRequestId: "photo-request-0002", referenceImage: { mimeType: "image/png", dataUrl: validPngDataUrl } });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.error, "duplicate_submission");
});

test("rejects unsafe, invalid, and unconfigured real-image requests without starting a provider", () => {
  let called = 0;
  const disabled = new StudioService({ headlessImageProvider: { status: () => ({ enabled: false, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "disabled" }), generateUserImage: () => { called += 1; } } });
  const unavailable = disabled.createPhotorealisticProject(validPhotoDraft);
  assert.equal(unavailable.status, 503);
  assert.equal(called, 0);
  const service = new StudioService({ headlessImageProvider: { status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }), generateUserImage: () => { called += 1; } } });
  const missingSource = service.createPhotorealisticProject({ ...validPhotoDraft, mode: "animation_2d_to_photo", clientRequestId: "photo-request-0003" });
  assert.equal(missingSource.status, 422);
  assert.equal(missingSource.errors.some((entry) => entry.code === "reference_format"), true);
  const unsafe = service.createPhotorealisticProject({ ...validPhotoDraft, detailPrompt: "Create an explicit nude child portrait in a realistic style with visible details.", clientRequestId: "photo-request-0004" });
  assert.equal(unsafe.status, 422);
  assert.equal(unsafe.errors.some((entry) => entry.code.includes("unsafe")), true);
  assert.equal(called, 0);
});
test("calculates server-side gradual forecast progress only after matching observed samples and keeps terminal completion exact", async () => {
  const scheduled = [];
  let resolveGeneration;
  let time = Date.parse("2026-08-05T12:00:00.000Z");
  const provider = {
    status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
    generateUserImage: ({ onPhase }) => {
      onPhase("workspace_prepared");
      onPhase("provider_started");
      return new Promise((resolve) => { resolveGeneration = resolve; });
    },
  };
  const service = new StudioService({ now: () => new Date(time), schedule: (work) => scheduled.push(work), headlessImageProvider: provider });
  assert.equal(service.forecastPhotorealisticProgress(61, 75), 73);
  service.photorealisticDurationSamples = [{ bucket: "text_to_photo_still", seconds: 60 }, { bucket: "text_to_photo_still", seconds: 75 }];
  assert.equal(service.estimatedPhotorealisticDurationSeconds({ kind: "still" }, "text_to_photo"), null);
  service.photorealisticDurationSamples.push({ bucket: "text_to_photo_still", seconds: 90 });
  const created = service.createPhotorealisticProject({ ...validPhotoDraft, clientRequestId: "photo-request-0005" });
  scheduled.shift()();
  await nextTick();
  time += 60_000;
  const forecast = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(forecast.job.estimatedDurationSeconds, 75);
  assert.equal(forecast.job.estimatedRemainingSeconds, 15);
  assert.equal(forecast.job.etaState, "estimated");
  assert.equal(forecast.job.progressBasis, "server_lifecycle_and_duration_forecast");
  assert.equal(forecast.job.progress, 72);
  assert.equal(forecast.job.observedProgress, 55);
  assert.equal(forecast.job.forecastHighWater, 72);
  time -= 10_000;
  const clockRollback = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(clockRollback.job.elapsedSeconds, 60);
  assert.equal(clockRollback.job.estimatedRemainingSeconds, 15);
  assert.equal(clockRollback.job.progress, 72);
  time += 26_000;
  const overdue = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(overdue.job.estimatedRemainingSeconds, null);
  assert.equal(overdue.job.etaState, "estimate_exceeded");
  assert.equal(overdue.job.progressBasis, "server_lifecycle_and_duration_forecast");
  assert.equal(overdue.job.progress, 90);
  resolveGeneration({ id: "photo-result-warning", kind: "user_photorealistic_still", origin: "codex_headless_imagegen", generatedByAi: true, mimeType: "image/png", width: 9, height: 16, aspectRatio: "9:16", dataUri: "data:image/png;base64,AA==", notice: "test", cleanupWarning: { code: "cleanup_warning", osCode: "EBUSY", workspace: "ars-headless-imagegen-test" } });
  await nextTick();
  const completed = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(completed.job.elapsedSeconds, 76);
  assert.equal(completed.job.progress, 100);
  assert.equal(completed.job.progressBasis, "observed_server_lifecycle");
  assert.deepEqual(completed.delivery.asset.cleanupWarning, { code: "cleanup_warning", osCode: "EBUSY", workspace: "ars-headless-imagegen-test" });
  time += 20_000;
  assert.equal(service.getPhotorealisticProject(created.project.id).project.job.elapsedSeconds, 76);
});

test("records an asynchronous trusted-local photo provider failure with a safe cleanup warning", async () => {
  const scheduled = [];
  const cleanupWarning = { code: "cleanup_warning", osCode: "EBUSY", workspace: "ars-headless-imagegen-test" };
  const unsafeProviderDiagnostics = { diagnosticCode: "provider_exit_nonzero", exitCode: 1, elapsedSeconds: 2, stderrBytes: 91, stderrTruncated: false, stderrText: "data:image/png;base64,private", sourcePath: "C:\\Temp\\source.png" };
  const provider = {
    status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
    generateUserImage: async ({ onPhase }) => {
      onPhase("workspace_prepared");
      onPhase("provider_started");
      onPhase("completed");
      throw Object.assign(new Error("The local provider stopped after starting."), { cleanupWarning, providerDiagnostics: unsafeProviderDiagnostics });
    },
  };
  const service = new StudioService({ schedule: (work) => scheduled.push(work), headlessImageProvider: provider });
  const created = service.createPhotorealisticProject({ ...validPhotoDraft, clientRequestId: "photo-request-0006" });
  assert.equal(created.status, 202);
  scheduled.shift()();
  await nextTick();
  const failed = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(failed.status, "failed");
  assert.equal(failed.job.phase, "failed");
  assert.equal(failed.job.progress < 100, true);
  assert.equal(failed.job.progress, 55);
  assert.equal(failed.error.code, "provider_failed");
  assert.deepEqual(failed.error.cleanupWarning, cleanupWarning);
  assert.deepEqual(failed.error.providerDiagnostics, { diagnosticCode: "provider_exit_nonzero", exitCode: 1, elapsedSeconds: 2, stderrBytes: 91, stderrTruncated: false });
  assert.equal(failed.audit.at(-1).diagnosticCode, "provider_exit_nonzero");
  assert.equal(JSON.stringify({ error: failed.error, audit: failed.audit }).includes("data:image"), false);
  assert.deepEqual(service.photorealisticDurationSamples, []);
});
test("creates a motion GIF job with observed frame encoding and a terminal-only 100 percent result", async () => {
  const scheduled = [];
  let resolveGeneration;
  let requestedOutput;
  const provider = {
    status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
    generateUserImage: ({ output, onPhase }) => {
      requestedOutput = output;
      onPhase("workspace_prepared");
      onPhase("provider_started");
      onPhase("output_validated");
      onPhase("gif_encoding", { currentFrame: 0, frameCount: output.frameCount });
      onPhase("gif_encoding", { currentFrame: output.frameCount, frameCount: output.frameCount });
      return new Promise((resolve) => { resolveGeneration = resolve; });
    },
  };
  const service = new StudioService({ schedule: (work) => scheduled.push(work), headlessImageProvider: provider });
  const created = service.createPhotorealisticProject({ ...validPhotoDraft, outputKind: "motion_gif", frameCount: 12, clientRequestId: "photo-motion-gif-0001" });
  assert.equal(created.status, 202);
  assert.deepEqual(created.project.output, { kind: "motion_gif", frameCount: 12, fps: 10 });
  assert.equal(created.project.job.progress, 10);
  scheduled.shift()();
  await nextTick();
  const encoding = service.getPhotorealisticProject(created.project.id).project;
  assert.deepEqual(requestedOutput, { kind: "motion_gif", frameCount: 12, fps: 10 });
  assert.equal(encoding.status, "in_progress");
  assert.equal(encoding.job.phase, "gif_encoding");
  assert.equal(encoding.job.encodedFrameCount, 12);
  assert.equal(encoding.job.progress, 99);
  resolveGeneration({ id: "gif-result", kind: "user_motion_gif", origin: "local_motion_gif_from_generated_still", generatedByAi: true, mimeType: "image/gif", width: 432, height: 768, aspectRatio: "9:16", frameCount: 12, fps: 10, durationSeconds: 1.2, byteLength: 1024, dataUri: "data:image/gif;base64,R0lGODlh", notice: "motion test" });
  await nextTick();
  const completed = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(completed.status, "completed");
  assert.equal(completed.job.progress, 100);
  assert.equal(completed.delivery.asset.mimeType, "image/gif");
  assert.equal(completed.delivery.asset.frameCount, 12);
  assert.equal(JSON.stringify(completed.audit).includes("data:image"), false);
});

test("rejects out-of-range motion GIF frame counts before provider start", () => {
  let called = 0;
  const service = new StudioService({ headlessImageProvider: { status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }), generateUserImage: () => { called += 1; } } });
  const invalid = service.createPhotorealisticProject({ ...validPhotoDraft, outputKind: "motion_gif", frameCount: 31, clientRequestId: "photo-motion-gif-0002" });
  assert.equal(invalid.status, 422);
  assert.equal(invalid.errors.some((entry) => entry.code === "photo_frame_count"), true);
  assert.equal(called, 0);
});