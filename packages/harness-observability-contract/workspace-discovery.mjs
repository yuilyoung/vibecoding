import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const manifestTypes = [{ name: 'package.json', tooling: 'node' }, { name: 'pyproject.toml', tooling: 'python' }, { name: 'Cargo.toml', tooling: 'rust' }, { name: 'go.mod', tooling: 'go' }, { name: 'project.godot', tooling: 'godot' }];
const statusArtifacts = ['docs/reports/project-status.md', 'docs/reports/status.md', 'STATUS.md'];

function gitText(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  } catch {
    return '';
  }
}
function artifactState(projectRoot, relative, path) {
  const file = join(projectRoot, path);
  return { path: `${relative}/${path}`, available: existsSync(file), modifiedAt: existsSync(file) ? statSync(file).mtime.toISOString() : null };
}
export function discoverWorkspaces(root) {
  const workRoot = join(root, 'work');
  if (!existsSync(workRoot)) return [];
  return readdirSync(workRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const projectRoot = join(workRoot, entry.name); const relative = `work/${entry.name}`;
      const manifest = manifestTypes.find((candidate) => existsSync(join(projectRoot, candidate.name))) ?? null;
      return {
        id: relative,
        manifest: manifest ? `${relative}/${manifest.name}` : null,
        tooling: manifest?.tooling ?? 'unclassified',
        provenance: 'work-directory',
        git: { dirty: Boolean(gitText(root, ['status', '--porcelain', '--untracked-files=all', '--', relative])), latestCommitAt: gitText(root, ['log', '-1', '--format=%cI', '--', relative]) || null },
        statusArtifacts: statusArtifacts.map((path) => artifactState(projectRoot, relative, path))
      };
    });
}
export function isDiscoverableWorkspaceClaim(root, claim) {
  const [prefix, name] = String(claim).split('/');
  return prefix === 'work' && Boolean(name) && discoverWorkspaces(root).some((project) => project.id === `work/${name}`);
}
