import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'); let last = { at: 0, value: null };
function read(relative) { const file = join(root, relative); return existsSync(file) ? readFileSync(file, 'utf8') : ''; }
function table(text, key) { const line = text.split(/\r?\n/).find((entry) => entry.includes(`| ${key} |`)); return line?.split('|').map((x) => x.trim()).filter(Boolean)[1] ?? ''; }
function bullets(text) { return text.split(/\r?\n/).filter((line) => line.startsWith('- ')).slice(0, 4); }
function collect(script) {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    timeout: 2_000,
    windowsHide: true
  });
  if (result.status !== 0) return { ok: false, error: result.error?.message || result.stderr?.trim() || `collector exited with ${result.status ?? 'unknown'}` };
  try {
    return { ok: true, value: JSON.parse(result.stdout) };
  } catch {
    return { ok: false, error: 'collector returned invalid JSON' };
  }
}

function unavailable(error) { return { status: 'unavailable', error }; }

export function projectStatus() {
  const now = Date.now();
  if (last.value && now - last.at < 2_000) return last.value;
  const workspace = collect('plugins/openai-hud/scripts/collect-workspace-status.mjs');
  const project = collect('plugins/openai-hud/scripts/collect-status.mjs');
  last = {
    at: now,
    value: {
      workspace: workspace.ok ? workspace.value : unavailable(workspace.error),
      project: project.ok ? project.value : unavailable(project.error)
    }
  };
  return last.value;
}
