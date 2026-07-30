import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const dataDir = join(root, '.local', 'agent-observability');
const eventFile = join(dataDir, 'events.jsonl');
const uiDir = join(root, 'dashboard', 'agent-observability');
const sampleEvents = [
  { version: 1, id: 'evt-plan', at: '2026-07-30T09:00:00.000Z', source: 'codex-app-server', type: 'agent.status', runId: 'run-sample', agentId: 'planner', status: 'completed', label: 'Plan approved', tokens: { input: 840, output: 310 } },
  { version: 1, id: 'evt-build', at: '2026-07-30T09:01:00.000Z', source: 'codex-app-server', type: 'agent.status', runId: 'run-sample', agentId: 'builder', parentAgentId: 'planner', status: 'working', label: 'Implement dashboard harness', tokens: { input: 1220, output: 515 } },
  { version: 1, id: 'evt-review', at: '2026-07-30T09:02:00.000Z', source: 'manual', type: 'agent.status', runId: 'run-sample', agentId: 'reviewer', parentAgentId: 'planner', status: 'queued', label: 'Independent review', tokens: { input: 0, output: 0 } }
];
function readEvents() { if (!existsSync(eventFile)) return []; return readFileSync(eventFile, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => { try { return JSON.parse(line); } catch { throw new Error(`Invalid JSONL event at line ${index + 1}`); } }); }
function validate(event) { const required = ['version', 'id', 'at', 'source', 'type', 'runId']; const missing = required.filter((key) => event[key] === undefined); if (missing.length) throw new Error(`Event ${event.id ?? '<unknown>'} missing: ${missing.join(', ')}`); if (event.type === 'agent.status' && (!event.agentId || !event.status)) throw new Error(`agent.status event ${event.id} requires agentId and status`); }
function summarize(events) { const agents = new Map(); let input = 0; let output = 0; for (const event of events) { validate(event); input += event.tokens?.input ?? 0; output += event.tokens?.output ?? 0; if (event.agentId) agents.set(event.agentId, event); } return { eventCount: events.length, agents: [...agents.values()], tokens: { input, output, total: input + output } }; }
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log('Usage: npm run agent-observability -- [--sample] [--check] [--port 4318]'); process.exit(0); }
mkdirSync(dataDir, { recursive: true });
if (args.includes('--sample')) { writeFileSync(eventFile, `${sampleEvents.map(JSON.stringify).join('\n')}\n`, 'utf8'); if (!args.includes('--serve')) { console.log(`Sample events written: ${eventFile}`); process.exit(0); } }
const snapshot = summarize(readEvents());
if (args.includes('--check')) { console.log(JSON.stringify(snapshot, null, 2)); process.exit(0); }
const portIndex = args.indexOf('--port'); const listenPort = portIndex >= 0 ? Number(args[portIndex + 1]) : 4318;
const server = createServer((request, response) => { const pathname = new URL(request.url, `http://${request.headers.host}`).pathname; if (pathname === '/api/events') { try { const events = readEvents(); response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify({ events, snapshot: summarize(events) })); } catch (error) { response.writeHead(422, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error.message })); } return; } if (pathname === '/' || pathname === '/index.html') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(readFileSync(join(uiDir, 'index.html'))); return; } response.writeHead(404).end('Not found'); });
server.listen(listenPort, '127.0.0.1', () => console.log(`Agent observability dashboard: http://127.0.0.1:${listenPort}`));
