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

test("keeps user-selected 2D visual anchors subordinate to story direction", () => {
  const provider = { status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }), generateUserImage: () => Promise.resolve() };
  const service = new StudioService({ schedule: () => {}, headlessImageProvider: provider });
  const focus = { preserveSubjectVisuals: true, preserveBackgroundLayout: false, preserveCameraComposition: true };
  const selected = service.createPhotorealisticProject({ ...validPhotoDraft, mode: "animation_2d_to_photo", clientRequestId: "photo-focus-0001", referenceImage: { mimeType: "image/png", dataUrl: validPngDataUrl }, referenceFocus: focus });
  assert.equal(selected.status, 202);
  assert.deepEqual(selected.project.source.focus, focus);
  assert.match(selected.project.composedPrompt, /Story direction \(authoritative for action, emotion, event, and intended scene change\)/);
  assert.match(selected.project.composedPrompt, /fictional-adult silhouette and pose/);
  assert.match(selected.project.composedPrompt, /camera angle, framing, perspective, and composition/);
  assert.doesNotMatch(selected.project.composedPrompt, /background setting, spatial layout, focal-object placement/);
  const defaulted = service.createPhotorealisticProject({ ...validPhotoDraft, mode: "animation_2d_to_photo", clientRequestId: "photo-focus-0002", referenceImage: { mimeType: "image/png", dataUrl: validPngDataUrl } });
  assert.equal(defaulted.status, 202);
  assert.deepEqual(defaulted.project.source.focus, { preserveSubjectVisuals: true, preserveBackgroundLayout: true, preserveCameraComposition: true });
  const empty = service.createPhotorealisticProject({ ...validPhotoDraft, mode: "animation_2d_to_photo", clientRequestId: "photo-focus-0003", referenceImage: { mimeType: "image/png", dataUrl: validPngDataUrl }, referenceFocus: { preserveSubjectVisuals: false, preserveBackgroundLayout: false, preserveCameraComposition: false } });
  assert.equal(empty.status, 422);
  assert.equal(empty.errors.some((entry) => entry.code === "reference_focus_empty"), true);
  const textOnly = service.createPhotorealisticProject({ ...validPhotoDraft, clientRequestId: "photo-focus-0004", referenceFocus: focus });
  assert.equal(textOnly.status, 422);
  assert.equal(textOnly.errors.some((entry) => entry.code === "reference_focus_mode"), true);
});

test("creates a trusted-local photo job with observed lifecycle phases and no source-data leak", async () => {
  const scheduled = [];
  let resolveGeneration;
  let reportPhase;
  let time = Date.parse("2026-08-05T12:00:00.000Z");
  let received;
  const provider = {
    status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
    generateUserImage: ({ prompt, reference, onPhase }) => {
      reportPhase = onPhase;
      received = { prompt, reference };
      onPhase("workspace_prepared");
      return new Promise((resolve) => { resolveGeneration = resolve; });
    },
  };
  const service = new StudioService({ now: () => new Date(time), schedule: (work) => scheduled.push(work), headlessImageProvider: provider });
  const created = service.createPhotorealisticProject({ ...validPhotoDraft, mode: "animation_2d_to_photo", clientRequestId: "photo-request-0002", referenceImage: { mimeType: "image/png", dataUrl: validPngDataUrl } });
  assert.equal(created.status, 202);
  assert.equal(created.project.status, "queued");
  assert.equal(created.project.job.phase, "validated");
  assert.equal(created.project.job.progress, 0);
  assert.equal(created.project.job.progressBasis, "observed_server_lifecycle");
  assert.equal(JSON.stringify(created.project).includes("data:image"), false);
  scheduled.shift()();
  await nextTick();
  time += 30_000;
  reportPhase("provider_started");
  const active = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(active.status, "in_progress");
  assert.equal(active.job.phase, "provider_started");
  assert.equal(active.job.progress, 5);
  assert.equal(active.job.observedProgress, 5);
  assert.equal(active.job.forecastHighWater, 5);
  assert.equal(active.job.elapsedSeconds, 30);
  assert.equal(active.job.forecastElapsedSeconds, 0);
  assert.equal(active.job.forecastStartedAt, "2026-08-05T12:00:30.000Z");
  assert.equal(active.job.estimatedDurationSeconds, 315);
  assert.equal(active.job.estimatedRemainingSeconds, 315);
  assert.equal(active.job.etaState, "bootstrap");
  assert.equal(active.job.etaSource, "bucket_bootstrap");
  assert.equal(active.job.progressBasis, "server_lifecycle_and_duration_forecast");
  assert.equal(received.reference.mimeType, "image/png");
  assert.equal(received.prompt.includes("A fictional adult waits"), true);
  time += 190_000;
  const bootstrapForecast = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(bootstrapForecast.job.estimatedRemainingSeconds, 125);
  assert.equal(bootstrapForecast.job.progress, 65);
  reportPhase("output_validated");
  const outputValidated = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(outputValidated.job.phase, "output_validated");
  assert.equal(outputValidated.job.progress, 90);
  assert.equal(outputValidated.job.finalizationState, "validating_image");
  reportPhase("artifact_ready");
  const artifactReady = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(artifactReady.job.phase, "artifact_ready");
  assert.equal(artifactReady.job.progress, 90);
  assert.equal(artifactReady.job.finalizationState, "saving_artifact");
  resolveGeneration({ id: "photo-result", kind: "user_photorealistic_still", origin: "codex_headless_imagegen", generatedByAi: true, mimeType: "image/png", width: 9, height: 16, aspectRatio: "9:16", dataUri: "data:image/png;base64,AA==", notice: "test" });
  await nextTick();
  const completed = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(completed.status, "completed");
  assert.equal(completed.job.phase, "completed");
  assert.equal(completed.job.finalizationState, "terminal");
  assert.equal(completed.job.estimatedRemainingSeconds, 0);
  assert.equal(completed.job.forecastElapsedSeconds, 190);
  assert.equal(service.photorealisticDurationSamples.at(-1).seconds, 190);
  assert.equal(completed.delivery.asset.generatedByAi, true);
  assert.equal(JSON.stringify(completed.audit).includes("data:image"), false);
  const duplicate = service.createPhotorealisticProject({ ...validPhotoDraft, mode: "animation_2d_to_photo", clientRequestId: "photo-request-0002", referenceImage: { mimeType: "image/png", dataUrl: validPngDataUrl } });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.error, "duplicate_submission");
});

test("allows non-graphic adult sensual styling while rejecting minor, explicit, and age-coded requests", () => {
  let called = 0;
  const disabled = new StudioService({ headlessImageProvider: { status: () => ({ enabled: false, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "disabled" }), generateUserImage: () => { called += 1; } } });
  const unavailable = disabled.createPhotorealisticProject(validPhotoDraft);
  assert.equal(unavailable.status, 503);
  assert.equal(called, 0);
  const service = new StudioService({ schedule() {}, headlessImageProvider: { status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }), generateUserImage: () => { called += 1; } } });
  const missingSource = service.createPhotorealisticProject({ ...validPhotoDraft, mode: "animation_2d_to_photo", clientRequestId: "photo-request-0003" });
  assert.equal(missingSource.status, 422);
  assert.equal(missingSource.errors.some((entry) => entry.code === "reference_format"), true);
  const unsafe = service.createPhotorealisticProject({ ...validPhotoDraft, detailPrompt: "Create an explicit nude child portrait in a realistic style with visible details.", clientRequestId: "photo-request-0004" });
  assert.equal(unsafe.status, 422);
  assert.equal(unsafe.errors.some((entry) => entry.code.includes("minor_or_ambiguous_blocked")), true);
  assert.equal(unsafe.errors.some((entry) => entry.code.includes("explicit_sex_blocked")), true);
  const erotic = service.createPhotorealisticProject({ ...validPhotoDraft, detailPrompt: "Create a fictional adult posing seductively for erotic glamour photography.", clientRequestId: "photo-request-0004-erotic" });
  assert.equal(erotic.status, 202);
  const ordinaryAdult = service.createPhotorealisticProject({ ...validPhotoDraft, detailPrompt: "A fictional adult poses seductively in an original non-graphic editorial.", clientRequestId: "photo-request-0004-ordinary-adult" });
  assert.equal(ordinaryAdult.status, 202);
  const koreanAllowed = service.createPhotorealisticProject({ ...validPhotoDraft, detailPrompt: "20세 이상 비식별 가상 성인이 관능적이고 유혹적인 성적 표현을 하는 비노골적 장면입니다.", clientRequestId: "photo-request-0004-korean" });
  assert.equal(koreanAllowed.status, 202);
  const koreanExplicit = service.createPhotorealisticProject({ ...validPhotoDraft, detailPrompt: "20세 이상 가상 성인의 노골적 성행위와 포르노 장면을 만들어 주세요.", clientRequestId: "photo-request-0004-explicit" });
  assert.equal(koreanExplicit.status, 422);
  assert.equal(koreanExplicit.errors.some((entry) => entry.code.includes("explicit_sex_blocked")), true);
  const ageAmbiguous = service.createPhotorealisticProject({ ...validPhotoDraft, detailPrompt: "Create a sensual portrait of a young-looking age-ambiguous person.", clientRequestId: "photo-request-0004-ambiguous" });
  assert.equal(ageAmbiguous.status, 422);
  assert.equal(ageAmbiguous.errors.some((entry) => entry.code.includes("minor_or_ambiguous_blocked")), true);
  const ageCoded = service.createPhotorealisticProject({ ...validPhotoDraft, detailPrompt: "A fictional adult wears a school uniform in seductive erotic glamour styling.", clientRequestId: "photo-request-0004-age-coded" });
  assert.equal(ageCoded.status, 422);
  assert.equal(ageCoded.errors.some((entry) => entry.code.includes("age_coded_sexualization_blocked")), true);
  const noPersonSensual = service.createPhotorealisticProject({ ...validPhotoDraft, conditions: { ...validPhotoDraft.conditions, subject: "no_person", age: "not_applicable", peopleCount: "zero" }, detailPrompt: "Create a sensual and erotic lingerie styling scene without a fictional adult subject.", clientRequestId: "photo-request-0004-no-person" });
  assert.equal(noPersonSensual.status, 422);
  assert.equal(noPersonSensual.errors.some((entry) => entry.code === "photo_adult_subject_required"), true);
  for (const [index, detailPrompt] of [
    "A fictional eighteen years old woman poses seductively.",
    "A fictional 18 yrs old woman poses seductively.",
    "A fictional adult age 20+ is having sex in an erotic scene.",
    "A fictional adult age 20+ performs intercourse in a sensual scene.",
    "20세 이상 가상 성인이 성관계를 하는 에로틱 장면입니다.",
    "A fictional adult is forced to pose seductively against her will.",
    "20세 이상 가상 성인이 억지로 관능적인 포즈를 취합니다.",
    "Emma Watson poses in seductive lingerie styling.",
    "아이유가 관능적인 화보를 촬영합니다.",
    "A fictional baby poses seductively in an erotic portrait.",
    "A fictional teenaged person poses seductively in lingerie.",
    "A fictional adult age nineteen poses seductively.",
    "A fictional adult aged 19 poses seductively.",
    "A fictional adult 19 yrs poses seductively.",
    "A fictional adult 19 years poses seductively.",
    "A fictional adult aged seventeen poses seductively.",
    "A fictional adult age: 19 poses seductively.",
    "A fictional adult aged:19 poses seductively.",
    "A fictional adult 19 y.o. poses seductively.",
    "A fictional adult under 20 poses seductively.",
    "A fictional adult poses in sexually explicit content.",
    "A fictional adult appears in an explicitly sexual scene.",
    "A fictional adult poses seductively without her consent.",
    "A fictional adult is made to pose seductively.",
    "A fictional adult wears lingerie against their consent.",
    "A fictional adult poses seductively with no consent.",
    "A fictional adult poses seductively without permission.",
    "A fictional adult poses seductively against her wishes.",
    "A fictional adult age 20+ stars in an adult film.",
    "A fictional adult resembling Zendaya wears casual clothing.",
    "A fictional adult looks like Madonna in a city.",
    "A non-fictional adult poses seductively.",
    "A not fictional adult poses in sensual lingerie.",
    "A not a fictional adult poses in sensual lingerie.",
    "A non-identifying portrait of my friend in sensual styling.",
    "A fictional adult, actually a real adult, poses seductively.",
    "A fictional adult based on my real friend poses seductively.",
    "가상이 아닌 실제 성인이 관능적인 화보를 촬영합니다.",
    "나의 실제 친구를 기반으로 한 가상 성인이 관능적으로 포즈를 취합니다.",
    "가상 유아가 관능적인 란제리 화보를 촬영합니다.",
    "Zendaya poses seductively in an adult lingerie portrait.",
    "손예진이 관능적인 성인 화보를 촬영합니다.",
  ].entries()) {
    const blocked = service.createPhotorealisticProject({ ...validPhotoDraft, detailPrompt, clientRequestId: `photo-policy-regression-${index}` });
    assert.equal(blocked.status, 422);
  }
  const koreanAdultTwenty = service.createPhotorealisticProject({ ...validPhotoDraft, detailPrompt: "20살 이상 비식별 가상 성인이 관능적인 비노골적 화보를 촬영합니다.", clientRequestId: "photo-policy-adult-twenty" });
  assert.equal(koreanAdultTwenty.status, 202);
  assert.match(erotic.project.composedPrompt, /fictional adults age 20\+/);
  assert.match(erotic.project.composedPrompt, /consensual and non-graphic/);
  assert.equal(called, 0);
});
test("rejects subject and age mismatches before starting the image provider", () => {
  let called = 0;
  const service = new StudioService({
    schedule() {},
    headlessImageProvider: {
      status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
      generateUserImage: () => { called += 1; },
    },
  });
  const adultWithoutAge = service.createPhotorealisticProject({
    ...validPhotoDraft,
    conditions: { ...validPhotoDraft.conditions, subject: "fictional_adult", age: "not_applicable" },
    clientRequestId: "photo-age-mismatch-adult",
  });
  assert.equal(adultWithoutAge.status, 422);
  assert.equal(adultWithoutAge.errors.some((entry) => entry.code === "photo_age_mismatch"), true);

  const emptySceneWithAge = service.createPhotorealisticProject({
    ...validPhotoDraft,
    conditions: { ...validPhotoDraft.conditions, subject: "no_person", age: "adult_20s", peopleCount: "zero" },
    clientRequestId: "photo-age-mismatch-empty",
  });
  assert.equal(emptySceneWithAge.status, 422);
  assert.equal(emptySceneWithAge.errors.some((entry) => entry.code === "photo_age_mismatch"), true);

  const emptySceneWithPersonStory = service.createPhotorealisticProject({
    ...validPhotoDraft,
    conditions: { ...validPhotoDraft.conditions, subject: "no_person", age: "not_applicable", peopleCount: "zero" },
    detailPrompt: "A fictional adult waits calmly in the city while the rain falls.",
    clientRequestId: "photo-subject-mismatch-empty",
  });
  assert.equal(emptySceneWithPersonStory.status, 422);
  assert.equal(emptySceneWithPersonStory.errors.some((entry) => entry.code === "photo_subject_mismatch"), true);

  const emptySceneWithRoleStory = service.createPhotorealisticProject({
    ...validPhotoDraft,
    conditions: { ...validPhotoDraft.conditions, subject: "no_person", age: "not_applicable", peopleCount: "zero" },
    detailPrompt: "A fictional police officer watches the original city street in the rain.",
    clientRequestId: "photo-subject-mismatch-role",
  });
  assert.equal(emptySceneWithRoleStory.status, 422);
  assert.equal(emptySceneWithRoleStory.errors.some((entry) => entry.code === "photo_subject_mismatch"), true);

  const emptyScene = service.createPhotorealisticProject({
    ...validPhotoDraft,
    conditions: { ...validPhotoDraft.conditions, subject: "no_person", age: "not_applicable", peopleCount: "zero" },
    detailPrompt: "An original rain-soaked city street with no people and cinematic reflections.",
    clientRequestId: "photo-empty-scene-valid",
  });
  assert.equal(emptyScene.status, 202);
  assert.match(emptyScene.project.composedPrompt, /No people or human characters may appear/);
  assert.equal(called, 0);
});
test("preserves zero when process permission fails before provider spawn", async () => {
  const scheduled = [];
  const provider = {
    status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
    generateUserImage: () => {
      throw Object.assign(new Error("Codex headless execution could not be started."), {
        code: "provider_unavailable",
        providerDiagnostics: { diagnosticCode: "process_permission_denied", elapsedSeconds: 0, stderrBytes: 0, stderrTruncated: false },
      });
    },
  };
  const service = new StudioService({ schedule: (work) => scheduled.push(work), headlessImageProvider: provider });
  const created = service.createPhotorealisticProject({ ...validPhotoDraft, clientRequestId: "photo-permission-before-spawn" });
  assert.equal(created.project.job.progress, 0);
  scheduled.shift()();
  await nextTick();
  const failed = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(failed.status, "failed");
  assert.equal(failed.job.progress, 0);
  assert.equal(failed.error.code, "provider_unavailable");
  assert.equal(failed.error.providerDiagnostics.diagnosticCode, "process_permission_denied");
});
test("preserves five percent when process permission fails after provider spawn", async () => {
  const scheduled = [];
  const provider = {
    status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
    generateUserImage: ({ onPhase }) => {
      onPhase("workspace_prepared");
      onPhase("provider_started");
      return Promise.reject(Object.assign(new Error("Codex headless execution could not be started."), {
        code: "provider_unavailable",
        providerDiagnostics: { diagnosticCode: "process_permission_denied", elapsedSeconds: 0, stderrBytes: 0, stderrTruncated: false },
      }));
    },
  };
  const service = new StudioService({ schedule: (work) => scheduled.push(work), headlessImageProvider: provider });
  const created = service.createPhotorealisticProject({ ...validPhotoDraft, clientRequestId: "photo-permission-after-spawn" });
  scheduled.shift()();
  await nextTick();
  const failed = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(failed.status, "failed");
  assert.equal(failed.job.progress, 5);
  assert.equal(failed.error.code, "provider_unavailable");
  assert.equal(failed.error.providerDiagnostics.diagnosticCode, "process_permission_denied");
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
  assert.equal(service.forecastPhotorealisticProgress(0, 200), 5);
  assert.equal(service.forecastPhotorealisticProgress(1, 200), 5);
  assert.equal(service.forecastPhotorealisticProgress(2, 200), 6);
  assert.equal(service.forecastPhotorealisticProgress(4, 200), 7);
  assert.equal(service.forecastPhotorealisticProgress(168, 200), 89);
  assert.equal(service.forecastPhotorealisticProgress(170, 200), 90);
  assert.equal(service.forecastPhotorealisticProgress(200, 200), 90);
  service.photorealisticDurationSamples = [{ bucket: "text_to_photo_still", seconds: 60 }, { bucket: "text_to_photo_still", seconds: 75 }];
  assert.equal(service.estimatedPhotorealisticDurationSeconds({ kind: "still" }, "text_to_photo"), null);
  const created = service.createPhotorealisticProject({ ...validPhotoDraft, clientRequestId: "photo-request-0005" });
  scheduled.shift()();
  await nextTick();
  assert.equal(service.getPhotorealisticProject(created.project.id).project.job.etaState, "bootstrap");
  service.photorealisticDurationSamples.push({ bucket: "text_to_photo_still", seconds: 90 });
  time += 60_000;
  const forecast = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(forecast.job.estimatedDurationSeconds, 75);
  assert.equal(forecast.job.estimatedRemainingSeconds, 15);
  assert.equal(forecast.job.etaState, "sampled");
  assert.equal(forecast.job.etaSource, "bucket_median");
  assert.equal(forecast.job.progressBasis, "server_lifecycle_and_duration_forecast");
  assert.equal(forecast.job.progress, 85);
  assert.equal(forecast.job.observedProgress, 5);
  assert.equal(forecast.job.forecastHighWater, 85);
  time -= 10_000;
  const clockRollback = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(clockRollback.job.elapsedSeconds, 60);
  assert.equal(clockRollback.job.estimatedRemainingSeconds, 15);
  assert.equal(clockRollback.job.progress, 85);
  time += 26_000;
  const overdue = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(overdue.job.estimatedRemainingSeconds, null);
  assert.equal(overdue.job.etaState, "estimate_exceeded");
  assert.equal(overdue.job.progressBasis, "server_lifecycle_and_duration_forecast");
  assert.equal(overdue.job.progress, 90);
  assert.equal(overdue.job.finalizationState, "awaiting_provider_output");
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
  let rejectGeneration;
  const cleanupWarning = { code: "cleanup_warning", osCode: "EBUSY", workspace: "ars-headless-imagegen-test" };
  const unsafeProviderDiagnostics = { diagnosticCode: "provider_exit_nonzero", exitCode: 1, elapsedSeconds: 2, stderrBytes: 91, stderrTruncated: false, stderrText: "data:image/png;base64,private", sourcePath: "C:\\Temp\\source.png" };
  const provider = {
    status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
    generateUserImage: ({ onPhase }) => {
      onPhase("workspace_prepared");
      onPhase("provider_started");
      onPhase("completed");
      return new Promise((resolve, reject) => { rejectGeneration = reject; });
    },
  };
  const service = new StudioService({ schedule: (work) => scheduled.push(work), headlessImageProvider: provider });
  const created = service.createPhotorealisticProject({ ...validPhotoDraft, clientRequestId: "photo-request-0006" });
  assert.equal(created.status, 202);
  scheduled.shift()();
  await nextTick();
  service.photorealisticProjects.get(created.project.id).job.forecastHighWater = 48;
  rejectGeneration(Object.assign(new Error("The local provider stopped after starting."), { cleanupWarning, providerDiagnostics: unsafeProviderDiagnostics }));
  await nextTick();
  const failed = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(failed.status, "failed");
  assert.equal(failed.job.phase, "failed");
  assert.equal(failed.job.progress < 100, true);
  assert.equal(failed.job.progress, 48);
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
  let reportPhase;
  let requestedOutput;
  let time = Date.parse("2026-08-05T12:00:00.000Z");
  const provider = {
    status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
    generateUserImage: ({ output, onPhase }) => {
      reportPhase = onPhase;
      requestedOutput = output;
      onPhase("workspace_prepared");
      onPhase("provider_started");
      onPhase("output_validated");
      onPhase("gif_encoding", { currentFrame: 0, frameCount: output.frameCount });
      onPhase("gif_encoding", { currentFrame: output.frameCount, frameCount: output.frameCount });
      return new Promise((resolve) => { resolveGeneration = resolve; });
    },
  };
  const service = new StudioService({ now: () => new Date(time), schedule: (work) => scheduled.push(work), headlessImageProvider: provider });
  service.photorealisticDurationSamples = [{ bucket: "text_to_photo_motion_gif_medium", seconds: 60 }, { bucket: "text_to_photo_motion_gif_medium", seconds: 75 }, { bucket: "text_to_photo_motion_gif_medium", seconds: 90 }];
  const created = service.createPhotorealisticProject({ ...validPhotoDraft, outputKind: "motion_gif", frameCount: 12, clientRequestId: "photo-motion-gif-0001" });
  assert.equal(created.status, 202);
  assert.deepEqual(created.project.output, { kind: "motion_gif", frameCount: 12, fps: 10 });
  assert.equal(created.project.job.progress, 0);
  scheduled.shift()();
  await nextTick();
  time += 100_000;
  const encoding = service.getPhotorealisticProject(created.project.id).project;
  assert.deepEqual(requestedOutput, { kind: "motion_gif", frameCount: 12, fps: 10 });
  assert.equal(encoding.status, "in_progress");
  assert.equal(encoding.job.phase, "gif_encoding");
  assert.equal(encoding.job.finalizationState, "encoding_gif");
  assert.equal(encoding.job.encodedFrameCount, 12);
  assert.equal(encoding.job.progress, 90);
  assert.equal(encoding.job.forecastHighWater, 90);
  service.photorealisticProjects.get(created.project.id).job.forecastHighWater = 95;
  reportPhase("gif_encoding", { currentFrame: 12, frameCount: 12 });
  const encodingAfterFrame = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(encodingAfterFrame.job.progress, 90);
  assert.equal(encodingAfterFrame.job.forecastHighWater, 90);
  reportPhase("artifact_ready");
  const artifactReady = service.getPhotorealisticProject(created.project.id).project;
  assert.equal(artifactReady.job.phase, "artifact_ready");
  assert.equal(artifactReady.job.progress, 90);
  assert.equal(artifactReady.job.finalizationState, "saving_artifact");
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
