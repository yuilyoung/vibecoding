import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { appendEvent, readEvents, stableId, summarize, tokensOf, validate } from '../scripts/lib/agent-observability.mjs';

test('normalizes supported token payload shapes', () => {
  assert.deepEqual(tokensOf({ input_tokens: 12, output_tokens: 8 }), { input: 12, output: 8 });
  assert.deepEqual(tokensOf({ tokens: { prompt_tokens: 3, completion_tokens: 5 } }), { input: 3, output: 5 });
});

test('summarizes the latest agent state and accumulated token matrix', () => {
  const events = [
    { version: 1, id: 'plan', at: '2026-07-30T00:00:00Z', source: 'codex', type: 'agent.status', runId: 'run-1', agentId: 'planner', status: 'completed', tokens: { input: 10, output: 4 } },
    { version: 1, id: 'build', at: '2026-07-30T00:01:00Z', source: 'codex', type: 'agent.status', runId: 'run-1', agentId: 'planner', status: 'working', tokens: { input: 7, output: 9 } }
  ];

  const snapshot = summarize(events);
  assert.equal(snapshot.eventCount, 2);
  assert.equal(snapshot.agents[0].status, 'working');
  assert.deepEqual(snapshot.matrix, [{ runId: 'run-1', agentId: 'planner', input: 17, output: 13, total: 30 }]);
  assert.deepEqual(snapshot.tokens, { input: 17, output: 13, total: 30 });
});

test('persists valid JSONL events and rejects malformed agent status events', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'agent-observability-')), 'events.jsonl');
  const event = { version: 1, id: stableId('event', 'one'), at: '2026-07-30T00:00:00Z', source: 'test', type: 'agent.status', runId: 'run-1', agentId: 'worker', status: 'queued' };

  appendEvent(file, event);
  assert.deepEqual(readEvents(file), [event]);
  assert.match(readFileSync(file, 'utf8'), /"agentId":"worker"/);
  assert.throws(() => validate({ ...event, id: 'invalid', status: 'unknown' }), /valid status/);
});
