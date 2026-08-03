import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { stableId, stages } from '../../packages/harness-observability-contract/index.mjs';
import { isDiscoverableWorkspaceClaim } from '../../packages/harness-observability-contract/workspace-discovery.mjs';

const active = new Set(['designed', 'worktree-ready', 'developing', 'verifying']);
const harnessRoots = ['apps', 'services', 'packages', 'tools', 'experiments', 'docs', 'codex', '.github'];
export const requiredChecks = ['harness-tests', 'harness-audit'];
export function storeRoot(root) { return process.env.HARNESS_OBSERVABILITY_STATE_DIR ?? join(root, '.local', 'harness-observability', 'runs'); }
export function assertRunId(id) { if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(id ?? '')) throw new Error('Run ID must be 2-63 lowercase letters, digits, or hyphens'); return id; }
export function runFile(root, id) { return join(storeRoot(root), assertRunId(id), 'run.json'); }
export function normalizeClaim(value) {
  const raw = String(value ?? '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '');
  if (!raw || raw.startsWith('/') || raw.split('/').some((part) => part === '.' || part === '..')) throw new Error(`Invalid path claim: ${value}`);
  const claim = raw.toLowerCase();
  if (!/^[a-z0-9][a-z0-9._/-]{0,159}$/.test(claim)) throw new Error(`Invalid path claim: ${value}`);
  return claim;
}
export function claimsOverlap(a, b) { return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`); }
export function loadRun(root, id) { const file = runFile(root, id); if (!existsSync(file)) throw new Error(`Run not found: ${id}`); return JSON.parse(readFileSync(file, 'utf8')); }
export function saveRun(root, run) { run.updatedAt = new Date().toISOString(); const file = runFile(root, run.id); mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, JSON.stringify(run, null, 2)); return run; }
export function allRuns(root) { const dir = storeRoot(root); if (!existsSync(dir)) return []; return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).flatMap((entry) => { try { return [loadRun(root, entry.name)]; } catch { return []; } }); }
export function assertClaimsAvailable(root, id, claims) { for (const run of allRuns(root)) if (run.id !== id && active.has(run.stage)) for (const claim of claims.map(normalizeClaim)) for (const occupied of run.claims ?? []) if (claimsOverlap(claim, normalizeClaim(occupied))) throw new Error(`Path claim overlaps active run ${run.id}: ${claim} <> ${occupied}`); }
export function isHarnessClaim(claim) { return harnessRoots.some((root) => claim === root || claim.startsWith(`${root}/`)); }
export function assertClaimPolicy(root, claims) {
  for (const value of claims) {
    const claim = normalizeClaim(value);
    if (!isHarnessClaim(claim) && !isDiscoverableWorkspaceClaim(root, claim)) throw new Error(`Claim is outside harness or discovered work scope: ${claim}`);
  }
}
export function git(root, args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim(); }
export function gitSummary(root) { return { head: git(root, ['rev-parse', '--short', 'HEAD']), dirty: Boolean(git(root, ['status', '--porcelain', '--untracked-files=all'])) }; }
export function gitFingerprint(worktree) {
  const untracked = git(worktree, ['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
  const untrackedHashes = untracked.map((path) => `${path}:${git(worktree, ['hash-object', '--', path])}`);
  return stableId('git-state', [git(worktree, ['rev-parse', 'HEAD']), git(worktree, ['status', '--porcelain=v1', '--untracked-files=all']), git(worktree, ['diff', '--binary']), git(worktree, ['diff', '--cached', '--binary']), ...untrackedHashes].join('\n'));
}
export function assertVerificationStage(run) { if (!['developing', 'verifying'].includes(run.stage)) throw new Error('Verification requires development'); }
export function withClaimsLock(root, action) {
  const directory = storeRoot(root);
  mkdirSync(directory, { recursive: true });
  const lock = join(directory, '.claims.lock');
  let acquired = false;
  try {
    mkdirSync(lock); acquired = true; return action();
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('Another claim operation is in progress');
    throw error;
  } finally {
    if (acquired) rmSync(lock, { recursive: true, force: true });
  }
}
export function createDesign(root, { id, title, claims }) {
  return withClaimsLock(root, () => {
    assertRunId(id); if (!title?.trim()) throw new Error('Design title is required'); if (!claims?.length) throw new Error('At least one --claim is required'); if (existsSync(runFile(root, id))) throw new Error(`Duplicate run ID: ${id}`);
    const normalized = [...new Set(claims.map(normalizeClaim))]; assertClaimPolicy(root, normalized); assertClaimsAvailable(root, id, normalized);
    return saveRun(root, { id, title: title.trim(), claims: normalized, stage: 'designed', designedAt: new Date().toISOString(), baseCommit: git(root, ['rev-parse', 'HEAD']), verifications: [], git: gitSummary(root) });
  });
}
export function assertCleanIntake(intake) { if (git(resolve(intake), ['status', '--porcelain'])) throw new Error(`Dirty intake worktree rejected: ${intake}`); }
export function createRunWorktree(root, run, intake = '') {
  if (run.stage !== 'designed') throw new Error('A worktree can be created only after design approval'); if (intake) assertCleanIntake(intake); assertClaimPolicy(root, run.claims); assertClaimsAvailable(root, run.id, run.claims);
  const worktree = join(root, '.worktrees', 'harness-runs', run.id); const branch = `harness/${run.id}`; if (existsSync(worktree)) throw new Error(`Managed worktree already exists: ${worktree}`);
  execFileSync('git', ['worktree', 'add', '-b', branch, worktree, run.baseCommit], { cwd: root, encoding: 'utf8', windowsHide: true });
  Object.assign(run, { worktree, branch, stage: 'worktree-ready', git: gitSummary(worktree) }); return saveRun(root, run);
}
export function transition(root, run, stage) { const allowed = { 'worktree-ready': ['developing'], developing: ['verifying'], verifying: ['completed', 'failed'] }; if (!stages.includes(stage) || !allowed[run.stage]?.includes(stage)) throw new Error(`Cannot transition ${run.stage} -> ${stage}`); run.stage = stage; run.git = gitSummary(run.worktree ?? root); return saveRun(root, run); }
export function changedPaths(run) { if (!run.worktree) return []; const parts = [git(run.worktree, ['diff', '--name-only', `${run.baseCommit}...HEAD`]), git(run.worktree, ['diff', '--name-only']), git(run.worktree, ['diff', '--cached', '--name-only']), git(run.worktree, ['ls-files', '--others', '--exclude-standard'])]; return [...new Set(parts.join('\n').split(/\r?\n/).filter(Boolean))]; }
export function isClaimedPath(path, claims) { const changed = normalizeClaim(path); return claims.map(normalizeClaim).some((claim) => changed === claim || changed.startsWith(`${claim}/`)); }
export function assertChangesWithinClaims(run) {
  const outside = changedPaths(run).find((path) => !isClaimedPath(path, run.claims ?? []));
  if (outside) throw new Error(`Harness run changed a path outside its claims: ${outside}`);
}
export function latestVerification(run, command) { return [...run.verifications].reverse().find((item) => item.command === command); }
export function assertVerificationFresh(run) {
  const fingerprint = gitFingerprint(run.worktree);
  for (const command of requiredChecks) {
    const item = latestVerification(run, command);
    if (!item || item.exitCode !== 0 || item.gitFingerprint !== fingerprint) throw new Error(`Current successful verification required: ${command}`);
  }
}
export function verifyRun(root, run, result) {
  assertVerificationStage(run);
  const recorded = { ...result, recordedAt: new Date().toISOString(), gitFingerprint: gitFingerprint(run.worktree) };
  run.stage = recorded.exitCode === 0 ? 'verifying' : 'failed'; run.verifications.push(recorded); run.git = gitSummary(run.worktree); return saveRun(root, run);
}
