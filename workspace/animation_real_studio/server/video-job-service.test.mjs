import assert from "node:assert/strict";
import test from "node:test";
import { VideoJobService, VIDEO_JOB_PROTOCOL_VERSION } from "./business/video-job-service.mjs";
import { VIDEO_PROVIDER_ID, VIDEO_PROVIDER_PROTOCOL_VERSION } from "./business/video-provider-contract.mjs";
import { InMemoryVideoJobRepository } from "./data/in-memory-video-job-repository.mjs";

const validRequest = {
  protocolVersion: VIDEO_PROVIDER_PROTOCOL_VERSION,
  mode: "image_to_video",
  clientRequestId: "video-request-1001",
  prompt: "An original fictional night market scene comes alive with a slow camera push.",
  rightsAccepted: true,
  sourceAsset: { assetId: "asset-selected-1001", sha256: "a".repeat(64), mimeType: "image/png", width: 1080, height: 1920 },
  output: { durationSeconds: 8, resolution: "768P", ratio: "adaptive" },
};

function harness({ providerOverrides = {}, observer, start = "2026-08-24T00:00:00.000Z", reservationTimeoutMs = 60_000 } = {}) {
  let time = new Date(start).getTime();
  let jobSequence = 0;
  let operationSequence = 0;
  const calls = { submit: 0, getStatus: 0, cancel: 0 };
  const now = () => new Date(time);
  const repository = new InMemoryVideoJobRepository({ now, idFactory: () => `video-job-${String(++jobSequence).padStart(4, "0")}` });
  const provider = {
    async submit() { calls.submit += 1; return { ok: true, status: 202, jobRef: { providerId: VIDEO_PROVIDER_ID, taskId: `task-${calls.submit}` }, job: { status: "queued", artifactAvailable: false } }; },
    async getStatus(jobRef) { calls.getStatus += 1; return { ok: true, status: 200, jobRef, job: { status: "running", artifactAvailable: false } }; },
    async cancel(jobRef) { calls.cancel += 1; return { ok: true, status: 200, jobRef, action: "cancelled" }; },
    ...providerOverrides,
  };
  const service = new VideoJobService({ repository, provider, observer, now, operationIdFactory: () => `video-operation-${String(++operationSequence).padStart(4, "0")}`, reservationTimeoutMs });
  return { service, repository, provider, calls, now, advance(ms) { time += ms; } };
}

const summary = { promptDigest: "b".repeat(64), promptLength: 12, sourceAsset: validRequest.sourceAsset, output: validRequest.output };

async function verifyRepositoryContract(repository) {
  const reserved = await repository.reserve({ protocolVersion: VIDEO_JOB_PROTOCOL_VERSION, clientRequestId: "repo-request-0001", requestDigest: "c".repeat(64), requestSummary: summary });
  assert.equal(reserved.created, true);
  const duplicate = await repository.reserve({ protocolVersion: VIDEO_JOB_PROTOCOL_VERSION, clientRequestId: "repo-request-0001", requestDigest: "c".repeat(64), requestSummary: summary });
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.job.id, reserved.job.id);
  const conflict = await repository.reserve({ protocolVersion: VIDEO_JOB_PROTOCOL_VERSION, clientRequestId: "repo-request-0001", requestDigest: "d".repeat(64), requestSummary: summary });
  assert.equal(conflict.error, "video_idempotency_conflict");

  reserved.job.requestSummary.sourceAsset.assetId = "mutated-outside";
  assert.equal((await repository.getById(reserved.job.id)).job.requestSummary.sourceAsset.assetId, validRequest.sourceAsset.assetId);

  const failed = await repository.compareAndSet({ jobId: reserved.job.id, expectedVersion: 1, nextStatus: "failed", outcomeCertainty: "known", error: { code: "fixed_failure", message: "fixed", retryable: false }, eventType: "fixed_failure" });
  assert.equal(failed.job.version, 2);
  assert.equal(failed.event.terminal, true);
  const illegal = await repository.compareAndSet({ jobId: reserved.job.id, expectedVersion: 2, nextStatus: "running", outcomeCertainty: "known", eventType: "illegal" });
  assert.equal(illegal.error, "video_job_transition_invalid");
  const terminalMutation = await repository.compareAndSet({ jobId: reserved.job.id, expectedVersion: 2, nextStatus: "failed", outcomeCertainty: "unknown", providerRecordDeletedAt: "2026-08-24T00:00:00.000Z", error: { code: "changed", message: "changed", retryable: true }, eventType: "provider_record_deleted", metadataOnly: true });
  assert.equal(terminalMutation.error, "video_job_metadata_update_invalid");
  const deleted = await repository.compareAndSet({ jobId: reserved.job.id, expectedVersion: 2, nextStatus: "failed", outcomeCertainty: "known", providerRecordDeletedAt: "2026-08-24T00:00:00.000Z", eventType: "provider_record_deleted", metadataOnly: true });
  assert.equal(deleted.ok, true);
  assert.equal(deleted.job.status, "failed");
  assert.equal(deleted.job.outcomeCertainty, "known");
  assert.deepEqual(deleted.job.error, failed.job.error);
  const stale = await repository.compareAndSet({ jobId: reserved.job.id, expectedVersion: 1, nextStatus: "failed", outcomeCertainty: "known", eventType: "stale" });
  assert.equal(stale.error, "video_job_version_conflict");
  const events = await repository.listEvents(reserved.job.id);
  assert.deepEqual(events.events.map((event) => event.sequence), [1, 2, 3]);
  assert.equal(events.events.filter((event) => event.terminal).length, 1);
  assert.doesNotMatch(JSON.stringify(events), /original fictional|https?:\/\/|Bearer/i);
}

test("InMemoryVideoJobRepository satisfies atomic reservation, immutable snapshot, CAS, and terminal-event contract", async () => {
  const { repository } = harness();
  await verifyRepositoryContract(repository);
});

test("repository enforces unique provider references across jobs", async () => {
  const { repository } = harness();
  const first = await repository.reserve({ protocolVersion: VIDEO_JOB_PROTOCOL_VERSION, clientRequestId: "provider-ref-request-1", requestDigest: "1".repeat(64), requestSummary: summary });
  const second = await repository.reserve({ protocolVersion: VIDEO_JOB_PROTOCOL_VERSION, clientRequestId: "provider-ref-request-2", requestDigest: "2".repeat(64), requestSummary: summary });
  const ref = { providerId: VIDEO_PROVIDER_ID, taskId: "shared-task" };
  assert.equal((await repository.compareAndSet({ jobId: first.job.id, expectedVersion: 1, nextStatus: "queued", outcomeCertainty: "known", providerRef: ref, error: null, eventType: "accepted" })).ok, true);
  const conflicted = await repository.compareAndSet({ jobId: second.job.id, expectedVersion: 1, nextStatus: "queued", outcomeCertainty: "known", providerRef: ref, error: null, eventType: "accepted" });
  assert.equal(conflicted.error, "video_job_provider_ref_conflict");
});

test("concurrent identical creates converge on one reservation and one provider submit", async () => {
  let releaseSubmit;
  let submitStarted;
  const started = new Promise((resolve) => { submitStarted = resolve; });
  const pending = new Promise((resolve) => { releaseSubmit = resolve; });
  const h = harness({ providerOverrides: { async submit() { h.calls.submit += 1; submitStarted(); return pending; } } });
  const firstPromise = h.service.create(validRequest);
  await started;
  const replay = await h.service.create(validRequest);
  assert.equal(replay.replayed, true);
  assert.equal(replay.job.status, "submitting");
  releaseSubmit({ ok: true, status: 202, jobRef: { providerId: VIDEO_PROVIDER_ID, taskId: "concurrent-task" }, job: { status: "queued" } });
  const first = await firstPromise;
  assert.equal(first.job.id, replay.job.id);
  assert.equal(first.job.status, "queued");
  assert.equal(h.calls.submit, 1);

  const conflict = await h.service.create({ ...validRequest, prompt: "A materially different original prompt." });
  assert.equal(conflict.error, "video_idempotency_conflict");
  assert.equal(h.calls.submit, 1);
});

test("create persists explicit failure or ambiguous submit without automatic resubmission", async () => {
  for (const [suffix, providerResult, expectedStatus] of [
    ["failure", { ok: false, status: 422, error: "video_provider_content_rejected", message: "The provider rejected the prompt.", retryable: false }, "failed"],
    ["unknown", { ok: false, status: 502, error: "video_submit_outcome_unknown", message: "The provider submit result is unknown.", retryable: false }, "outcome_unknown"],
  ]) {
    const h = harness({ providerOverrides: { async submit() { h.calls.submit += 1; return providerResult; } } });
    const request = { ...validRequest, clientRequestId: `video-${suffix}-request` };
    const result = await h.service.create(request);
    assert.equal(result.ok, false);
    assert.equal(result.job.status, expectedStatus);
    assert.equal(result.job.requestSummary.promptLength, request.prompt.length);
    assert.equal(Object.hasOwn(result.job.requestSummary, "prompt"), false);
    const replay = await h.service.create(request);
    assert.equal(replay.replayed, true);
    assert.equal(h.calls.submit, 1);
  }
});

test("provider failure details are replaced by allow-listed safe errors everywhere", async () => {
  const observerEvents = [];
  const secret = "Bearer private-token https://signed.example/video?token=private";
  const h = harness({
    observer: { onStatus(event) { observerEvents.push(event); } },
    providerOverrides: { async submit() { h.calls.submit += 1; return { ok: false, status: 500, error: "video_provider_unavailable", message: secret, retryable: true }; } },
  });
  const result = await h.service.create({ ...validRequest, clientRequestId: "safe-provider-error-1" });
  assert.equal(result.error, "video_provider_unavailable");
  assert.equal(result.message, "The provider is temporarily unavailable.");
  assert.equal(result.job.error.message, "The provider is temporarily unavailable.");
  const events = await h.repository.listEvents(result.job.id);
  assert.doesNotMatch(JSON.stringify({ result, events, observerEvents }), /private-token|signed\.example|token=private/i);
});

test("malformed provider success without a job reference fails closed as outcome_unknown", async () => {
  const h = harness({ providerOverrides: { async submit() { h.calls.submit += 1; return { ok: true, status: 202, job: { status: "queued" } }; } } });
  const request = { ...validRequest, clientRequestId: "missing-provider-ref-1" };
  const result = await h.service.create(request);
  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
  assert.equal(result.error, "video_submit_outcome_unknown");
  assert.equal(result.job.status, "outcome_unknown");
  assert.equal(result.job.providerRef, null);
  assert.equal((await h.service.create(request)).replayed, true);
  assert.equal(h.calls.submit, 1);
});

test("provider references are canonicalized before persistence", async () => {
  const h = harness({ providerOverrides: { async submit() { h.calls.submit += 1; return { ok: true, status: 202, jobRef: { providerId: VIDEO_PROVIDER_ID, taskId: "canonical-task", url: "https://signed.example/private", token: "private-token" }, job: { status: "queued" } }; } } });
  const result = await h.service.create({ ...validRequest, clientRequestId: "canonical-provider-ref-1" });
  assert.deepEqual(result.job.providerRef, { providerId: VIDEO_PROVIDER_ID, taskId: "canonical-task" });
  const stored = await h.repository.getById(result.job.id);
  assert.deepEqual(stored.job.providerRef, { providerId: VIDEO_PROVIDER_ID, taskId: "canonical-task" });
  assert.doesNotMatch(JSON.stringify({ result, stored }), /signed\.example|private-token|\"url\"|\"token\"/i);
});

test("stale submitting reservation becomes outcome_unknown without a provider call", async () => {
  const h = harness({ reservationTimeoutMs: 1_000 });
  const reserved = await h.repository.reserve({ protocolVersion: VIDEO_JOB_PROTOCOL_VERSION, clientRequestId: "stale-reservation-1", requestDigest: "e".repeat(64), requestSummary: summary });
  h.advance(1_001);
  const refreshed = await h.service.refresh(reserved.job.id);
  assert.equal(refreshed.job.status, "outcome_unknown");
  assert.equal(h.calls.getStatus, 0);
  const second = await h.service.refresh(reserved.job.id);
  assert.equal(second.error, "video_outcome_reconciliation_required");
});

test("get stays local while refresh makes one query per call and preserves terminal state", async () => {
  const providerStatuses = ["running", "succeeded"];
  const h = harness({ providerOverrides: { async getStatus(jobRef) { h.calls.getStatus += 1; return { ok: true, status: 200, jobRef, job: { status: providerStatuses.shift(), artifactAvailable: false } }; } } });
  const created = await h.service.create({ ...validRequest, clientRequestId: "refresh-request-1" });
  const local = await h.service.get(created.job.id);
  assert.equal(local.job.status, "queued");
  assert.equal(h.calls.getStatus, 0);
  assert.equal((await h.service.refresh(created.job.id)).job.status, "running");
  assert.equal((await h.service.refresh(created.job.id)).job.status, "succeeded");
  assert.equal(h.calls.getStatus, 2);
  const terminal = await h.service.refresh(created.job.id);
  assert.equal(terminal.unchanged, true);
  assert.equal(h.calls.getStatus, 2);
  const events = await h.repository.listEvents(created.job.id);
  assert.equal(events.events.filter((event) => event.terminal).length, 1);
});

test("refresh failure is retry-owned by the caller and leaves the job unchanged", async () => {
  const h = harness({ providerOverrides: { async getStatus() { h.calls.getStatus += 1; return { ok: false, status: 429, error: "video_provider_rate_limited", message: "Rate limited.", retryable: true }; } } });
  const created = await h.service.create({ ...validRequest, clientRequestId: "refresh-failure-1" });
  const result = await h.service.refresh(created.job.id);
  assert.equal(result.error, "video_provider_rate_limited");
  assert.equal(result.retryable, true);
  assert.equal(result.job.status, "queued");
  assert.equal(h.calls.getStatus, 1);
  assert.equal((await h.repository.getById(created.job.id)).job.version, created.job.version);
});

test("cancelled, deleted-terminal, and cancel-complete race actions remain distinct", async () => {
  const cancelledHarness = harness();
  const queued = await cancelledHarness.service.create({ ...validRequest, clientRequestId: "cancel-request-1" });
  const cancelled = await cancelledHarness.service.cancel(queued.job.id);
  assert.equal(cancelled.action, "cancelled");
  assert.equal(cancelled.job.status, "cancelled");
  assert.equal(cancelledHarness.calls.cancel, 1);

  const terminalHarness = harness({ providerOverrides: {
    async getStatus(jobRef) { terminalHarness.calls.getStatus += 1; return { ok: true, status: 200, jobRef, job: { status: "succeeded", artifactAvailable: true } }; },
    async cancel(jobRef) { terminalHarness.calls.cancel += 1; return { ok: true, status: 200, jobRef, action: "deleted" }; },
  } });
  const terminalCreated = await terminalHarness.service.create({ ...validRequest, clientRequestId: "delete-terminal-1" });
  const succeeded = await terminalHarness.service.refresh(terminalCreated.job.id);
  const deleted = await terminalHarness.service.cancel(succeeded.job.id);
  assert.equal(deleted.action, "deleted");
  assert.equal(deleted.job.status, "succeeded");
  assert.ok(deleted.job.providerRecordDeletedAt);
  const terminalEvents = await terminalHarness.repository.listEvents(deleted.job.id);
  assert.equal(terminalEvents.events.filter((event) => event.terminal).length, 1);

  const raceHarness = harness({ providerOverrides: { async cancel(jobRef) { raceHarness.calls.cancel += 1; return { ok: true, status: 200, jobRef, action: "deleted" }; } } });
  const raceCreated = await raceHarness.service.create({ ...validRequest, clientRequestId: "cancel-race-1" });
  const raced = await raceHarness.service.cancel(raceCreated.job.id);
  assert.equal(raced.action, "deleted");
  assert.equal(raced.job.status, "outcome_unknown");
  assert.notEqual(raced.job.status, "cancelled");
});

test("submit success plus stale finalize CAS fails closed without a second submit", async () => {
  const h = harness();
  const baseCompareAndSet = h.repository.compareAndSet.bind(h.repository);
  let raced = false;
  h.repository.compareAndSet = async (command) => {
    if (!raced && command.eventType === "provider_submit_accepted") {
      raced = true;
      await baseCompareAndSet({ jobId: command.jobId, expectedVersion: command.expectedVersion, nextStatus: "outcome_unknown", outcomeCertainty: "unknown", error: { code: "simulated_race", message: "Simulated race.", retryable: false }, eventType: "simulated_race" });
    }
    return baseCompareAndSet(command);
  };
  const result = await h.service.create({ ...validRequest, clientRequestId: "finalize-race-1" });
  assert.equal(result.error, "video_job_finalize_conflict");
  assert.equal(result.job.status, "outcome_unknown");
  assert.equal(h.calls.submit, 1);
});

test("observer emits one terminal event per operation, redacts payloads, and isolates observer failure", async () => {
  const events = [];
  const observer = { onStatus(event) { events.push(event); if (event.state === "starting") throw new Error("observer failure"); } };
  const h = harness({ observer });
  const created = await h.service.create({ ...validRequest, clientRequestId: "observer-request-1" });
  assert.equal(created.ok, true);
  assert.deepEqual(events.map((event) => event.state), ["starting", "succeeded"]);
  assert.equal(new Set(events.map((event) => event.operationId)).size, 1);
  assert.equal(new Set(events.map((event) => event.correlationId)).size, 1);
  assert.equal(events.filter((event) => ["succeeded", "failed", "cancelled"].includes(event.state)).length, 1);
  assert.doesNotMatch(JSON.stringify(events), /original fictional|asset-selected|https?:\/\/|Bearer|token/i);
});
