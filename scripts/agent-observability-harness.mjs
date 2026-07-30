import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { eventStorePath, readEvents, summarize } from './lib/agent-observability.mjs';
import { projectStatus } from './lib/dashboard-project-status.mjs';

const root = resolve(import.meta.dirname, '..');
const file = eventStorePath(root);
const dashboardDir = join(root, 'dashboard', 'agent-observability');
const ui = join(dashboardDir, 'safe-index.html');
const client = join(dashboardDir, 'dashboard-client.mjs');
const args = process.argv.slice(2);
const portAt = args.indexOf('--port');
const readyAt = args.indexOf('--ready-file');
const instanceAt = args.indexOf('--instance-id');
const port = portAt >= 0 ? Number(args[portAt + 1]) : Number(process.env.AGENT_OBSERVABILITY_PORT ?? 4318);
const readyFile = readyAt >= 0 ? args[readyAt + 1] : '';
const instanceId = instanceAt >= 0 ? args[instanceAt + 1] : '';
const samples = [{ version: 1, id: 'sample-plan', at: '2026-07-30T09:00:00.000Z', source: 'codex-app-server', type: 'agent.status', runId: 'sample-run', agentId: 'planner', status: 'completed', label: 'Plan approved', tokens: { input: 840, output: 310 } }, { version: 1, id: 'sample-build', at: '2026-07-30T09:01:00.000Z', source: 'codex-app-server', type: 'agent.status', runId: 'sample-run', agentId: 'builder', parentAgentId: 'planner', status: 'working', label: 'Implement collector', tokens: { input: 1220, output: 515 } }, { version: 1, id: 'sample-review', at: '2026-07-30T09:02:00.000Z', source: 'langgraph', type: 'agent.status', runId: 'sample-run', agentId: 'reviewer', parentAgentId: 'planner', status: 'queued', label: 'Independent review', tokens: { input: 0, output: 0 } }];

function ready(value) {
  if (!readyFile) return;
  mkdirSync(dirname(readyFile), { recursive: true });
  writeFileSync(readyFile, JSON.stringify(value));
}
function snapshot() { const events = readEvents(file); return { events, snapshot: summarize(events), dashboard: projectStatus() }; }
function sendJson(response, status, value) { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(value)); }
function asset(path) { return existsSync(path) ? readFileSync(path) : null; }

if (args.includes('--sample')) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${samples.map(JSON.stringify).join('\n')}\n`);
  console.log(`Sample events written: ${file}`);
  if (!args.includes('--serve')) process.exit(0);
}
if (args.includes('--check')) { console.log(JSON.stringify(snapshot().snapshot, null, 2)); process.exit(0); }

const clients = new Set();
let lastVersion = '';
function publish() {
  try {
    const data = JSON.stringify(snapshot());
    if (data === lastVersion) return;
    lastVersion = data;
    for (const response of clients) response.write(`event: snapshot\ndata: ${data}\n\n`);
  } catch (error) { console.error(error.message); }
}
setInterval(publish, 500).unref();

const server = createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === '/api/health') return sendJson(response, 200, { ok: true, instanceId });
  if (pathname === '/api/events') {
    try { return sendJson(response, 200, snapshot()); } catch (error) { return sendJson(response, 422, { error: error.message }); }
  }
  if (pathname === '/api/stream') {
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    clients.add(response); response.write(`event: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`);
    request.on('close', () => clients.delete(response));
    return;
  }
  if (pathname === '/' || pathname === '/index.html') {
    const html = asset(ui); response.writeHead(html ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' }); return response.end(html ?? 'Dashboard UI missing');
  }
  if (pathname === '/dashboard-client.mjs') {
    const module = asset(client); response.writeHead(module ? 200 : 404, { 'content-type': 'text/javascript; charset=utf-8' }); return response.end(module ?? 'Dashboard client missing');
  }
  response.writeHead(404).end('Not found');
});
server.once('error', (error) => { ready({ ok: false, error: error.message }); console.error(`Agent observability dashboard failed: ${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => { ready({ ok: true, port, instanceId }); console.log(`Agent observability dashboard: http://127.0.0.1:${port}`); });
