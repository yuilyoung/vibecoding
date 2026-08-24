import { VIDEO_PROVIDER_ID, VIDEO_PROVIDER_PROTOCOL_VERSION, normalizeVideoJobStatus, validateVideoGenerationRequest } from "../business/video-provider-contract.mjs";

const API_BASE = "https://api.minimax.io";
const TASK_ID = /^[A-Za-z0-9_-]{1,128}$/;
const HTTP_ERRORS = Object.freeze({
  400: "video_provider_bad_request",
  401: "video_provider_unauthorized",
  402: "video_provider_balance_required",
  422: "video_provider_content_rejected",
  429: "video_provider_rate_limited",
  500: "video_provider_unavailable",
});
const SAFE_MESSAGES = Object.freeze({
  video_provider_bad_request: "The provider rejected the request parameters.",
  video_provider_unauthorized: "The provider credential was rejected.",
  video_provider_balance_required: "The provider account has insufficient balance.",
  video_provider_content_rejected: "The provider rejected the media or prompt.",
  video_provider_rate_limited: "The provider rate limit was reached.",
  video_provider_unavailable: "The provider is temporarily unavailable.",
});

function providerError(status, operation) {
  const error = HTTP_ERRORS[status] ?? "video_provider_http_error";
  return { ok: false, status: status >= 400 && status <= 599 ? status : 502, error, message: SAFE_MESSAGES[error] ?? "The provider request failed.", retryable: operation === "query" && (status === 429 || status >= 500) };
}

function validHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

function safeAsset(value) {
  if (!value || typeof value !== "object") return null;
  const { assetId, sha256, mimeType, width, height, durationSeconds } = value;
  if (!TASK_ID.test(assetId ?? "") || !/^[a-f0-9]{64}$/.test(sha256 ?? "") || mimeType !== "video/mp4") return null;
  if (!Number.isInteger(width) || !Number.isInteger(height) || !Number.isInteger(durationSeconds)) return null;
  return { assetId, sha256, mimeType, width, height, durationSeconds };
}

export class MiniMaxH3HostedAdapter {
  constructor({ enabled = false, apiKey = "", fetchImpl, mediaBroker, timeoutMs = 30_000 } = {}) {
    this.enabled = enabled;
    this.apiKey = typeof apiKey === "string" ? apiKey.trim() : "";
    this.fetchImpl = fetchImpl;
    this.mediaBroker = mediaBroker;
    this.timeoutMs = timeoutMs;
  }

  capabilities() {
    return { providerId: VIDEO_PROVIDER_ID, protocolVersion: VIDEO_PROVIDER_PROTOCOL_VERSION, enabled: this.enabled, model: "MiniMax-H3", modes: ["image_to_video"], durationSeconds: { min: 4, max: 15 }, resolutions: ["768P", "2K"] };
  }

  preflight() {
    if (!this.enabled) return { ok: false, status: 503, error: "video_provider_disabled", message: "Video generation is not enabled." };
    if (!this.apiKey || typeof this.fetchImpl !== "function" || !this.mediaBroker) return { ok: false, status: 503, error: "video_provider_not_configured", message: "The video provider is not configured." };
    return null;
  }

  validateJobRef(jobRef) {
    if (jobRef?.providerId !== VIDEO_PROVIDER_ID || !TASK_ID.test(jobRef?.taskId ?? "")) return { ok: false, status: 422, error: "video_job_ref_invalid", message: "The video job reference is invalid." };
    return null;
  }

  async request(path, options, operation) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${API_BASE}${path}`, { ...options, signal: controller.signal });
      if (!response || typeof response.ok !== "boolean" || typeof response.json !== "function") throw new Error("invalid response");
      if (!response.ok) return providerError(response.status, operation);
      let payload;
      try { payload = await response.json(); }
      catch { return operation === "submit" ? { ok: false, status: 502, error: "video_submit_outcome_unknown", message: "The provider submit result is unknown.", retryable: false } : { ok: false, status: 502, error: "video_provider_protocol_error", message: "The provider returned an invalid response.", retryable: false }; }
      return { ok: true, payload };
    } catch {
      return operation === "submit"
        ? { ok: false, status: 502, error: "video_submit_outcome_unknown", message: "The provider submit result is unknown.", retryable: false }
        : { ok: false, status: 502, error: "video_provider_transport_failed", message: "The provider could not be reached.", retryable: operation === "query" };
    } finally { clearTimeout(timeout); }
  }

  headers() {
    return { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
  }

  async submit(input) {
    const blocked = this.preflight();
    if (blocked) return blocked;
    const { errors, request } = validateVideoGenerationRequest(input);
    if (errors.length) return { ok: false, status: 422, error: "video_request_invalid", message: "The video request is invalid.", errors };

    let media;
    try { media = await this.mediaBroker.createProviderInput(request.sourceAsset, { providerId: VIDEO_PROVIDER_ID, purpose: "video_generation" }); }
    catch { media = null; }
    if (!media?.ok || !validHttpsUrl(media.url)) return { ok: false, status: 503, error: "video_media_unavailable", message: "The source image cannot be prepared for the provider." };

    const body = {
      model: "MiniMax-H3",
      content: [
        { type: "text", text: request.prompt },
        { type: "image_url", image_url: { url: media.url }, role: "first_frame" },
      ],
      resolution: request.output.resolution,
      duration: request.output.durationSeconds,
      ratio: "adaptive",
    };
    const result = await this.request("/v2/video_generation", { method: "POST", headers: this.headers(), body: JSON.stringify(body) }, "submit");
    if (!result.ok) return result;
    if (!TASK_ID.test(result.payload?.task_id ?? "")) return { ok: false, status: 502, error: "video_submit_outcome_unknown", message: "The provider submit result is unknown.", retryable: false };
    return { ok: true, status: 202, jobRef: { providerId: VIDEO_PROVIDER_ID, taskId: result.payload.task_id }, job: { status: "queued", artifactAvailable: false } };
  }

  async queryTask(jobRef) {
    const blocked = this.preflight() ?? this.validateJobRef(jobRef);
    if (blocked) return blocked;
    const result = await this.request(`/v2/query/video_generation/${encodeURIComponent(jobRef.taskId)}`, { method: "GET", headers: this.headers() }, "query");
    if (!result.ok) return result;
    const task = result.payload?.task;
    const status = normalizeVideoJobStatus(task?.status);
    if (!task || task.id !== jobRef.taskId || task.model !== "MiniMax-H3" || !status) return { ok: false, status: 502, error: "video_provider_protocol_error", message: "The provider returned an invalid task state.", retryable: false };
    const artifactUrl = status === "succeeded" ? task.content?.url : null;
    if (status === "succeeded" && !validHttpsUrl(artifactUrl)) return { ok: false, status: 502, error: "video_provider_protocol_error", message: "The provider returned an invalid task artifact.", retryable: false };
    return { ok: true, status: 200, providerTask: { status, artifactUrl } };
  }

  async getStatus(jobRef) {
    const result = await this.queryTask(jobRef);
    if (!result.ok) return result;
    return { ok: true, status: 200, jobRef: { providerId: VIDEO_PROVIDER_ID, taskId: jobRef.taskId }, job: { status: result.providerTask.status, artifactAvailable: result.providerTask.status === "succeeded" } };
  }

  async cancel(jobRef) {
    const blocked = this.preflight() ?? this.validateJobRef(jobRef);
    if (blocked) return blocked;
    const result = await this.request(`/v2/video_generation/${encodeURIComponent(jobRef.taskId)}`, { method: "DELETE", headers: this.headers() }, "cancel");
    if (!result.ok) return result;
    if (result.payload?.task_id !== jobRef.taskId || !["cancelled", "deleted"].includes(result.payload?.action) || result.payload.action !== result.payload.status) return { ok: false, status: 502, error: "video_provider_protocol_error", message: "The provider returned an invalid cancellation result.", retryable: false };
    return { ok: true, status: 200, jobRef: { providerId: VIDEO_PROVIDER_ID, taskId: jobRef.taskId }, action: result.payload.action };
  }

  async fetchArtifacts(jobRef) {
    const result = await this.queryTask(jobRef);
    if (!result.ok) return result;
    if (result.providerTask.status !== "succeeded") return { ok: false, status: 409, error: "video_artifact_not_ready", message: "The video artifact is not ready." };
    let imported;
    try { imported = await this.mediaBroker.importProviderArtifact({ providerId: VIDEO_PROVIDER_ID, taskId: jobRef.taskId, url: result.providerTask.artifactUrl, mimeType: "video/mp4" }, { purpose: "private_video_delivery" }); }
    catch { imported = null; }
    const asset = imported?.ok ? safeAsset(imported.asset) : null;
    if (!asset) return { ok: false, status: 502, error: "video_artifact_import_failed", message: "The provider artifact could not be imported." };
    return { ok: true, status: 200, jobRef: { providerId: VIDEO_PROVIDER_ID, taskId: jobRef.taskId }, asset };
  }
}
