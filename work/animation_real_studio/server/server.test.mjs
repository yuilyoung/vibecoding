import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createStudioHttpServer } from "./server.mjs";
import { StudioService } from "./studio-service.mjs";

const validRequest = { scene: "A commuter pauses at a rain-soaked station, then gives a hand-written apology to a friend before the final train departs.", sourceRelationship: "original", rightsAccepted: true, direction: "rainy-station" };

async function withServer(run) {
  const scheduled = [];
  const service = new StudioService({ schedule: (work) => scheduled.push(work) });
  const server = createStudioHttpServer(service);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  try { return await run(`http://127.0.0.1:${address.port}`, scheduled); }
  finally { server.close(); await once(server, "close"); }
}

test("HTTP API completes a local original project with 2D preview stills", async () => {
  await withServer(async (baseUrl, scheduled) => {
    const created = await fetch(`${baseUrl}/api/projects`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validRequest) });
    assert.equal(created.status, 201);
    const project = (await created.json()).project;
    assert.equal(project.status, "local_preflight_ready");
    assert.equal(project.localPrecheck.status, "not_a_policy_decision");
    const queued = await fetch(`${baseUrl}/api/projects/${project.id}/approve`, { method: "POST" });
    assert.equal(queued.status, 202);
    scheduled.shift()();
    scheduled.shift()();
    const completed = await fetch(`${baseUrl}/api/projects/${project.id}`);
    const completedProject = (await completed.json()).project;
    assert.equal(completedProject.status, "completed");
    assert.equal(completedProject.delivery.mode, "local_2d_preview");
    assert.equal(completedProject.delivery.assets.length, 4);
    assert.equal(completedProject.delivery.assets[0].mimeType, "image/svg+xml");
  });
});

test("HTTP API rejects protected-work and copied-scene wording in UTF-8 JSON", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/projects`, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ ...validRequest, scene: "원피스 루피가 등장하는 장면을 정확하게 재현해 줘. 카메라는 원작과 똑같이 움직인다." }) });
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.errors[0].field, "scene");
  });
});
test("HTTP API exposes a disabled provider and rejects POST without its local capability", async () => {
  await withServer(async (baseUrl) => {
    const initial = await fetch(`${baseUrl}/api/headless-image-spike`);
    assert.equal(initial.status, 200);
    const body = await initial.json();
    assert.equal(body.generation, null);
    assert.equal(typeof body.capabilityToken, "string");
    const rejected = await fetch(`${baseUrl}/api/headless-image-spike`, { method: "POST" });
    assert.equal(rejected.status, 403);
    assert.equal((await rejected.json()).error, "invalid_local_capability");
    const started = await fetch(`${baseUrl}/api/headless-image-spike`, { method: "POST", headers: { "X-Studio-Local-Token": body.capabilityToken } });
    assert.equal(started.status, 503);
    assert.equal((await started.json()).error, "provider_not_configured");
  });
});

test("HTTP API maps an injected fixed headless probe result after token validation", async () => {
  const provider = {
    status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
    generateProbe: async () => ({ id: "probe", kind: "headless_photorealistic_probe", generatedByAi: true, mimeType: "image/png", width: 9, height: 16, targetAspectRatio: "9:16", returnedAspectRatio: "9:16", dataUri: "data:image/png;base64,AA==" }),
  };
  const service = new StudioService({ headlessImageProvider: provider, createLocalCapabilityToken: () => "test-local-token" });
  const server = createStudioHttpServer(service);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  try {
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const initial = await fetch(`${baseUrl}/api/headless-image-spike`);
    const capabilityToken = (await initial.json()).capabilityToken;
    assert.equal((await fetch(`${baseUrl}/api/headless-image-spike`, { method: "POST" })).status, 403);
    const started = await fetch(`${baseUrl}/api/headless-image-spike`, { method: "POST", headers: { "X-Studio-Local-Token": capabilityToken } });
    assert.equal(started.status, 202);
    assert.deepEqual((await started.json()).generation.job, { mode: "developer_image_probe", phase: "queued", progress: 0 });
    let generation;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/headless-image-spike`);
      generation = (await response.json()).generation;
      if (generation?.status !== "in_progress") break;
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(generation.status, "completed");
    assert.deepEqual(generation.job, { mode: "developer_image_probe", phase: "completed", progress: 100 });
    assert.equal(generation.asset.mimeType, "image/png");
    assert.equal(generation.asset.targetAspectRatio, "9:16");
  } finally { server.close(); await once(server, "close"); }
});
test("HTTP API returns current probe state with in-flight and allowance rejections", async () => {
  let resolveProbe;
  const provider = {
    status: () => ({ enabled: true, provider: "codex-headless-imagegen", mode: "fixed_original_probe", notice: "enabled" }),
    generateProbe: () => new Promise((resolve) => { resolveProbe = resolve; }),
  };
  const service = new StudioService({ headlessImageProvider: provider, createLocalCapabilityToken: () => "test-local-token", maxHeadlessImageProbeAttempts: 1 });
  const server = createStudioHttpServer(service);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  try {
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const started = await fetch(`${baseUrl}/api/headless-image-spike`, { method: "POST", headers: { "X-Studio-Local-Token": "test-local-token" } });
    assert.equal(started.status, 202);
    assert.equal((await started.json()).remainingAttempts, 0);
    const inFlight = await fetch(`${baseUrl}/api/headless-image-spike`, { method: "POST", headers: { "X-Studio-Local-Token": "test-local-token" } });
    assert.equal(inFlight.status, 409);
    const inFlightBody = await inFlight.json();
    assert.equal(inFlightBody.error, "probe_in_flight");
    assert.equal(inFlightBody.generation.status, "in_progress");
    assert.equal(inFlightBody.remainingAttempts, 0);
    resolveProbe({ id: "probe", mimeType: "image/png", width: 9, height: 16, targetAspectRatio: "9:16", returnedAspectRatio: "9:16", dataUri: "data:image/png;base64,AA==" });
    await new Promise((resolve) => setImmediate(resolve));
    const exhausted = await fetch(`${baseUrl}/api/headless-image-spike`, { method: "POST", headers: { "X-Studio-Local-Token": "test-local-token" } });
    assert.equal(exhausted.status, 429);
    const exhaustedBody = await exhausted.json();
    assert.equal(exhaustedBody.error, "probe_allowance_exhausted");
    assert.equal(exhaustedBody.generation.status, "completed");
    assert.equal(exhaustedBody.remainingAttempts, 0);
  } finally { server.close(); await once(server, "close"); }
});