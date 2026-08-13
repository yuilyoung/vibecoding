import assert from "node:assert/strict";
import test from "node:test";
import { createStudioHttpServer } from "./server.mjs";

async function withServer(batchService, run) {
  const server = createStudioHttpServer({}, batchService);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await run(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("HTTP image-batch.v1 maps create, poll, and selection responses", async () => {
  const calls = [];
  const batch = { id: "batch-0001", protocolVersion: "image-batch.v1", status: "in_progress", variants: [], selection: null };
  const batchService = {
    async createBatch(input) { calls.push(["create", input]); return { ok: true, status: 202, batch }; },
    async getBatch(id) { calls.push(["get", id]); return { ok: true, status: 200, batch: { ...batch, status: "completed" } }; },
    async selectVariant(id, variantId) { calls.push(["select", id, variantId]); return { ok: true, status: 200, batch: { ...batch, status: "completed", selection: { variantId, revision: 1 } } }; },
  };
  await withServer(batchService, async (baseUrl) => {
    const created = await fetch(`${baseUrl}/api/image-batches`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: "image-batch.v1" }) });
    assert.equal(created.status, 202);
    assert.equal((await created.json()).batch.id, "batch-0001");
    const polled = await fetch(`${baseUrl}/api/image-batches/batch-0001`);
    assert.equal(polled.status, 200);
    assert.equal((await polled.json()).batch.status, "completed");
    const selected = await fetch(`${baseUrl}/api/image-batches/batch-0001/selection`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId: "batch-0001-variant-1" }) });
    assert.equal(selected.status, 200);
    assert.equal((await selected.json()).batch.selection.revision, 1);
  });
  assert.deepEqual(calls.map((call) => call[0]), ["create", "get", "select"]);
});

test("HTTP image batch rejects invalid JSON and preserves business errors", async () => {
  const batchService = {
    async createBatch() { return { ok: false, status: 422, error: "batch_validation_failed", errors: [{ code: "batch_count", message: "Choose between one and three variants." }] }; },
    async getBatch() { return { ok: false, status: 404, error: "batch_not_found", message: "Image batch not found." }; },
    async selectVariant() { return { ok: false, status: 409, error: "batch_selection_invalid", message: "Select a completed result from this batch." }; },
  };
  await withServer(batchService, async (baseUrl) => {
    const invalidJson = await fetch(`${baseUrl}/api/image-batches`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(invalidJson.status, 400);
    const validation = await fetch(`${baseUrl}/api/image-batches`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(validation.status, 422);
    assert.equal((await validation.json()).errors[0].code, "batch_count");
    const selection = await fetch(`${baseUrl}/api/image-batches/batch-0001/selection`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId: "missing" }) });
    assert.equal(selection.status, 409);
    assert.equal((await selection.json()).error, "batch_selection_invalid");
  });
});
