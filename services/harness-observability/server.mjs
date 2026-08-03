import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { eventStorePath, readEvents, stages, summarize } from '../../packages/harness-observability-contract/index.mjs';
import { allRuns, assertRunId, normalizeClaim } from '../../tools/harness-pipeline/run-store.mjs';
import { discoverWorkspaces } from '../../packages/harness-observability-contract/workspace-discovery.mjs';

const root = resolve(import.meta.dirname, '../..');
function dashboardUi(base) { return join(base, 'apps', 'harness-dashboard'); }
const sources = ['docs/development/active-workspace-baseline.md'];
const legacyAliases = new Set(['/legacy/root-dashboard', '/legacy/2d-fps-dashboard']);
function sourceState(base) { return sources.map((path) => { const file = join(base, path); return { path, exists: existsSync(file), modifiedAt: existsSync(file) ? statSync(file).mtime.toISOString() : null }; }); }
function publicVerification(item) {
  if (!['harness-tests', 'harness-audit'].includes(item.command) || !Number.isInteger(item.exitCode) || item.exitCode < 0 || !Number.isFinite(item.durationMs) || item.durationMs < 0) throw new Error('Invalid stored verification');
  return { command: item.command, exitCode: item.exitCode, durationMs: item.durationMs, recordedAt: Number.isNaN(Date.parse(item.recordedAt ?? '')) ? null : item.recordedAt };
}
function publicRun(run) {
  assertRunId(run.id);
  if (!stages.includes(run.stage)) throw new Error('Invalid stored run stage');
  const claims = (run.claims ?? []).map(normalizeClaim);
  const verifications = (run.verifications ?? []).map(publicVerification);
  const updatedAt = Number.isNaN(Date.parse(run.updatedAt ?? '')) ? null : run.updatedAt;
  const git = /^[a-f0-9]{7,64}$/.test(run.git?.head ?? '') ? { head: run.git.head, dirty: Boolean(run.git.dirty) } : null;
  return { id: run.id, stage: run.stage, updatedAt, worktree: run.worktree ? `.worktrees/harness-runs/${run.id}` : null, branch: run.branch ? `harness/${run.id}` : null, claims, verifications, git };
}
export function snapshot(base = root) { const file = eventStorePath(base); const events = readEvents(file); return { generatedAt: new Date().toISOString(), observability: summarize(events), runs: allRuns(base).map(publicRun), projects: discoverWorkspaces(base), sources: sourceState(base) }; }
function asset(file, contentType) { return { contentType, body: existsSync(file) ? readFileSync(file) : null }; }
export function createHarnessServer(base = root) {
  const ui = dashboardUi(base);
  const clients = new Set(); let fingerprint = '';
  const publish = () => { const data = JSON.stringify(snapshot(base)); if (data === fingerprint) return; fingerprint = data; for (const response of clients) response.write(`event: snapshot\ndata: ${data}\n\n`); };
  const timer = setInterval(publish, 500); timer.unref();
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    if (legacyAliases.has(pathname)) { response.writeHead(302, { location: '/', 'cache-control': 'no-store' }); return response.end(); }
    if (pathname === '/api/health') { response.writeHead(200, { 'content-type': 'application/json' }); return response.end(JSON.stringify({ ok: true, listener: '127.0.0.1' })); }
    if (pathname === '/api/snapshot') { response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return response.end(JSON.stringify(snapshot(base))); }
    if (pathname === '/api/stream') { response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); clients.add(response); response.write(`event: snapshot\ndata: ${JSON.stringify(snapshot(base))}\n\n`); request.on('close', () => clients.delete(response)); return; }
    const selected = pathname === '/dashboard-client.mjs' ? asset(join(ui, 'dashboard-client.mjs'), 'text/javascript; charset=utf-8') : asset(join(ui, 'index.html'), 'text/html; charset=utf-8');
    response.writeHead(selected.body ? 200 : 404, { 'content-type': selected.contentType }); response.end(selected.body ?? 'Dashboard asset missing');
  });
  server.on('close', () => clearInterval(timer)); return server;
}
if (process.argv[1]?.endsWith('server.mjs')) { const port = Number(process.env.HARNESS_DASHBOARD_PORT ?? 4318); createHarnessServer().listen(port, '127.0.0.1', () => console.log(`Harness dashboard: http://127.0.0.1:${port}`)); }
