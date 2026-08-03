import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { appendEvent, eventStorePath, lifecycleEvent } from '../../packages/harness-observability-contract/index.mjs';
import { allRuns, assertChangesWithinClaims, assertVerificationFresh, assertVerificationStage, createDesign, createRunWorktree, loadRun, transition, verifyRun } from './run-store.mjs';

const root = resolve(import.meta.dirname, '../..');
const [command = 'status', ...tokens] = process.argv.slice(2);
function values(name) { const found = []; for (let index = 0; index < tokens.length; index += 1) if (tokens[index] === `--${name}`) found.push(tokens[index + 1]); return found.filter(Boolean); }
function value(name) { return values(name)[0] ?? ''; }
function emit(run, type, extra) { appendEvent(eventStorePath(root), lifecycleEvent(run, type, extra)); }
function print(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }
function fail(error) { print({ ok: false, error: error.message }); process.exitCode = 1; }
function runCheck(run, check) {
  const commands = { 'harness-tests': ['npm', ['run', 'harness:test']], 'harness-audit': ['node', ['plugins/hermes-ssot/scripts/harness-audit.mjs']] };
  if (!commands[check]) throw new Error(`Unsupported verification check: ${check}`);
  const [program, args] = commands[check]; const start = Date.now(); let exitCode = 0;
  try { execFileSync(program, args, { cwd: run.worktree, stdio: 'ignore', windowsHide: true }); } catch (error) { exitCode = Number(error.status ?? 1); }
  return { command: check, exitCode, durationMs: Date.now() - start, evidence: [`${check}: local deterministic command`] };
}
try {
  if (command === 'status') print({ ok: true, runs: allRuns(root) });
  else if (command === 'design') { const run = createDesign(root, { id: value('run'), title: value('title'), claims: values('claim') }); emit(run, 'run.designed'); print({ ok: true, run }); }
  else if (command === 'worktree') { const run = createRunWorktree(root, loadRun(root, value('run')), value('intake')); emit(run, 'run.worktree-ready'); print({ ok: true, run }); }
  else if (command === 'develop') { const run = transition(root, loadRun(root, value('run')), 'developing'); emit(run, 'run.developing'); print({ ok: true, run }); }
  else if (command === 'verify') { const candidate = loadRun(root, value('run')); assertVerificationStage(candidate); const result = runCheck(candidate, value('check')); const run = verifyRun(root, candidate, result); emit(run, 'run.verified', result); print({ ok: result.exitCode === 0, run, result }); if (result.exitCode) process.exitCode = result.exitCode; }
  else if (command === 'complete') { let run = loadRun(root, value('run')); if (run.stage !== 'verifying') throw new Error('Completion requires successful verification evidence'); assertChangesWithinClaims(run); assertVerificationFresh(run); run = transition(root, run, 'completed'); emit(run, 'run.completed'); print({ ok: true, run }); }
  else throw new Error(`Unknown command: ${command}`);
} catch (error) { fail(error); }
