import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { StudioService } from "./studio-service.mjs";
import { createImageBatchService } from "./composition-root.mjs";

const send = (response, status, body) => { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); response.end(JSON.stringify(body)); };
async function readJson(request, maxBytes = 1024 * 1024) {
  const chunks = [];
  let received = 0;
  for await (const chunk of request) {
    received += chunk.length;
    if (received > maxBytes) return { payloadTooLarge: true };
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return null; }
}
export function createStudioHttpServer(service = new StudioService(), imageBatchService = createImageBatchService(service)) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/api/health") return send(response, 200, service.health());
    if (request.method === "GET" && url.pathname === "/api/headless-image-spike") { const result = service.getHeadlessImageSpike(); return send(response, result.status, { generation: result.generation, capabilityToken: result.capabilityToken, remainingAttempts: result.remainingAttempts }); }
    if (request.method === "POST" && url.pathname === "/api/headless-image-spike") { const result = service.startHeadlessImageSpike(request.headers["x-studio-local-token"]); return send(response, result.status, result.ok ? { generation: result.generation, capabilityToken: result.capabilityToken, remainingAttempts: result.remainingAttempts } : { error: result.error, message: result.message, generation: result.generation, capabilityToken: result.capabilityToken, remainingAttempts: result.remainingAttempts }); }
    if (request.method === "POST" && url.pathname === "/api/projects") {
      const input = await readJson(request);
      if (input?.payloadTooLarge) return send(response, 413, { error: "Request body is too large." });
      if (input === null) return send(response, 400, { error: "Invalid JSON body." });
      const result = service.createProject(input);
      return send(response, result.status, result.ok ? { project: result.project } : { errors: result.errors });
    }
    if (request.method === "POST" && url.pathname === "/api/photorealistic-projects") {
      const input = await readJson(request, 9 * 1024 * 1024);
      if (input?.payloadTooLarge) return send(response, 413, { error: "2D source data must be 6 MB or smaller." });
      if (input === null) return send(response, 400, { error: "Invalid JSON body." });
      const result = service.createPhotorealisticProject(input);
      return send(response, result.status, result.ok ? { project: result.project } : { error: result.error, message: result.message, errors: result.errors, project: result.project });
    }
    if (request.method === "POST" && url.pathname === "/api/image-batches") {
      const input = await readJson(request, 9 * 1024 * 1024);
      if (input?.payloadTooLarge) return send(response, 413, { error: "batch_payload_too_large", message: "The image batch request is too large." });
      if (input === null) return send(response, 400, { error: "invalid_json", message: "Invalid JSON body." });
      const result = await imageBatchService.createBatch(input);
      return send(response, result.status, result.ok ? { batch: result.batch } : { error: result.error, message: result.message, errors: result.errors, batch: result.batch });
    }
    const batchSelection = url.pathname.match(/^\/api\/image-batches\/([a-z0-9-]+)\/selection$/i);
    if (batchSelection && request.method === "POST") {
      const input = await readJson(request);
      if (input === null) return send(response, 400, { error: "invalid_json", message: "Invalid JSON body." });
      const result = await imageBatchService.selectVariant(batchSelection[1], input.variantId);
      return send(response, result.status, result.ok ? { batch: result.batch } : { error: result.error, message: result.message });
    }
    const imageBatch = url.pathname.match(/^\/api\/image-batches\/([a-z0-9-]+)$/i);
    if (imageBatch && request.method === "GET") {
      const result = await imageBatchService.getBatch(imageBatch[1]);
      return send(response, result.status, result.ok ? { batch: result.batch } : { error: result.error, message: result.message });
    }
    const photoProject = url.pathname.match(/^\/api\/photorealistic-projects\/([a-z0-9-]+)$/i);
    if (photoProject && request.method === "GET") {
      const result = service.getPhotorealisticProject(photoProject[1]);
      return send(response, result.status, result.ok ? { project: result.project } : { error: result.error });
    }
    const project = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)$/i);
    if (project && request.method === "GET") { const result = service.getProject(project[1]); return send(response, result.status, result.ok ? { project: result.project } : { error: result.error }); }
    const approval = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/approve$/i);
    if (approval && request.method === "POST") { const result = service.approveStoryboard(approval[1]); return send(response, result.status, result.ok ? { project: result.project } : { error: result.error }); }
    return send(response, 404, { error: "Not found." });
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) { const port = Number(process.env.STUDIO_API_PORT ?? 4174); createStudioHttpServer().listen(port, "127.0.0.1", () => console.log(`Animation Real Studio local API on http://127.0.0.1:${port}`)); }
