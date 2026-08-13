import assert from "node:assert/strict";
import test from "node:test";
import { ImageBatchViewModel } from "./image-batch-view-model.ts";
import { createDefaultImageBatchFormSettings, DEFAULT_IMAGE_BATCH_SETTINGS, IMAGE_BATCH_SUBJECT_DEFAULTS, type ImageBatch, type ImageBatchDraft, type ImageBatchRepository } from "../business/image-batch.ts";

const asset = (id: string) => ({ id, dataUri: "data:image/png;base64,AA==" });
const variant = (index: number, status: "in_progress" | "completed" | "failed") => ({ id: `batch-0001-variant-${index + 1}`, index, treatment: `Treatment ${index + 1}`, projectId: `photo-${index + 1}`, status, progress: status === "completed" ? 100 : status === "failed" ? 45 : 20, phase: status, delivery: status === "completed" ? { asset: asset(`asset-${index + 1}`) } : null, error: status === "failed" ? { code: "provider_failed", message: "safe failure" } : null });
const baseBatch = (status: ImageBatch["status"]): ImageBatch => ({
  id: "batch-0001",
  protocolVersion: "image-batch.v1",
  createdAt: "2026-08-12T00:00:00.000Z",
  updatedAt: "2026-08-12T00:00:00.000Z",
  status,
  brief: { subjectKind: "human", subjectDetail: "fictional_adult", age: "adult_30s", presentation: "unspecified", ethnicity: "east_asian", country: "south_korea", peopleCount: "one", era: "contemporary", weather: "rain", environment: "city", cameraAngle: "three_quarter", framing: "upper_body", lighting: "neon_night", mood: "dramatic", perspective: "third_person", wardrobe: "casual", profession: "office_worker", story: "A fictional adult makes a calm decision in an original rainy city scene." },
  outputPlan: { kind: "still", frameCount: 1 },
  variantCount: 3,
  variants: status === "partial" ? [variant(0, "completed"), variant(1, "failed"), variant(2, "completed")] : [variant(0, "in_progress"), variant(1, "in_progress"), variant(2, "in_progress")],
  selection: null,
});
const waitFor = async (predicate: () => boolean) => {
  for (let index = 0; index < 40; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for ViewModel state.");
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => { resolve = promiseResolve; reject = promiseReject; });
  return { promise, resolve, reject };
};

test("Business defaults initialize the whole form and stay isolated across subject automation and ViewModels", () => {
  const repository: ImageBatchRepository = {
    async create() { return baseBatch("in_progress"); },
    async get() { return baseBatch("partial"); },
    async select() { return baseBatch("partial"); },
  };
  const first = new ImageBatchViewModel(repository);
  const second = new ImageBatchViewModel(repository);
  const firstDefaults = createDefaultImageBatchFormSettings();
  const secondDefaults = createDefaultImageBatchFormSettings();
  assert.notStrictEqual(firstDefaults, secondDefaults);
  assert.notStrictEqual(firstDefaults.brief, secondDefaults.brief);
  assert.notStrictEqual(firstDefaults.referenceFocus, secondDefaults.referenceFocus);
  assert.notStrictEqual(firstDefaults.outputPlan, secondDefaults.outputPlan);
  firstDefaults.brief.era = "future";
  firstDefaults.referenceFocus.preserveBackgroundLayout = false;
  firstDefaults.outputPlan.kind = "motion_gif";
  assert.equal(secondDefaults.brief.era, "contemporary");
  assert.equal(secondDefaults.referenceFocus.preserveBackgroundLayout, true);
  assert.equal(secondDefaults.outputPlan.kind, "still");
  assert.equal(DEFAULT_IMAGE_BATCH_SETTINGS.brief.era, "contemporary");
  assert.equal(DEFAULT_IMAGE_BATCH_SETTINGS.referenceFocus.preserveBackgroundLayout, true);
  assert.equal(DEFAULT_IMAGE_BATCH_SETTINGS.outputPlan.kind, "still");
  assert.equal(Object.isFrozen(DEFAULT_IMAGE_BATCH_SETTINGS), true);
  assert.equal(Object.isFrozen(DEFAULT_IMAGE_BATCH_SETTINGS.brief), true);
  assert.equal(Object.isFrozen(DEFAULT_IMAGE_BATCH_SETTINGS.referenceFocus), true);
  assert.equal(Object.isFrozen(DEFAULT_IMAGE_BATCH_SETTINGS.outputPlan), true);
  assert.equal(Object.isFrozen(IMAGE_BATCH_SUBJECT_DEFAULTS), true);
  for (const defaults of Object.values(IMAGE_BATCH_SUBJECT_DEFAULTS)) assert.equal(Object.isFrozen(defaults), true);
  const initial = first.getSnapshot();
  assert.deepEqual(initial.brief, DEFAULT_IMAGE_BATCH_SETTINGS.brief);
  assert.equal(initial.mode, DEFAULT_IMAGE_BATCH_SETTINGS.mode);
  assert.deepEqual(initial.referenceFocus, DEFAULT_IMAGE_BATCH_SETTINGS.referenceFocus);
  assert.equal(initial.outputKind, DEFAULT_IMAGE_BATCH_SETTINGS.outputPlan.kind);
  assert.equal(initial.frameCount, DEFAULT_IMAGE_BATCH_SETTINGS.outputPlan.frameCount);
  assert.equal(initial.variantCount, DEFAULT_IMAGE_BATCH_SETTINGS.variantCount);
  assert.equal(initial.rightsAccepted, DEFAULT_IMAGE_BATCH_SETTINGS.rightsAccepted);

  first.updateBrief("era", "future");
  first.updateBrief("weather", "snow");
  first.updateBrief("story", "A fictional adult age 20+ crosses an original snowy future city in calm light.");
  first.updateBrief("subjectKind", "animal");
  assert.deepEqual({ subjectDetail: first.getSnapshot().brief.subjectDetail, age: first.getSnapshot().brief.age, presentation: first.getSnapshot().brief.presentation, ethnicity: first.getSnapshot().brief.ethnicity, country: first.getSnapshot().brief.country, peopleCount: first.getSnapshot().brief.peopleCount, profession: first.getSnapshot().brief.profession, wardrobe: first.getSnapshot().brief.wardrobe }, { subjectDetail: "dog", age: "not_applicable", presentation: "unspecified", ethnicity: "not_applicable", country: "not_applicable", peopleCount: "zero", profession: "none", wardrobe: "none" });
  first.updateBrief("subjectKind", "bird");
  assert.equal(first.getSnapshot().brief.subjectDetail, "songbird");
  first.updateBrief("subjectKind", "human");
  assert.deepEqual({ subjectDetail: first.getSnapshot().brief.subjectDetail, age: first.getSnapshot().brief.age, presentation: first.getSnapshot().brief.presentation, ethnicity: first.getSnapshot().brief.ethnicity, country: first.getSnapshot().brief.country, peopleCount: first.getSnapshot().brief.peopleCount, profession: first.getSnapshot().brief.profession, wardrobe: first.getSnapshot().brief.wardrobe }, { subjectDetail: "fictional_adult", age: "adult_30s", presentation: "unspecified", ethnicity: "east_asian", country: "south_korea", peopleCount: "one", profession: "office_worker", wardrobe: "casual" });
  assert.equal(first.getSnapshot().brief.era, "future");
  assert.equal(first.getSnapshot().brief.weather, "snow");
  assert.match(first.getSnapshot().brief.story, /snowy future city/);
  assert.deepEqual(second.getSnapshot().brief, DEFAULT_IMAGE_BATCH_SETTINGS.brief);
  assert.equal(DEFAULT_IMAGE_BATCH_SETTINGS.brief.era, "contemporary");
  first.dispose();
  second.dispose();
});

test("fake repository drives form policy, submission, polling, partial failure, and selection", async () => {
  const creates: ImageBatchDraft[] = [];
  const selections: string[] = [];
  let reads = 0;
  const repository: ImageBatchRepository = {
    async create(draft) { creates.push(draft); return baseBatch("in_progress"); },
    async get() { reads += 1; return baseBatch("partial"); },
    async select(_batchId, variantId) { selections.push(variantId); return { ...baseBatch("partial"), selection: { variantId, revision: 1, selectedAt: "2026-08-12T00:00:01.000Z" } }; },
  };
  const viewModel = new ImageBatchViewModel(repository, { pollIntervalMs: 1, createRequestId: () => "batch-viewmodel-0001" });
  let notifications = 0;
  const unsubscribe = viewModel.subscribe(() => { notifications += 1; });
  viewModel.updateBrief("subjectKind", "bird");
  assert.equal(viewModel.getSnapshot().brief.subjectDetail, "songbird");
  assert.equal(viewModel.getSnapshot().brief.profession, "none");
  assert.equal(viewModel.getSnapshot().brief.wardrobe, "none");
  viewModel.updateBrief("subjectKind", "human");
  viewModel.updateBrief("wardrobe", "school_inspired");
  assert.equal(viewModel.getSnapshot().brief.profession, "adult_university_student");
  viewModel.setRightsAccepted(true);
  assert.equal(viewModel.getSnapshot().canSubmit, true);
  await viewModel.submit();
  assert.equal(creates.length, 1);
  assert.equal(creates[0].variantCount, 3);
  assert.deepEqual(creates[0].outputPlan, { kind: "still", frameCount: 1 });
  assert.equal(creates[0].clientRequestId, "batch-viewmodel-0001");
  await waitFor(() => viewModel.getSnapshot().batch?.status === "partial");
  assert.equal(reads, 1);
  assert.equal(viewModel.getSnapshot().batch?.variants[1].error?.code, "provider_failed");
  await viewModel.selectVariant("batch-0001-variant-1");
  assert.deepEqual(selections, ["batch-0001-variant-1"]);
  assert.equal(viewModel.getSnapshot().batch?.selection?.revision, 1);
  assert.ok(notifications > 0);
  unsubscribe();
  viewModel.dispose();
});

test("ViewModel submits one integrated 2D-to-GIF batch and clears reference state in text mode", async () => {
  const creates: ImageBatchDraft[] = [];
  const repository: ImageBatchRepository = {
    async create(draft) { creates.push(draft); return baseBatch("partial"); },
    async get() { return baseBatch("partial"); },
    async select() { return baseBatch("partial"); },
  };
  const viewModel = new ImageBatchViewModel(repository, { createRequestId: () => "batch-integrated-0001" });
  viewModel.setMode("animation_2d_to_photo");
  viewModel.setSourceInput({ kind: "attested_original_2d", referenceImage: { mimeType: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgo=" }, referenceFocus: { preserveSubjectVisuals: true, preserveBackgroundLayout: true, preserveCameraComposition: true } }, "owned.png");
  viewModel.toggleReferenceFocus("preserveBackgroundLayout");
  viewModel.setOutputKind("motion_gif");
  viewModel.setFrameCount(30);
  viewModel.updateBrief("age", "adult_40s");
  viewModel.updateBrief("framing", "full_body");
  viewModel.updateBrief("peopleCount", "two");
  viewModel.setVariantCount(2);
  viewModel.setRightsAccepted(true);
  assert.equal(viewModel.getSnapshot().canSubmit, true);
  await viewModel.submit();
  assert.equal(creates.length, 1);
  assert.deepEqual(creates[0].outputPlan, { kind: "motion_gif", frameCount: 30 });
  assert.equal(creates[0].variantCount, 2);
  assert.equal(creates[0].brief.age, "adult_40s");
  assert.equal(creates[0].brief.framing, "full_body");
  assert.equal(creates[0].brief.peopleCount, "two");
  assert.equal(creates[0].sourceInput?.referenceFocus.preserveBackgroundLayout, false);
  viewModel.setMode("text_to_photo");
  assert.equal(viewModel.getSnapshot().sourceInput, null);
  assert.equal(viewModel.getSnapshot().sourceLabel, "");
  viewModel.dispose();
});

test("fictional Korean archetypes preserve independent casting selections and expanded adult swimwear", async () => {
  const creates: ImageBatchDraft[] = [];
  const repository: ImageBatchRepository = {
    async create(draft) { creates.push(draft); return baseBatch("partial"); },
    async get() { return baseBatch("partial"); },
    async select() { return baseBatch("partial"); },
  };
  const viewModel = new ImageBatchViewModel(repository);
  const initial = viewModel.getSnapshot().brief;
  assert.equal(initial.ethnicity, "east_asian");
  assert.equal(initial.country, "south_korea");

  viewModel.updateBrief("ethnicity", "multiracial");
  viewModel.updateBrief("country", "brazil");
  for (const profession of ["kpop_idol", "fashion_model", "announcer"] as const) {
    viewModel.updateBrief("profession", profession);
    assert.equal(viewModel.getSnapshot().brief.ethnicity, "multiracial");
    assert.equal(viewModel.getSnapshot().brief.country, "brazil");
  }
  viewModel.updateBrief("wardrobe", "micro_bikini");
  viewModel.setRightsAccepted(true);
  await viewModel.submit();
  assert.equal(creates[0].brief.profession, "announcer");
  assert.equal(creates[0].brief.ethnicity, "multiracial");
  assert.equal(creates[0].brief.country, "brazil");
  assert.equal(creates[0].brief.wardrobe, "micro_bikini");
  viewModel.dispose();
});

test("ViewModel ignores a reference read that finishes after switching to text mode", () => {
  const repository: ImageBatchRepository = {
    async create() { return baseBatch("in_progress"); },
    async get() { return baseBatch("partial"); },
    async select() { return baseBatch("partial"); },
  };
  const viewModel = new ImageBatchViewModel(repository);
  viewModel.setMode("animation_2d_to_photo");
  const revision = viewModel.beginSourceInputRead();
  viewModel.setMode("text_to_photo");
  viewModel.setSourceInput({ kind: "attested_original_2d", referenceImage: { mimeType: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgo=" }, referenceFocus: { preserveSubjectVisuals: true, preserveBackgroundLayout: true, preserveCameraComposition: true } }, "late.png", revision);
  assert.equal(viewModel.getSnapshot().mode, "text_to_photo");
  assert.equal(viewModel.getSnapshot().sourceInput, null);
  assert.equal(viewModel.getSnapshot().sourceLabel, "");
  viewModel.setMode("animation_2d_to_photo");
  assert.equal(viewModel.getSnapshot().canSubmit, false);
  viewModel.dispose();
});

test("ViewModel keeps the newest reference when file reads complete out of order", () => {
  const repository: ImageBatchRepository = {
    async create() { return baseBatch("in_progress"); },
    async get() { return baseBatch("partial"); },
    async select() { return baseBatch("partial"); },
  };
  const viewModel = new ImageBatchViewModel(repository);
  viewModel.setMode("animation_2d_to_photo");
  const firstRevision = viewModel.beginSourceInputRead();
  const secondRevision = viewModel.beginSourceInputRead();
  const source = { kind: "attested_original_2d" as const, referenceImage: { mimeType: "image/png" as const, dataUrl: "data:image/png;base64,iVBORw0KGgo=" }, referenceFocus: { preserveSubjectVisuals: true, preserveBackgroundLayout: true, preserveCameraComposition: true } };
  viewModel.setSourceInput(source, "newest.png", secondRevision);
  viewModel.setSourceInput(source, "stale.png", firstRevision);
  assert.equal(viewModel.getSnapshot().sourceLabel, "newest.png");
  viewModel.dispose();
});

test("ViewModel clears the previous reference while a replacement file is being read", () => {
  const creates: ImageBatchDraft[] = [];
  const repository: ImageBatchRepository = {
    async create(draft) { creates.push(draft); return baseBatch("in_progress"); },
    async get() { return baseBatch("partial"); },
    async select() { return baseBatch("partial"); },
  };
  const viewModel = new ImageBatchViewModel(repository);
  const source = { kind: "attested_original_2d" as const, referenceImage: { mimeType: "image/png" as const, dataUrl: "data:image/png;base64,iVBORw0KGgo=" }, referenceFocus: { preserveSubjectVisuals: true, preserveBackgroundLayout: true, preserveCameraComposition: true } };
  viewModel.setMode("animation_2d_to_photo");
  viewModel.setSourceInput(source, "old.png");
  viewModel.setRightsAccepted(true);
  assert.equal(viewModel.getSnapshot().canSubmit, true);
  viewModel.beginSourceInputRead();
  assert.equal(viewModel.getSnapshot().sourceInput, null);
  assert.equal(viewModel.getSnapshot().sourceLabel, "");
  assert.equal(viewModel.getSnapshot().canSubmit, false);
  void viewModel.submit();
  assert.equal(creates.length, 0);
  viewModel.dispose();
});

test("polling distinguishes retrying and disconnected snapshots, then recovers and stops at terminal state", async () => {
  const polls = Array.from({ length: 5 }, () => deferred<ImageBatch>());
  let reads = 0;
  let now = 1_000;
  const repository: ImageBatchRepository = {
    async create() { return baseBatch("in_progress"); },
    get() { const request = polls[reads]; reads += 1; return request.promise; },
    async select() { return baseBatch("partial"); },
  };
  const viewModel = new ImageBatchViewModel(repository, { pollIntervalMs: 1, now: () => { now += 1_000; return now; } });
  viewModel.setRightsAccepted(true);
  await viewModel.submit();
  assert.equal(viewModel.getSnapshot().pollState, "live");
  assert.equal(viewModel.getSnapshot().lastSuccessfulPollAt, 2_000);

  await waitFor(() => reads === 1);
  polls[0].reject(new Error("offline-1"));
  await waitFor(() => viewModel.getSnapshot().consecutivePollFailures === 1);
  assert.equal(viewModel.getSnapshot().pollState, "retrying");
  assert.equal(viewModel.getSnapshot().error, "");
  assert.equal(viewModel.getSnapshot().pollError, "offline-1");

  await waitFor(() => reads === 2);
  polls[1].reject(new Error("offline-2"));
  await waitFor(() => viewModel.getSnapshot().consecutivePollFailures === 2);
  assert.equal(viewModel.getSnapshot().pollState, "retrying");

  await waitFor(() => reads === 3);
  polls[2].reject(new Error("offline-3"));
  await waitFor(() => viewModel.getSnapshot().pollState === "disconnected");
  assert.equal(viewModel.getSnapshot().consecutivePollFailures, 3);

  await waitFor(() => reads === 4);
  polls[3].resolve(baseBatch("in_progress"));
  await waitFor(() => viewModel.getSnapshot().pollState === "live");
  assert.equal(viewModel.getSnapshot().consecutivePollFailures, 0);
  assert.equal(viewModel.getSnapshot().pollError, "");
  assert.equal(viewModel.getSnapshot().lastSuccessfulPollAt, 3_000);

  await waitFor(() => reads === 5);
  polls[4].resolve(baseBatch("partial"));
  await waitFor(() => viewModel.getSnapshot().batch?.status === "partial");
  assert.equal(viewModel.getSnapshot().pollState, "idle");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(reads, 5);
  viewModel.dispose();
});

test("starting a new generation cancels stale polling and preserves form settings", async () => {
  const pendingPoll = deferred<ImageBatch>();
  let reads = 0;
  let pollSignal: AbortSignal | undefined;
  const repository: ImageBatchRepository = {
    async create() { return baseBatch("in_progress"); },
    get(_batchId, signal) { reads += 1; pollSignal = signal; return pendingPoll.promise; },
    async select() { return baseBatch("partial"); },
  };
  const viewModel = new ImageBatchViewModel(repository, { pollIntervalMs: 1 });
  viewModel.updateBrief("weather", "snow");
  viewModel.setOutputKind("motion_gif");
  viewModel.setFrameCount(24);
  viewModel.setRightsAccepted(true);
  await viewModel.submit();
  await waitFor(() => reads === 1);

  viewModel.startNewGeneration();
  assert.equal(pollSignal?.aborted, true);
  assert.equal(viewModel.getSnapshot().batch, null);
  assert.equal(viewModel.getSnapshot().pollState, "idle");
  assert.equal(viewModel.getSnapshot().brief.weather, "snow");
  assert.equal(viewModel.getSnapshot().outputKind, "motion_gif");
  assert.equal(viewModel.getSnapshot().frameCount, 24);
  assert.equal(viewModel.getSnapshot().rightsAccepted, true);

  pendingPoll.resolve(baseBatch("in_progress"));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(viewModel.getSnapshot().batch, null);
  assert.equal(reads, 1);
  viewModel.dispose();
});

test("disposing the ViewModel aborts an in-flight repository command", async () => {
  let submittedSignal: AbortSignal | undefined;
  let resolveCreate: ((batch: ImageBatch) => void) | undefined;
  const repository: ImageBatchRepository = {
    create(_draft, signal) { submittedSignal = signal; return new Promise((resolve) => { resolveCreate = resolve; }); },
    async get() { return baseBatch("partial"); },
    async select() { return baseBatch("partial"); },
  };
  const viewModel = new ImageBatchViewModel(repository, { createRequestId: () => "batch-viewmodel-0002" });
  viewModel.setRightsAccepted(true);
  const submission = viewModel.submit();
  await waitFor(() => submittedSignal !== undefined);
  viewModel.dispose();
  assert.equal(submittedSignal?.aborted, true);
  resolveCreate?.(baseBatch("in_progress"));
  await submission;
});

test("ViewModel uses the public 400-character story boundary", () => {
  const repository: ImageBatchRepository = {
    async create() { return baseBatch("in_progress"); },
    async get() { return baseBatch("partial"); },
    async select() { return baseBatch("partial"); },
  };
  const viewModel = new ImageBatchViewModel(repository);
  viewModel.setRightsAccepted(true);
  const validBoundaryStory = `A fictional adult age 20+. ${"x".repeat(400)}`.slice(0, 400);
  viewModel.updateBrief("story", validBoundaryStory);
  assert.equal(viewModel.getSnapshot().canSubmit, true);
  viewModel.updateBrief("story", `${validBoundaryStory}x`);
  assert.equal(viewModel.getSnapshot().canSubmit, false);
  viewModel.dispose();
});

test("ViewModel allows adult sensual styling but disables erotic school-inspired combinations", () => {
  const repository: ImageBatchRepository = {
    async create() { return baseBatch("in_progress"); },
    async get() { return baseBatch("partial"); },
    async select() { return baseBatch("partial"); },
  };
  const viewModel = new ImageBatchViewModel(repository);
  viewModel.setRightsAccepted(true);
  viewModel.updateBrief("wardrobe", "lingerie");
  viewModel.updateBrief("story", "Zendaya poses seductively in an adult lingerie portrait.");
  assert.equal(viewModel.getSnapshot().canSubmit, false);
  assert.match(viewModel.getSnapshot().policyMessage, /fictional/);
  viewModel.updateBrief("story", "A fictional adult age 20+ uses sensual and erotic non-graphic styling.");
  assert.equal(viewModel.getSnapshot().canSubmit, true);
  assert.equal(viewModel.getSnapshot().policyMessage, "");
  viewModel.updateBrief("wardrobe", "school_inspired");
  viewModel.updateBrief("story", "A fictional adult age 20+ poses sensually in school-inspired fashion.");
  assert.equal(viewModel.getSnapshot().canSubmit, false);
  assert.match(viewModel.getSnapshot().policyMessage, /교복풍 의상/);
  viewModel.updateBrief("story", "A fictional adult university student age 20+ models a calm editorial outfit.");
  assert.equal(viewModel.getSnapshot().canSubmit, true);
  viewModel.updateBrief("subjectKind", "bird");
  viewModel.updateBrief("story", "A bird poses sensually and provocatively over an original forest.");
  assert.equal(viewModel.getSnapshot().canSubmit, false);
  assert.match(viewModel.getSnapshot().policyMessage, /가상 성인 사람/);
  viewModel.dispose();
});
