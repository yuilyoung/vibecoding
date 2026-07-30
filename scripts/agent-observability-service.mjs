import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'); const stateDir = join(root, '.local', 'agent-observability'); const stateFile = join(stateDir, 'server.json'); const port = Number(process.env.AGENT_OBSERVABILITY_PORT ?? 4318); const command = process.argv[2] ?? 'start';
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
function state() { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return null; } }
function print(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }
if (command === 'status') { const current = state(); print({ running: Boolean(current && alive(current.pid)), ...current }); process.exit(0); }
if (command === 'stop') { const current = state(); if (current && alive(current.pid)) process.kill(current.pid); if (existsSync(stateFile)) rmSync(stateFile); print({ stopped: true }); process.exit(0); }
mkdirSync(stateDir, { recursive: true }); const current = state(); if (current && alive(current.pid)) { print({ started: false, reason: 'already-running', ...current }); process.exit(0); } if (existsSync(stateFile)) rmSync(stateFile);
const child = spawn(process.execPath, ['scripts/agent-observability-harness.mjs', '--port', String(port)], { cwd: root, detached: true, stdio: 'ignore', windowsHide: true }); child.unref(); const next = { pid: child.pid, port, startedAt: new Date().toISOString(), url: `http://127.0.0.1:${port}` }; writeFileSync(stateFile, JSON.stringify(next, null, 2)); print({ started: true, ...next });
