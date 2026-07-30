import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const stateDir = process.env.AGENT_OBSERVABILITY_STATE_DIR ?? join(root, '.local', 'agent-observability');
const stateFile = join(stateDir, 'server.json');
const port = Number(process.env.AGENT_OBSERVABILITY_PORT ?? 4318);
const command = process.argv[2] ?? 'start';
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
function state() { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return null; } }
function removeState() { if (existsSync(stateFile)) rmSync(stateFile); }
function print(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }
function pause(ms) { return new Promise((done) => setTimeout(done, ms)); }

async function healthy(current) {
  if (!current || !alive(current.pid)) return false;
  try {
    const response = await fetch(`http://127.0.0.1:${current.port}/api/health`, { signal: AbortSignal.timeout(750) });
    const payload = await response.json();
    return response.ok && payload.ok === true && payload.instanceId === current.instanceId;
  } catch {
    return false;
  }
}

async function waitForReady(file, child) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const value = JSON.parse(readFileSync(file, 'utf8'));
      if (value.ok === true || value.ok === false) return value;
    } catch {
      // The child has not written its readiness result yet.
    }
    if (child.exitCode !== null) return { ok: false, error: 'dashboard process exited before readiness' };
    await pause(50);
  }
  return { ok: false, error: 'dashboard readiness timed out' };
}

async function start() {
  mkdirSync(stateDir, { recursive: true });
  const existing = state();
  if (await healthy(existing)) {
    print({ started: false, reason: 'already-running', ...existing });
    return;
  }
  removeState();
  const instanceId = randomUUID();
  const readyFile = join(stateDir, `ready-${instanceId}.json`);
  const child = spawn(process.execPath, ['scripts/agent-observability-harness.mjs', '--port', String(port), '--ready-file', readyFile, '--instance-id', instanceId], { cwd: root, detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  const ready = await waitForReady(readyFile, child);
  if (existsSync(readyFile)) rmSync(readyFile);
  if (!ready.ok) {
    try { child.kill(); } catch { /* It may have exited after reporting a bind failure. */ }
    print({ started: false, error: ready.error });
    process.exitCode = 1;
    return;
  }
  const next = { pid: child.pid, port, instanceId, startedAt: new Date().toISOString(), url: `http://127.0.0.1:${port}` };
  writeFileSync(stateFile, JSON.stringify(next, null, 2));
  print({ started: true, ...next });
}

async function main() {
  const current = state();
  if (command === 'status') {
    const running = await healthy(current);
    if (!running) removeState();
    print({ ...current, running });
    return;
  }
  if (command === 'stop') {
    const running = await healthy(current);
    if (running) process.kill(current.pid);
    removeState();
    print({ stopped: true, running });
    return;
  }
  if (command === 'start') return start();
  print({ started: false, error: `unknown command: ${command}` });
  process.exitCode = 1;
}

await main();
