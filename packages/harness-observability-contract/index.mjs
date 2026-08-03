import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const eventVersion = 1;
export const stages = ['designed', 'worktree-ready', 'developing', 'verifying', 'completed', 'failed'];
const sensitive = new Set(['prompt', 'prompts', 'arguments', 'environment', 'env', 'secret', 'secrets', 'credentials', 'apikey', 'apikeys', 'authorization', 'stdout', 'stderr', 'output']);
const allowed = new Set(['version', 'id', 'at', 'runId', 'type', 'stage', 'worktree', 'branch', 'claims', 'command', 'exitCode', 'durationMs', 'git', 'evidence', 'sources']);

const commands = new Set(['harness-tests', 'harness-audit']);
const eventTypes = new Set(['run.designed', 'run.worktree-ready', 'run.developing', 'run.verified', 'run.completed']);
const safeClaim = /^[a-z0-9][a-z0-9._/-]{0,159}$/;
const safeSource = /^(?:apps|codex|docs|experiments|packages|services|tests|tools|work)\/[a-z0-9._/-]{1,180}$/;

export function stableId(prefix, value) { let hash = 2166136261; for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return `${prefix}-${(hash >>> 0).toString(16)}`; }
export function assertSanitized(value, path = '') {
  if (Array.isArray(value)) return value.forEach((item, index) => assertSanitized(item, `${path}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (sensitive.has(key.toLowerCase().replace(/[^a-z]/g, ''))) throw new Error(`Sensitive field is forbidden: ${path ? `${path}.` : ''}${key}`);
    assertSanitized(nested, path ? `${path}.${key}` : key);
  }
}
function assertReferences(value, label, pattern) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !pattern.test(item))) throw new Error(`Unsupported ${label} reference`);
}
function assertEventShape(event) {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(event.runId)) throw new Error('Invalid run ID');
  if (!/^event-[a-f0-9]+$/.test(event.id)) throw new Error('Invalid event ID');
  if (!eventTypes.has(event.type)) throw new Error(`Unsupported event type: ${event.type}`);
  if (Number.isNaN(Date.parse(event.at))) throw new Error('Invalid event timestamp');
  assertReferences(event.claims, 'claim', safeClaim);
  if (event.worktree !== undefined && event.worktree !== null && event.worktree !== `.worktrees/harness-runs/${event.runId}`) throw new Error('Invalid public worktree reference');
  if (event.branch !== undefined && event.branch !== null && event.branch !== `harness/${event.runId}`) throw new Error('Invalid public branch reference');
  if (event.command !== undefined && !commands.has(event.command)) throw new Error(`Unsupported verification command: ${event.command}`);
  if (event.evidence !== undefined) assertReferences(event.evidence, 'evidence', /^harness-(?:tests|audit): local deterministic command$/);
  if (event.sources !== undefined) assertReferences(event.sources, 'source', safeSource);
  if (event.exitCode !== undefined && (!Number.isInteger(event.exitCode) || event.exitCode < 0)) throw new Error('Invalid exit code');
  if (event.durationMs !== undefined && (!Number.isFinite(event.durationMs) || event.durationMs < 0)) throw new Error('Invalid duration');
  if (event.git !== undefined && (!event.git || typeof event.git !== 'object' || !/^[a-f0-9]{7,64}$/.test(event.git.head ?? '') || typeof event.git.dirty !== 'boolean')) throw new Error('Invalid git summary');
}

export function validateEvent(event) {
  if (!event || typeof event !== 'object') throw new Error('Event must be an object');
  for (const key of Object.keys(event)) if (!allowed.has(key)) throw new Error(`Unsupported event field: ${key}`);
  if (event.version !== eventVersion) throw new Error('Unsupported event version');
  for (const key of ['id', 'at', 'runId', 'type', 'stage']) if (!event[key]) throw new Error(`Event missing ${key}`);
  if (!stages.includes(event.stage)) throw new Error(`Unsupported stage: ${event.stage}`);
  assertEventShape(event);
  assertSanitized(event); return event;
}
export function eventStorePath(root) { return `${root}/.local/harness-observability/events.jsonl`; }
export function appendEvent(file, event) { validateEvent(event); mkdirSync(dirname(file), { recursive: true }); appendFileSync(file, `${JSON.stringify(event)}\n`, 'utf8'); }
export function readEvents(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => { try { return validateEvent(JSON.parse(line)); } catch (error) { throw new Error(`Invalid event line ${index + 1}: ${error.message}`); } });
}
function publicEvent(event) { return { id: event.id, at: event.at, runId: event.runId, type: event.type, stage: event.stage, claims: event.claims, command: event.command, exitCode: event.exitCode, durationMs: event.durationMs, git: event.git }; }
export function summarize(events) { const latest = new Map(); for (const event of events) latest.set(event.runId, event); return { eventCount: events.length, runs: [...latest.values()].map(publicEvent).sort((a, b) => b.at.localeCompare(a.at)), updatedAt: events.at(-1)?.at ?? null }; }
export function lifecycleEvent(run, type, extra = {}) {
  return validateEvent({ version: eventVersion, id: stableId('event', `${run.id}:${type}:${run.updatedAt}:${JSON.stringify(extra)}`), at: new Date().toISOString(), runId: run.id, type, stage: run.stage, worktree: run.worktree ? `.worktrees/harness-runs/${run.id}` : null, branch: run.branch ? `harness/${run.id}` : null, claims: run.claims, git: run.git, ...extra });
}
