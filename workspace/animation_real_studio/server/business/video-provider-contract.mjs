export const VIDEO_PROVIDER_PROTOCOL_VERSION = "video-provider.v1";
export const VIDEO_PROVIDER_ID = "minimax-h3-hosted";
export const VIDEO_JOB_STATUSES = Object.freeze(["queued", "running", "succeeded", "failed", "cancelled"]);

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RESOLUTIONS = new Set(["768P", "2K"]);
const STATUS_SET = new Set(VIDEO_JOB_STATUSES);
const text = (value) => typeof value === "string" ? value.trim() : "";
const issue = (field, code, message) => ({ field, code, message });

export function validateVideoGenerationRequest(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) input = {};
  const errors = [];
  const prompt = text(input.prompt);
  const clientRequestId = text(input.clientRequestId);
  const sourceAsset = input.sourceAsset && typeof input.sourceAsset === "object" && !Array.isArray(input.sourceAsset) ? input.sourceAsset : {};
  const output = input.output && typeof input.output === "object" && !Array.isArray(input.output) ? input.output : {};
  const assetId = text(sourceAsset.assetId);
  const sha256 = text(sourceAsset.sha256).toLowerCase();

  if (input.protocolVersion !== VIDEO_PROVIDER_PROTOCOL_VERSION) errors.push(issue("protocolVersion", "video_protocol_version", `Use ${VIDEO_PROVIDER_PROTOCOL_VERSION}.`));
  if (input.mode !== "image_to_video") errors.push(issue("mode", "video_mode", "Only image_to_video is supported in this slice."));
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(clientRequestId)) errors.push(issue("clientRequestId", "video_client_request_id", "Use an 8 to 128 character client request ID."));
  if (prompt.length < 1 || prompt.length > 2000) errors.push(issue("prompt", "video_prompt_length", "Prompt must be between 1 and 2000 characters."));
  if (input.rightsAccepted !== true) errors.push(issue("rightsAccepted", "video_rights_acknowledgement", "Rights and safety acknowledgement is required."));
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/.test(assetId)) errors.push(issue("sourceAsset.assetId", "video_source_asset_id", "A private internal asset ID is required."));
  if (!/^[a-f0-9]{64}$/.test(sha256)) errors.push(issue("sourceAsset.sha256", "video_source_digest", "A SHA-256 source digest is required."));
  if (!IMAGE_MIME_TYPES.has(sourceAsset.mimeType)) errors.push(issue("sourceAsset.mimeType", "video_source_mime", "Use JPEG, PNG, or WebP."));
  if (!Number.isInteger(sourceAsset.width) || sourceAsset.width < 256 || sourceAsset.width > 5760) errors.push(issue("sourceAsset.width", "video_source_dimensions", "Source width must be 256 to 5760 pixels."));
  if (!Number.isInteger(sourceAsset.height) || sourceAsset.height < 256 || sourceAsset.height > 5760) errors.push(issue("sourceAsset.height", "video_source_dimensions", "Source height must be 256 to 5760 pixels."));
  if (Number.isInteger(sourceAsset.width) && Number.isInteger(sourceAsset.height)) {
    const ratio = sourceAsset.width / sourceAsset.height;
    if (ratio < 0.4 || ratio > 2.5) errors.push(issue("sourceAsset", "video_source_aspect_ratio", "Source aspect ratio must be between 0.4 and 2.5."));
  }
  if (Object.hasOwn(sourceAsset, "url") || Object.hasOwn(sourceAsset, "dataUrl") || Object.hasOwn(sourceAsset, "bytes")) errors.push(issue("sourceAsset", "video_source_boundary", "Business requests may contain metadata only, not media bytes or URLs."));
  if (!Number.isInteger(output.durationSeconds) || output.durationSeconds < 4 || output.durationSeconds > 15) errors.push(issue("output.durationSeconds", "video_duration", "Duration must be an integer from 4 to 15 seconds."));
  if (!RESOLUTIONS.has(output.resolution)) errors.push(issue("output.resolution", "video_resolution", "Resolution must be 768P or 2K."));
  if (output.ratio !== "adaptive") errors.push(issue("output.ratio", "video_ratio", "Image-to-video uses the source image ratio and must be adaptive."));

  return {
    errors,
    request: errors.length ? null : {
      protocolVersion: VIDEO_PROVIDER_PROTOCOL_VERSION,
      mode: "image_to_video",
      clientRequestId,
      prompt,
      rightsAccepted: true,
      sourceAsset: { assetId, sha256, mimeType: sourceAsset.mimeType, width: sourceAsset.width, height: sourceAsset.height },
      output: { durationSeconds: output.durationSeconds, resolution: output.resolution, ratio: "adaptive" },
    },
  };
}

export function normalizeVideoJobStatus(value) {
  return STATUS_SET.has(value) ? value : null;
}

const disabled = () => ({ ok: false, status: 503, error: "video_provider_disabled", message: "Video generation is not enabled." });

export class DisabledVideoProvider {
  capabilities() {
    return { providerId: "disabled", protocolVersion: VIDEO_PROVIDER_PROTOCOL_VERSION, enabled: false, modes: [] };
  }
  async submit() { return disabled(); }
  async getStatus() { return disabled(); }
  async cancel() { return disabled(); }
  async fetchArtifacts() { return disabled(); }
}
