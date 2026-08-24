import assert from "node:assert/strict";
import test from "node:test";
import { DisabledVideoProvider, VIDEO_PROVIDER_PROTOCOL_VERSION, normalizeVideoJobStatus, validateVideoGenerationRequest } from "./business/video-provider-contract.mjs";
import { createVideoProvider } from "./composition-root.mjs";

const validRequest = {
  protocolVersion: VIDEO_PROVIDER_PROTOCOL_VERSION,
  mode: "image_to_video",
  clientRequestId: "video-request-0001",
  prompt: "A fictional original scene slowly comes alive as the camera pushes in.",
  rightsAccepted: true,
  sourceAsset: { assetId: "asset-selected-0001", sha256: "a".repeat(64), mimeType: "image/png", width: 1080, height: 1920 },
  output: { durationSeconds: 8, resolution: "768P", ratio: "adaptive" },
};

test("video-provider.v1 accepts internal metadata and rejects URLs, bytes, and invalid H3 I2V output", () => {
  const valid = validateVideoGenerationRequest(validRequest);
  assert.equal(valid.errors.length, 0);
  assert.equal(valid.request.sourceAsset.assetId, "asset-selected-0001");
  assert.equal(Object.hasOwn(valid.request.sourceAsset, "url"), false);

  for (const sourceAsset of [
    { ...validRequest.sourceAsset, url: "https://private.example/source.png" },
    { ...validRequest.sourceAsset, dataUrl: "data:image/png;base64,AAAA" },
    { ...validRequest.sourceAsset, bytes: [1, 2, 3] },
  ]) assert.ok(validateVideoGenerationRequest({ ...validRequest, sourceAsset }).errors.some((entry) => entry.code === "video_source_boundary"));

  assert.ok(validateVideoGenerationRequest({ ...validRequest, output: { ...validRequest.output, durationSeconds: 16 } }).errors.some((entry) => entry.code === "video_duration"));
  assert.ok(validateVideoGenerationRequest({ ...validRequest, output: { ...validRequest.output, resolution: "1080P" } }).errors.some((entry) => entry.code === "video_resolution"));
  assert.ok(validateVideoGenerationRequest({ ...validRequest, output: { ...validRequest.output, ratio: "9:16" } }).errors.some((entry) => entry.code === "video_ratio"));
  assert.ok(validateVideoGenerationRequest(null).errors.length > 0);
  assert.ok(validateVideoGenerationRequest([]).errors.length > 0);
});

test("provider statuses are fail-closed and the application composition stays disabled", async () => {
  for (const status of ["queued", "running", "succeeded", "failed", "cancelled"]) assert.equal(normalizeVideoJobStatus(status), status);
  assert.equal(normalizeVideoJobStatus("Success"), null);
  const provider = createVideoProvider();
  assert.ok(provider instanceof DisabledVideoProvider);
  assert.equal(provider.capabilities().enabled, false);
  assert.equal((await provider.submit(validRequest)).error, "video_provider_disabled");
});
