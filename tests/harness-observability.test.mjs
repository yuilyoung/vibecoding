import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { appendEvent, eventStorePath, lifecycleEvent, readEvents, validateEvent } from '../packages/harness-observability-contract/index.mjs';
import { allRuns, assertChangesWithinClaims, assertClaimsAvailable, assertCleanIntake, assertVerificationFresh, assertVerificationStage, createDesign, createRunWorktree, loadRun, normalizeClaim, transition, verifyRun } from '../tools/harness-pipeline/run-store.mjs';
import { createHarnessServer } from '../services/harness-observability/server.mjs';
import { assertClaimPolicy } from '../tools/harness-pipeline/run-store.mjs';
import { snapshot } from '../services/harness-observability/server.mjs';

function fixture(projects = []) {
  const root = mkdtempSync(join(tmpdir(), 'harness-observability-'));
  for (const project of projects) {
    const name = typeof project === 'string' ? project : project.name;
    const projectRoot = join(root, 'work', name);
    mkdirSync(projectRoot, { recursive: true }); writeFileSync(join(projectRoot, 'package.json'), '{"private":true}');
    if (project.statusArtifact) {
      mkdirSync(join(projectRoot, 'docs', 'reports'), { recursive: true });
      writeFileSync(join(projectRoot, 'docs', 'reports', 'project-status.md'), 'reported');
    }
  }
  execFileSync('git', ['init'], { cwd: root }); execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root }); execFileSync('git', ['config', 'user.name', 'Harness Test'], { cwd: root });
  writeFileSync(join(root, 'README.md'), 'fixture\n'); execFileSync('git', ['add', '.'], { cwd: root }); execFileSync('git', ['commit', '-m', 'fixture'], { cwd: root });
  process.env.HARNESS_OBSERVABILITY_STATE_DIR = join(root, '.state', 'runs'); return root;
}

test('event contract rejects prompt and raw output fields', () => {
  const event = { version: 1, id: 'event-1', at: '2026-08-03T00:00:00.000Z', runId: 'run-one', type: 'run.designed', stage: 'designed', claims: ['apps/harness-dashboard'] };
  assert.deepEqual(validateEvent(event), event);
  assert.throws(() => validateEvent({ ...event, prompt: 'secret prompt' }), /Unsupported event field/);
  assert.throws(() => validateEvent({ ...event, evidence: [{ stdout: 'secret output' }] }), /Unsupported evidence reference/);
  assert.throws(() => validateEvent({ ...event, evidence: ['free-form evidence'] }), /Unsupported evidence reference/);
  assert.throws(() => validateEvent({ ...event, sources: ['notes/secret.md'] }), /Unsupported source reference/);
  assert.throws(() => validateEvent({ ...event, command: 'arbitrary-command' }), /Unsupported verification command/);
  assert.throws(() => validateEvent({ ...event, worktree: 'C:\\private\\run-one' }), /Invalid public worktree reference/);
  assert.throws(() => validateEvent({ ...event, branch: 'private/run-one' }), /Invalid public branch reference/);
});
test('legacy dashboards are UTF-8 compatibility pages for the canonical harness', () => {
  const pages = ['dashboard/index.html', 'work/2D-FPS-game/dashboard/index.html'];
  for (const path of pages) {
    const page = readFileSync(join(process.cwd(), path), 'utf8');
    assert.match(page, /charset="utf-8"/i); assert.match(page, /http:\/\/127\.0\.0\.1:4318\//);
    assert.match(page, /npm run harness:dashboard/);
    assert.doesNotMatch(page, /tailwindcss|fonts\.googleapis|Unity|Phase|project-status\.html/i);
  }
});

test('Claude workflows do not recreate static status interfaces', () => {
  const files = ['.claude/agents/pm.md', '.claude/rules/01-orchestrator.md', '.claude/rules/04-workflow.md', '.claude/hooks/post-edit-log.mjs', '.claude/settings.json'];
  for (const path of files) {
    const file = readFileSync(join(process.cwd(), path), 'utf8');
    assert.doesNotMatch(file, /dashboard\/index\.html|reports\/project-status(?:\\+)?\.html/);
  }
});


test('design claims reject collisions while disjoint runs stay active', () => {
  const root = fixture();
  assert.equal(normalizeClaim('Apps\\Harness-Dashboard//'), 'apps/harness-dashboard');
  assert.throws(() => normalizeClaim('apps/./harness-dashboard'), /Invalid path claim/);
  createDesign(root, { id: 'dashboard-run', title: 'Dashboard', claims: ['Apps\\Harness-Dashboard//'] });
  assert.throws(() => createDesign(root, { id: 'dashboard-child', title: 'Overlap', claims: ['apps/harness-dashboard/client'] }), /overlaps active run/);
  const independent = createDesign(root, { id: 'memory-registry', title: 'Registry', claims: ['experiments/memory-pocs'] });
  assert.equal(independent.stage, 'designed'); assert.equal(allRuns(root).length, 2);
});

test('work-wide discovery shows projects without runs and admits only discovered work claims', () => {
  const root = fixture([{ name: 'alpha-app', statusArtifact: true }, { name: 'beta-tool' }]);
  writeFileSync(join(root, 'work', 'beta-tool', 'package.json'), '{"private":false}');
  const data = snapshot(root);
  assert.deepEqual(data.projects.map((project) => project.id), ['work/alpha-app', 'work/beta-tool']);
  assert.equal(data.runs.length, 0);
  const alpha = data.projects[0]; const beta = data.projects[1];
  assert.equal(alpha.manifest, 'work/alpha-app/package.json'); assert.equal(alpha.statusArtifacts[0].available, true);
  assert.equal(alpha.git.dirty, false); assert.equal(beta.git.dirty, true); assert.ok(alpha.git.latestCommitAt);
  const projectRun = createDesign(root, { id: 'project-run', title: 'Project', claims: ['work/alpha-app/src'] });
  rmSync(join(root, 'work', 'beta-tool'), { recursive: true, force: true });
  assert.deepEqual(snapshot(root).projects.map((project) => project.id), ['work/alpha-app']);
  assert.equal(projectRun.stage, 'designed');
  assert.throws(() => createDesign(root, { id: 'missing-run', title: 'Missing', claims: ['work/missing-project/src'] }), /outside harness or discovered work scope/);
  assert.throws(() => assertClaimPolicy(root, ['private/data']), /outside harness or discovered work scope/);
});

test('two disjoint designs create independent Git worktrees and a dirty intake is rejected', () => {
  const root = fixture();
  const first = createRunWorktree(root, createDesign(root, { id: 'run-one', title: 'One', claims: ['apps/one'] }));
  const second = createRunWorktree(root, createDesign(root, { id: 'run-two', title: 'Two', claims: ['apps/two'] }));
  assert.notEqual(first.worktree, second.worktree); assert.equal(loadRun(root, 'run-one').stage, 'worktree-ready');
  writeFileSync(join(root, 'DIRTY.txt'), 'not committed'); assert.throws(() => assertCleanIntake(root), /Dirty intake worktree/);
});

test('completion gates reject out-of-claim and post-verification changes', () => {
  const root = fixture(); let run = createRunWorktree(root, createDesign(root, { id: 'gated-run', title: 'Gated', claims: ['apps/owned'] }));
  run = transition(root, run, 'developing');
  mkdirSync(join(run.worktree, 'apps', 'owned'), { recursive: true });
  writeFileSync(join(run.worktree, 'apps', 'owned', 'allowed.txt'), 'owned');
  run = verifyRun(root, run, { command: 'harness-tests', exitCode: 0, durationMs: 1, evidence: ['harness-tests: local deterministic command'] });
  run = verifyRun(root, run, { command: 'harness-audit', exitCode: 0, durationMs: 1, evidence: ['harness-audit: local deterministic command'] });
  assert.doesNotThrow(() => assertChangesWithinClaims(run));
  assert.doesNotThrow(() => assertVerificationFresh(run));
  writeFileSync(join(run.worktree, 'apps', 'owned', 'allowed.txt'), 'owned-reverified');
  run = verifyRun(root, run, { command: 'harness-tests', exitCode: 0, durationMs: 1, evidence: ['harness-tests: local deterministic command'] });
  run = verifyRun(root, run, { command: 'harness-audit', exitCode: 0, durationMs: 1, evidence: ['harness-audit: local deterministic command'] });
  assert.doesNotThrow(() => assertVerificationFresh(run));
  writeFileSync(join(run.worktree, 'OUTSIDE.md'), 'outside');
  assert.throws(() => assertChangesWithinClaims(run), /outside its claims/);
  assert.throws(() => assertVerificationStage({ stage: 'designed' }), /Verification requires development/);
});

test('loopback service returns sanitized snapshot and publishes SSE', async () => {
  const root = fixture(); const run = createDesign(root, { id: 'stream-run', title: 'Stream', claims: ['apps/stream'] });
  appendEvent(eventStorePath(root), lifecycleEvent(run, 'run.designed', { sources: ['tests/harness-observability.test.mjs'] }));
  const server = createHarnessServer(root);
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port, address } = server.address(); assert.equal(address, '127.0.0.1');
    for (const alias of ['/legacy/root-dashboard', '/legacy/2d-fps-dashboard']) {
      const legacy = await fetch(`http://127.0.0.1:${port}${alias}`, { redirect: 'manual' });
      assert.equal(legacy.status, 302); assert.equal(legacy.headers.get('location'), '/');
    }
    const response = await fetch(`http://127.0.0.1:${port}/api/snapshot`); const snapshot = await response.json(); assert.equal(snapshot.observability.eventCount, 1);
    assert.equal(snapshot.runs[0].title, undefined); assert.equal(snapshot.sources[0].exists, false);
    assert.equal(snapshot.observability.runs[0].sources, undefined); assert.equal(snapshot.observability.runs[0].worktree, undefined);
    const stream = await fetch(`http://127.0.0.1:${port}/api/stream`); const reader = stream.body.getReader(); const chunk = await reader.read(); assert.match(new TextDecoder().decode(chunk.value), /event: snapshot/); await reader.cancel();
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
});