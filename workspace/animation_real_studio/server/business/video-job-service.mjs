import { createHash } from "node:crypto";
import { validateVideoGenerationRequest } from "./video-provider-contract.mjs";

export const VIDEO_JOB_PROTOCOL_VERSION = "video-job.v1";
export const VIDEO_JOB_STATUSES = Object.freeze(["submitting", "queued", "running", "succeeded", "failed", "cancelled", "outcome_unknown"]);
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);
const TRANSITIONS = Object.freeze({
  submitting: new Set(["queued", "failed", "outcome_unknown"]),
  queued: new Set(["running", "succeeded", "failed", "cancelled", "outcome_unknown"]),
  running: new Set(["succeeded", "failed", "cancelled", "outcome_unknown"]),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set(),
  outcome_unknown: new Set(),
});
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SAFE_PROVIDER_ERROR_MESSAGES = Object.freeze({
  video_provider_disabled: "Video generation is not enabled.",
  video_provider_not_configured: "The video provider is not configured.",
  video_media_unavailable: "The source image cannot be prepared for the provider.",
  video_provider_bad_request: "The provider rejected the request parameters.",
  video_provider_unauthorized: "The provider credential was rejected.",
  video_provider_balance_required: "The provider account has insufficient balance.",
  video_provider_content_rejected: "The provider rejected the media or prompt.",
  video_provider_rate_limited: "The provider rate limit was reached.",
  video_provider_unavailable: "The provider is temporarily unavailable.",
  video_provider_http_error: "The provider request failed.",
  video_provider_transport_failed: "The provider could not be reached.",
  video_provider_protocol_error: "The provider returned an invalid response.",
  video_submit_outcome_unknown: "The provider submit result is unknown.",
  video_job_ref_invalid: "The video job reference is invalid.",
  video_artifact_not_ready: "The video artifact is not ready.",
  video_artifact_import_failed: "The provider artifact could not be imported.",
  video_provider_failure: "The video provider operation failed.",
});
const clone = (value) => value == null ? value : structuredClone(value);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const nowIso = (now) => {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Clock must return a valid date.");
  return date.toISOString();
};

export function isTerminalVideoJobStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

export function canTransitionVideoJobStatus(previousStatus, nextStatus, { metadataOnly = false } = {}) {
  if (!VIDEO_JOB_STATUSES.includes(previousStatus) || !VIDEO_JOB_STATUSES.includes(nextStatus)) return false;
  if (previousStatus === nextStatus) return metadataOnly && ["succeeded", "failed"].includes(previousStatus);
  return TRANSITIONS[previousStatus].has(nextStatus);
}

export class NullVideoJobStatusObserver {
  onStatus() {}
}

function safeError(value) {
  if (!value || typeof value !== "object") return null;
  const candidate = typeof value.error === "string" ? value.error : typeof value.code === "string" ? value.code : "video_provider_failure";
  const code = Object.hasOwn(SAFE_PROVIDER_ERROR_MESSAGES, candidate) ? candidate : "video_provider_failure";
  return { code, message: SAFE_PROVIDER_ERROR_MESSAGES[code], retryable: value.retryable === true };
}

function canonicalProviderRef(value) {
  if (!value || !SAFE_ID.test(value.providerId ?? "") || !SAFE_ID.test(value.taskId ?? "")) return null;
  return { providerId: value.providerId, taskId: value.taskId };
}

function providerFailure(value, fallbackStatus = 502) {
  const error = safeError(value) ?? safeError({ error: "video_provider_failure" });
  const status = Number.isInteger(value?.status) && value.status >= 400 && value.status <= 599 ? value.status : fallbackStatus;
  return { ok: false, status, error: error.code, message: error.message, retryable: error.retryable };
}

function requestSummary(request) {
  return {
    promptDigest: sha256(request.prompt),
    promptLength: request.prompt.length,
    sourceAsset: clone(request.sourceAsset),
    output: clone(request.output),
  };
}

function requestDigest(request) {
  return sha256(JSON.stringify(request));
}

function jobSnapshot(job) {
  if (!job || typeof job !== "object") return null;
  return {
    id: job.id,
    protocolVersion: job.protocolVersion,
    clientRequestId: job.clientRequestId,
    requestDigest: job.requestDigest,
    requestSummary: job.requestSummary ? {
      promptDigest: job.requestSummary.promptDigest,
      promptLength: job.requestSummary.promptLength,
      sourceAsset: clone(job.requestSummary.sourceAsset),
      output: clone(job.requestSummary.output),
    } : null,
    status: job.status,
    outcomeCertainty: job.outcomeCertainty,
    providerRef: job.providerRef ? { providerId: job.providerRef.providerId, taskId: job.providerRef.taskId } : null,
    providerRecordDeletedAt: job.providerRecordDeletedAt ?? null,
    error: job.error ? { code: job.error.code, message: job.error.message, retryable: job.error.retryable === true } : null,
    version: job.version,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function repositoryFailure(result, fallback = "video_job_repository_error") {
  return {
    ok: false,
    status: result?.status ?? 500,
    error: result?.error ?? fallback,
    message: result?.message ?? "The video job repository operation failed.",
    ...(result?.job ? { job: jobSnapshot(result.job) } : {}),
  };
}

export class VideoJobService {
  constructor({ repository, provider, observer = new NullVideoJobStatusObserver(), now = () => new Date(), operationIdFactory, reservationTimeoutMs = 60_000 } = {}) {
    if (!repository || typeof repository.reserve !== "function" || typeof repository.getById !== "function" || typeof repository.compareAndSet !== "function") throw new Error("VideoJobRepositoryPort is required.");
    if (!provider || typeof provider.submit !== "function" || typeof provider.getStatus !== "function" || typeof provider.cancel !== "function") throw new Error("VideoProviderPort is required.");
    if (typeof operationIdFactory !== "function") throw new Error("operationIdFactory is required.");
    if (!Number.isInteger(reservationTimeoutMs) || reservationTimeoutMs < 1) throw new Error("reservationTimeoutMs must be a positive integer.");
    this.repository = repository;
    this.provider = provider;
    this.observer = observer;
    this.now = now;
    this.operationIdFactory = operationIdFactory;
    this.reservationTimeoutMs = reservationTimeoutMs;
  }

  emit(event) {
    try {
      const result = this.observer?.onStatus?.(Object.freeze({ ...event }));
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch {}
  }

  async run(method, correlationId, work) {
    const operationId = this.operationIdFactory();
    if (!SAFE_ID.test(operationId)) throw new Error("operationIdFactory returned an invalid ID.");
    const correlation = SAFE_ID.test(correlationId ?? "") ? correlationId : "unavailable";
    const base = { component: "VideoJobService", method, operationId, correlationId: correlation };
    this.emit({ ...base, timestamp: nowIso(this.now), state: "starting", errorCode: null, message: `${method} started.` });
    let result;
    try { result = await work(); }
    catch { result = { ok: false, status: 500, error: "video_job_internal_error", message: "The video job operation failed safely." }; }
    const state = result.ok ? (method === "cancel" && result.job?.status === "cancelled" ? "cancelled" : "succeeded") : "failed";
    this.emit({ ...base, timestamp: nowIso(this.now), state, errorCode: result.ok ? null : result.error, message: result.ok ? `${method} completed.` : result.message ?? `${method} failed.` });
    return result;
  }

  async create(input) {
    const correlation = typeof input?.clientRequestId === "string" ? input.clientRequestId.trim() : "unavailable";
    return this.run("create", correlation, () => this.createInternal(input));
  }

  async createInternal(input) {
    const { errors, request } = validateVideoGenerationRequest(input);
    if (errors.length) return { ok: false, status: 422, error: "video_request_invalid", message: "The video request is invalid.", errors };
    const digest = requestDigest(request);
    const reserved = await this.repository.reserve({ clientRequestId: request.clientRequestId, requestDigest: digest, requestSummary: requestSummary(request), protocolVersion: VIDEO_JOB_PROTOCOL_VERSION });
    if (!reserved?.ok) return repositoryFailure(reserved, "video_job_reservation_failed");
    if (!reserved.created) return { ok: true, status: 200, replayed: true, job: jobSnapshot(reserved.job) };

    let submitted;
    try { submitted = await this.provider.submit(request); }
    catch { submitted = { ok: false, status: 502, error: "video_submit_outcome_unknown", message: "The provider submit result is unknown.", retryable: false }; }
    const submittedProviderRef = submitted?.ok ? canonicalProviderRef(submitted.jobRef) : null;
    if (submitted?.ok && !submittedProviderRef) submitted = { ok: false, status: 502, error: "video_submit_outcome_unknown", retryable: false };

    let transition;
    if (submitted?.ok) {
      transition = { nextStatus: "queued", outcomeCertainty: "known", providerRef: submittedProviderRef, error: null, eventType: "provider_submit_accepted" };
    } else if (submitted?.error === "video_submit_outcome_unknown") {
      transition = { nextStatus: "outcome_unknown", outcomeCertainty: "unknown", error: safeError(submitted), eventType: "provider_submit_outcome_unknown" };
    } else {
      transition = { nextStatus: "failed", outcomeCertainty: "known", error: safeError(submitted), eventType: "provider_submit_rejected" };
    }
    const finalized = await this.repository.compareAndSet({ jobId: reserved.job.id, expectedVersion: reserved.job.version, ...transition });
    if (!finalized?.ok) return { ...repositoryFailure(finalized, "video_job_finalize_conflict"), status: finalized?.status ?? 409, error: finalized?.error === "video_job_version_conflict" ? "video_job_finalize_conflict" : finalized?.error ?? "video_job_finalize_conflict" };
    const job = jobSnapshot(finalized.job);
    if (submitted?.ok) return { ok: true, status: 202, replayed: false, job };
    return { ...providerFailure(submitted), job };
  }

  async get(jobId) {
    return this.run("get", jobId, async () => {
      const result = await this.repository.getById(jobId);
      return result?.ok ? { ok: true, status: 200, job: jobSnapshot(result.job) } : repositoryFailure(result, "video_job_not_found");
    });
  }

  async refresh(jobId) {
    return this.run("refresh", jobId, () => this.refreshInternal(jobId));
  }

  async refreshInternal(jobId) {
    const loaded = await this.repository.getById(jobId);
    if (!loaded?.ok) return repositoryFailure(loaded, "video_job_not_found");
    const job = loaded.job;
    if (job.status === "submitting") {
      const ageMs = new Date(nowIso(this.now)).getTime() - new Date(job.updatedAt).getTime();
      if (ageMs < this.reservationTimeoutMs) return { ok: false, status: 409, error: "video_submission_in_progress", message: "The provider submission is still in progress.", job: jobSnapshot(job) };
      const stale = await this.repository.compareAndSet({ jobId: job.id, expectedVersion: job.version, nextStatus: "outcome_unknown", outcomeCertainty: "unknown", error: { code: "video_submit_outcome_unknown", message: "The stale submission requires reconciliation.", retryable: false }, eventType: "stale_submission_outcome_unknown" });
      return stale?.ok ? { ok: true, status: 200, job: jobSnapshot(stale.job) } : repositoryFailure(stale, "video_job_refresh_conflict");
    }
    if (isTerminalVideoJobStatus(job.status)) return { ok: true, status: 200, unchanged: true, job: jobSnapshot(job) };
    if (job.status === "outcome_unknown") return { ok: false, status: 409, error: "video_outcome_reconciliation_required", message: "The provider submission outcome requires reconciliation.", job: jobSnapshot(job) };
    if (!job.providerRef) return { ok: false, status: 409, error: "video_job_provider_ref_missing", message: "The video job has no provider reference.", job: jobSnapshot(job) };

    let queried;
    try { queried = await this.provider.getStatus(job.providerRef); }
    catch { queried = { ok: false, status: 502, error: "video_provider_transport_failed", message: "The provider could not be reached.", retryable: true }; }
    if (!queried?.ok) return { ...providerFailure(queried), job: jobSnapshot(job) };
    const nextStatus = queried.job?.status;
    if (!VIDEO_JOB_STATUSES.includes(nextStatus) || ["submitting", "outcome_unknown"].includes(nextStatus)) return { ok: false, status: 502, error: "video_provider_protocol_error", message: "The provider returned an invalid job status.", job: jobSnapshot(job) };
    if (nextStatus === job.status) return { ok: true, status: 200, unchanged: true, job: jobSnapshot(job) };
    if (!canTransitionVideoJobStatus(job.status, nextStatus)) return { ok: false, status: 502, error: "video_provider_protocol_error", message: "The provider returned an illegal job transition.", job: jobSnapshot(job) };
    const error = nextStatus === "failed" ? { code: "video_provider_generation_failed", message: "The provider reported generation failure.", retryable: false } : null;
    const updated = await this.repository.compareAndSet({ jobId: job.id, expectedVersion: job.version, nextStatus, outcomeCertainty: "known", error, eventType: `provider_status_${nextStatus}` });
    return updated?.ok ? { ok: true, status: 200, job: jobSnapshot(updated.job) } : repositoryFailure(updated, "video_job_refresh_conflict");
  }

  async cancel(jobId) {
    return this.run("cancel", jobId, () => this.cancelInternal(jobId));
  }

  async cancelInternal(jobId) {
    const loaded = await this.repository.getById(jobId);
    if (!loaded?.ok) return repositoryFailure(loaded, "video_job_not_found");
    const job = loaded.job;
    if (job.providerRecordDeletedAt) return { ok: true, status: 200, unchanged: true, job: jobSnapshot(job) };
    if (!job.providerRef || ["submitting", "outcome_unknown", "cancelled"].includes(job.status)) return { ok: false, status: 409, error: "video_job_cancel_unavailable", message: "The video job cannot be cancelled in its current state.", job: jobSnapshot(job) };

    let cancelled;
    try { cancelled = await this.provider.cancel(job.providerRef); }
    catch { cancelled = { ok: false, status: 502, error: "video_provider_transport_failed", message: "The provider cancellation outcome requires reconciliation.", retryable: false }; }
    if (!cancelled?.ok) return { ...providerFailure(cancelled), retryable: false, job: jobSnapshot(job) };

    let transition;
    if (cancelled.action === "cancelled" && !isTerminalVideoJobStatus(job.status)) {
      transition = { nextStatus: "cancelled", outcomeCertainty: "known", error: null, eventType: "provider_task_cancelled" };
    } else if (cancelled.action === "deleted" && ["succeeded", "failed"].includes(job.status)) {
      transition = { nextStatus: job.status, outcomeCertainty: job.outcomeCertainty, providerRecordDeletedAt: nowIso(this.now), eventType: "provider_record_deleted", metadataOnly: true };
    } else if (cancelled.action === "deleted" && !isTerminalVideoJobStatus(job.status)) {
      transition = { nextStatus: "outcome_unknown", outcomeCertainty: "unknown", providerRecordDeletedAt: nowIso(this.now), error: { code: "video_cancel_completion_race", message: "The provider record was deleted after a completion race.", retryable: false }, eventType: "provider_delete_outcome_unknown" };
    } else {
      return { ok: false, status: 502, error: "video_provider_protocol_error", message: "The provider returned an invalid cancellation action.", job: jobSnapshot(job) };
    }
    const updated = await this.repository.compareAndSet({ jobId: job.id, expectedVersion: job.version, ...transition });
    return updated?.ok ? { ok: true, status: 200, action: cancelled.action, job: jobSnapshot(updated.job) } : repositoryFailure(updated, "video_job_cancel_conflict");
  }
}
