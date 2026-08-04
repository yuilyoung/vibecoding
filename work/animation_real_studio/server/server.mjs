import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { StudioService } from "./studio-service.mjs";

const send = (response, status, body) => { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); response.end(JSON.stringify(body)); };
async function readJson(request) { const chunks = []; for await (const chunk of request) chunks.push(chunk); if (!chunks.length) return {}; try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; } }
export function createStudioHttpServer(service = new StudioService()) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/api/health") return send(response, 200, service.health());
    if (request.method === "GET" && url.pathname === "/api/headless-image-spike") { const result = service.getHeadlessImageSpike(); return send(response, result.status, { generation: result.generation, capabilityToken: result.capabilityToken, remainingAttempts: result.remainingAttempts }); }
    if (request.method === "POST" && url.pathname === "/api/headless-image-spike") { const result = service.startHeadlessImageSpike(request.headers["x-studio-local-token"]); return send(response, result.status, result.ok ? { generation: result.generation, capabilityToken: result.capabilityToken, remainingAttempts: result.remainingAttempts } : { error: result.error, message: result.message, generation: result.generation, capabilityToken: result.capabilityToken, remainingAttempts: result.remainingAttempts }); }
    if (request.method === "POST" && url.pathname === "/api/projects") { const input = await readJson(request); if (input === null) return send(response, 400, { error: "Invalid JSON body." }); const result = service.createProject(input); return send(response, result.status, result.ok ? { project: result.project } : { errors: result.errors }); }
    const project = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)$/i);
    if (project && request.method === "GET") { const result = service.getProject(project[1]); return send(response, result.status, result.ok ? { project: result.project } : { error: result.error }); }
    const approval = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/approve$/i);
    if (approval && request.method === "POST") { const result = service.approveStoryboard(approval[1]); return send(response, result.status, result.ok ? { project: result.project } : { error: result.error }); }
    return send(response, 404, { error: "Not found." });
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) { const port = Number(process.env.STUDIO_API_PORT ?? 4174); createStudioHttpServer().listen(port, "127.0.0.1", () => console.log(`Animation Real Studio local API on http://127.0.0.1:${port}`)); }