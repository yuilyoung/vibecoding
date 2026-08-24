import assert from "node:assert/strict";
import test from "node:test";
import { MiniMaxH3HostedAdapter } from "./data/minimax-h3-hosted-adapter.mjs";
import { VIDEO_PROVIDER_ID, VIDEO_PROVIDER_PROTOCOL_VERSION } from "./business/video-provider-contract.mjs";

const jobRef = { providerId: VIDEO_PROVIDER_ID, taskId: "424010985738629" };
const validRequest = {
  protocolVersion: VIDEO_PROVIDER_PROTOCOL_VERSION,
  mode: "image_to_video",
  clientRequestId: "video-request-0001",
  prompt: "A fictional original scene slowly comes alive as the camera pushes in.",
  rightsAccepted: true,
  sourceAsset: { assetId: "asset-selected-0001", sha256: "a".repeat(64), mimeType: "image/png", width: 1080, height: 1920 },
  output: { durationSeconds: 8, resolution: "768P", ratio: "adaptive" },
};
const response = (status, payload) => ({ ok: status >= 200 && status < 300, status, async json() { return payload; } });
const broker = (overrides = {}) => ({
  async createProviderInput() { return { ok: true, url: "https://media.example.test/input.png?signature=private" }; },
  async importProviderArtifact() { return { ok: true, asset: { assetId: "video-asset-0001", sha256: "b".repeat(64), mimeType: "video/mp4", width: 1080, height: 1920, durationSeconds: 8 } }; },
  ...overrides,
});

test("disabled, missing credential, and media refusal fail before H3 fetch", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return response(200, { task_id: jobRef.taskId }); };
  assert.equal((await new MiniMaxH3HostedAdapter({ fetchImpl, mediaBroker: broker() }).submit(validRequest)).error, "video_provider_disabled");
  assert.equal((await new MiniMaxH3HostedAdapter({ enabled: true, fetchImpl, mediaBroker: broker() }).submit(validRequest)).error, "video_provider_not_configured");
  assert.equal((await new MiniMaxH3HostedAdapter({ enabled: true, apiKey: "test-key", fetchImpl, mediaBroker: broker({ async createProviderInput() { return { ok: false }; } }) }).submit(validRequest)).error, "video_media_unavailable");
  assert.equal(calls, 0);
});

test("submit maps one first-frame request to the official MiniMax-H3 v2 dialect", async () => {
  const seen = [];
  const adapter = new MiniMaxH3HostedAdapter({ enabled: true, apiKey: "secret-test-key", mediaBroker: broker(), fetchImpl: async (url, init) => { seen.push({ url, init }); return response(200, { task_id: jobRef.taskId }); } });
  const result = await adapter.submit(validRequest);
  assert.deepEqual(result, { ok: true, status: 202, jobRef, job: { status: "queued", artifactAvailable: false } });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, "https://api.minimax.io/v2/video_generation");
  assert.equal(seen[0].init.method, "POST");
  assert.equal(seen[0].init.headers.Authorization, "Bearer secret-test-key");
  assert.deepEqual(JSON.parse(seen[0].init.body), {
    model: "MiniMax-H3",
    content: [
      { type: "text", text: validRequest.prompt },
      { type: "image_url", image_url: { url: "https://media.example.test/input.png?signature=private" }, role: "first_frame" },
    ],
    resolution: "768P",
    duration: 8,
    ratio: "adaptive",
  });
});

test("submit never retries and maps documented provider HTTP failures to stable safe errors", async () => {
  const expected = new Map([[400, "video_provider_bad_request"], [401, "video_provider_unauthorized"], [402, "video_provider_balance_required"], [422, "video_provider_content_rejected"], [429, "video_provider_rate_limited"], [500, "video_provider_unavailable"]]);
  for (const [status, error] of expected) {
    let calls = 0;
    const adapter = new MiniMaxH3HostedAdapter({ enabled: true, apiKey: "secret", mediaBroker: broker(), fetchImpl: async () => { calls += 1; return response(status, { error: { message: "provider secret body https://private.example" } }); } });
    const result = await adapter.submit(validRequest);
    assert.equal(result.error, error);
    assert.equal(result.retryable, false);
    assert.equal(calls, 1);
    assert.doesNotMatch(JSON.stringify(result), /provider secret body|private\.example|secret-test-key/);
  }
});

test("ambiguous submit transport and malformed success become outcome_unknown without retry", async () => {
  for (const fetchImpl of [async () => { throw new Error("timeout with private URL"); }, async () => response(200, {})]) {
    let calls = 0;
    const adapter = new MiniMaxH3HostedAdapter({ enabled: true, apiKey: "secret", mediaBroker: broker(), fetchImpl: async (...args) => { calls += 1; return fetchImpl(...args); } });
    const result = await adapter.submit(validRequest);
    assert.equal(result.error, "video_submit_outcome_unknown");
    assert.equal(result.retryable, false);
    assert.equal(calls, 1);
  }
});

test("query normalizes every H3 state and never exposes the provider artifact URL", async () => {
  for (const status of ["queued", "running", "succeeded", "failed", "cancelled"]) {
    const privateUrl = "https://cdn.example.test/private-output.mp4?token=secret";
    const adapter = new MiniMaxH3HostedAdapter({ enabled: true, apiKey: "secret", mediaBroker: broker(), fetchImpl: async (url, init) => {
      assert.equal(url, `https://api.minimax.io/v2/query/video_generation/${jobRef.taskId}`);
      assert.equal(init.method, "GET");
      return response(200, { task: { id: jobRef.taskId, model: "MiniMax-H3", status, ...(status === "succeeded" ? { content: { url: privateUrl } } : {}) } });
    } });
    const result = await adapter.getStatus(jobRef);
    assert.equal(result.job.status, status);
    assert.equal(result.job.artifactAvailable, status === "succeeded");
    assert.doesNotMatch(JSON.stringify(result), /private-output|token=secret/);
  }
});

test("cancel uses the H3 v2 task endpoint and validates cancelled or deleted actions", async () => {
  for (const action of ["cancelled", "deleted"]) {
    const adapter = new MiniMaxH3HostedAdapter({ enabled: true, apiKey: "secret", mediaBroker: broker(), fetchImpl: async (url, init) => {
      assert.equal(url, `https://api.minimax.io/v2/video_generation/${jobRef.taskId}`);
      assert.equal(init.method, "DELETE");
      return response(200, { task_id: jobRef.taskId, action, status: action });
    } });
    assert.equal((await adapter.cancel(jobRef)).action, action);
  }
});

test("cancel transport and provider failures require reconciliation and are never marked retryable", async () => {
  for (const fetchImpl of [async () => response(429, {}), async () => response(500, {}), async () => { throw new Error("ambiguous delete"); }]) {
    let calls = 0;
    const adapter = new MiniMaxH3HostedAdapter({ enabled: true, apiKey: "secret", mediaBroker: broker(), fetchImpl: async (...args) => { calls += 1; return fetchImpl(...args); } });
    const result = await adapter.cancel(jobRef);
    assert.equal(result.ok, false);
    assert.equal(result.retryable, false);
    assert.equal(calls, 1);
  }
});

test("artifact import keeps both provider URLs outside the Business result", async () => {
  let imported;
  const adapter = new MiniMaxH3HostedAdapter({ enabled: true, apiKey: "secret", mediaBroker: broker({ async importProviderArtifact(value) { imported = value; return { ok: true, asset: { assetId: "video-asset-0001", sha256: "b".repeat(64), mimeType: "video/mp4", width: 1080, height: 1920, durationSeconds: 8 } }; } }), fetchImpl: async () => response(200, { task: { id: jobRef.taskId, model: "MiniMax-H3", status: "succeeded", content: { url: "https://cdn.example.test/output.mp4?token=private" } } }) });
  const result = await adapter.fetchArtifacts(jobRef);
  assert.equal(imported.url, "https://cdn.example.test/output.mp4?token=private");
  assert.deepEqual(result.asset, { assetId: "video-asset-0001", sha256: "b".repeat(64), mimeType: "video/mp4", width: 1080, height: 1920, durationSeconds: 8 });
  assert.doesNotMatch(JSON.stringify(result), /cdn\.example|token=private/);
});
