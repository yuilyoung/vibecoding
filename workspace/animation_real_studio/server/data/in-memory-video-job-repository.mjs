import { VIDEO_JOB_PROTOCOL_VERSION, canTransitionVideoJobStatus, isTerminalVideoJobStatus } from "../business/video-job-service.mjs";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const clone = (value) => value == null ? value : structuredClone(value);
const iso = (now) => {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Clock must return a valid date.");
  return date.toISOString();
};
const providerKey = (ref) => ref ? `${ref.providerId}:${ref.taskId}` : null;
const isIsoTimestamp = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;

export class InMemoryVideoJobRepository {
  constructor({ now, idFactory } = {}) {
    if (typeof now !== "function" || typeof idFactory !== "function") throw new Error("InMemoryVideoJobRepository requires injected now and idFactory.");
    this.now = now;
    this.idFactory = idFactory;
    this.jobs = new Map();
    this.clientRequests = new Map();
    this.providerRefs = new Map();
    this.events = new Map();
  }

  appendEvent(job, { eventType, previousStatus, nextStatus, errorCode = null, terminal = false }) {
    const events = this.events.get(job.id) ?? [];
    if (terminal && events.some((event) => event.terminal)) return { ok: false, status: 409, error: "video_job_terminal_event_exists", message: "The video job already has a terminal event." };
    const event = {
      jobId: job.id,
      sequence: events.length + 1,
      eventType,
      previousStatus,
      nextStatus,
      errorCode,
      terminal,
      occurredAt: job.updatedAt,
      jobVersion: job.version,
    };
    events.push(event);
    this.events.set(job.id, events);
    return { ok: true, event };
  }

  async reserve({ clientRequestId, requestDigest, requestSummary, protocolVersion } = {}) {
    if (!SAFE_ID.test(clientRequestId ?? "") || !DIGEST.test(requestDigest ?? "") || protocolVersion !== VIDEO_JOB_PROTOCOL_VERSION || !requestSummary) return { ok: false, status: 422, error: "video_job_reservation_invalid", message: "The video job reservation is invalid." };
    const existingId = this.clientRequests.get(clientRequestId);
    if (existingId) {
      const existing = this.jobs.get(existingId);
      if (existing.requestDigest !== requestDigest) return { ok: false, status: 409, error: "video_idempotency_conflict", message: "The client request ID was already used for different input.", job: clone(existing) };
      return { ok: true, status: 200, created: false, job: clone(existing) };
    }
    const id = this.idFactory();
    if (!SAFE_ID.test(id ?? "") || this.jobs.has(id)) return { ok: false, status: 500, error: "video_job_id_invalid", message: "The video job ID could not be allocated." };
    const at = iso(this.now);
    const job = {
      id,
      protocolVersion: VIDEO_JOB_PROTOCOL_VERSION,
      clientRequestId,
      requestDigest,
      requestSummary: clone(requestSummary),
      status: "submitting",
      outcomeCertainty: "pending",
      providerRef: null,
      providerRecordDeletedAt: null,
      error: null,
      version: 1,
      createdAt: at,
      updatedAt: at,
    };
    this.jobs.set(id, job);
    this.clientRequests.set(clientRequestId, id);
    const appended = this.appendEvent(job, { eventType: "job_reserved", previousStatus: null, nextStatus: "submitting" });
    if (!appended.ok) throw new Error("Initial video job event could not be recorded.");
    return { ok: true, status: 201, created: true, job: clone(job) };
  }

  async getById(jobId) {
    const job = this.jobs.get(jobId);
    return job ? { ok: true, status: 200, job: clone(job) } : { ok: false, status: 404, error: "video_job_not_found", message: "Video job not found." };
  }

  async getByClientRequestId(clientRequestId) {
    const id = this.clientRequests.get(clientRequestId);
    return id ? this.getById(id) : { ok: false, status: 404, error: "video_job_not_found", message: "Video job not found." };
  }

  async listEvents(jobId) {
    if (!this.jobs.has(jobId)) return { ok: false, status: 404, error: "video_job_not_found", message: "Video job not found." };
    return { ok: true, status: 200, events: clone(this.events.get(jobId) ?? []) };
  }

  async compareAndSet({ jobId, expectedVersion, nextStatus, outcomeCertainty, providerRef, providerRecordDeletedAt, error, eventType, metadataOnly = false } = {}) {
    const current = this.jobs.get(jobId);
    if (!current) return { ok: false, status: 404, error: "video_job_not_found", message: "Video job not found." };
    if (current.version !== expectedVersion) return { ok: false, status: 409, error: "video_job_version_conflict", message: "The video job changed before this update.", job: clone(current) };
    if (!canTransitionVideoJobStatus(current.status, nextStatus, { metadataOnly })) return { ok: false, status: 409, error: "video_job_transition_invalid", message: "The video job transition is invalid.", job: clone(current) };
    if (!["pending", "known", "unknown"].includes(outcomeCertainty)) return { ok: false, status: 422, error: "video_job_certainty_invalid", message: "The video job certainty is invalid." };
    if (metadataOnly && !(
      ["succeeded", "failed"].includes(current.status)
      && nextStatus === current.status
      && outcomeCertainty === current.outcomeCertainty
      && providerRef === undefined
      && current.providerRecordDeletedAt === null
      && isIsoTimestamp(providerRecordDeletedAt)
      && error === undefined
      && eventType === "provider_record_deleted"
    )) return { ok: false, status: 409, error: "video_job_metadata_update_invalid", message: "Only terminal provider-record deletion metadata may be updated.", job: clone(current) };
    const nextProviderRef = providerRef === undefined ? current.providerRef : providerRef ? { providerId: providerRef.providerId, taskId: providerRef.taskId } : null;
    if (nextProviderRef) {
      if (!SAFE_ID.test(nextProviderRef.providerId ?? "") || !SAFE_ID.test(nextProviderRef.taskId ?? "")) return { ok: false, status: 422, error: "video_job_provider_ref_invalid", message: "The provider job reference is invalid." };
      const key = providerKey(nextProviderRef);
      const owner = this.providerRefs.get(key);
      if (owner && owner !== current.id) return { ok: false, status: 409, error: "video_job_provider_ref_conflict", message: "The provider job reference is already in use." };
    }
    const at = iso(this.now);
    const updated = {
      ...current,
      status: nextStatus,
      outcomeCertainty,
      providerRef: nextProviderRef ? clone(nextProviderRef) : null,
      providerRecordDeletedAt: providerRecordDeletedAt === undefined ? current.providerRecordDeletedAt : providerRecordDeletedAt,
      error: error === undefined ? current.error : clone(error),
      version: current.version + 1,
      updatedAt: at,
    };
    const terminal = !isTerminalVideoJobStatus(current.status) && isTerminalVideoJobStatus(nextStatus);
    const priorEvents = this.events.get(jobId) ?? [];
    if (terminal && priorEvents.some((event) => event.terminal)) return { ok: false, status: 409, error: "video_job_terminal_event_exists", message: "The video job already has a terminal event.", job: clone(current) };
    const oldKey = providerKey(current.providerRef);
    const newKey = providerKey(updated.providerRef);
    if (oldKey && oldKey !== newKey) this.providerRefs.delete(oldKey);
    if (newKey) this.providerRefs.set(newKey, current.id);
    this.jobs.set(jobId, updated);
    const appended = this.appendEvent(updated, { eventType: eventType ?? "job_transition", previousStatus: current.status, nextStatus, errorCode: updated.error?.code ?? null, terminal });
    if (!appended.ok) throw new Error("Video job event could not be recorded.");
    return { ok: true, status: 200, job: clone(updated), event: clone(appended.event) };
  }
}
