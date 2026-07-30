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

test("HTTP API creates only a local-preflight record and completes a mock-only job", async () => {
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
    assert.deepEqual(completedProject.delivery.assets, []);
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