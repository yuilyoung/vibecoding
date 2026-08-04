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