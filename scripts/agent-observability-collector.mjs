import { appendEvent, eventStorePath, readEvents, stableId, tokensOf } from './lib/agent-observability.mjs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const file = eventStorePath(root);
const sourceIndex = process.argv.indexOf('--source');
const source = sourceIndex >= 0 ? process.argv[sourceIndex + 1] : 'codex-app-server';
const seen = new Set(readEvents(file).map((event) => event.id));
const statusFor = (method = '') => /failed|error|cancelled/i.test(method) ? 'failed' : /blocked/i.test(method) ? 'blocked' : /completed|finished|done/i.test(method) ? 'completed' : /queued|created/i.test(method) ? 'queued' : 'working';
function normalize(record) {
  const params = record.params ?? record.data ?? record;
  const method = record.method ?? params.type ?? 'raw.unknown';
  const item = params.item ?? params.turn ?? params;
  const runId = String(params.thread_id ?? params.threadId ?? params.run_id ?? params.runId ?? item.thread_id ?? item.threadId ?? 'external');
  const agentId = String(params.agent_id ?? params.agentId ?? item.agent_id ?? item.agentId ?? item.id ?? 'root');
  const lifecycle = /agent|task|turn|thread/i.test(method) ? 'agent.status' : 'tool.lifecycle';
  const fingerprint = JSON.stringify({ method, params });
  return { version: 1, id: String(params.event_id ?? params.eventId ?? item.id ?? stableId(source, fingerprint)), at: params.timestamp ?? params.at ?? new Date().toISOString(), source, type: lifecycle, runId, agentId, parentAgentId: params.parent_agent_id ?? params.parentAgentId ?? item.parent_agent_id, status: statusFor(method), label: params.label ?? item.title ?? method, tokens: tokensOf(params.usage ?? item.usage ?? params.tokens), metadata: { rpcMethod: method, itemType: item.type, traceId: params.trace_id ?? params.traceId, traceUrl: params.trace_url ?? params.traceUrl } };
}
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { buffer += chunk; let newline; while ((newline = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1); if (!line) continue; try { const event = normalize(JSON.parse(line)); if (!seen.has(event.id)) { appendEvent(file, event); seen.add(event.id); console.log(JSON.stringify({ accepted: event.id, type: event.type, runId: event.runId })); } } catch (error) { console.error(JSON.stringify({ rejected: line.slice(0, 200), error: error.message })); } } });
process.stdin.on('end', () => { if (buffer.trim()) process.emit('data', '\n'); });
