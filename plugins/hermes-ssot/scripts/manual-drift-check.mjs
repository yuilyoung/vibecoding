import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const catalogPath = path.join(repoRoot, "codex", "manuals", "catalog.json");
const baseIndex = process.argv.indexOf("--base");
const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : "HEAD";
const errors = [];

if (!existsSync(catalogPath)) {
  process.stdout.write(`${JSON.stringify({ ok: false, errors: ["Missing manual catalog"] }, null, 2)}\n`);
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const changed = new Set();

try {
  const diff = execFileSync("git", ["diff", "--name-only", base], { cwd: repoRoot, encoding: "utf8" });
  for (const file of diff.split(/\r?\n/)) if (file) changed.add(file.replace(/\\/g, "/"));
  const status = execFileSync("git", ["status", "--porcelain=v1", "-uall"], { cwd: repoRoot, encoding: "utf8" });
  for (const line of status.split(/\r?\n/)) {
    if (line.length >= 4) changed.add(line.slice(3).replace(/\\/g, "/"));
  }
} catch (error) {
  errors.push(`Unable to inspect git changes: ${error.message}`);
}

for (const manual of catalog.manuals ?? []) {
  const watchedChange = (manual.watchPaths ?? []).some((watchPath) => {
    const normalized = watchPath.replace(/\\/g, "/").replace(/\/$/, "");
    return [...changed].some((file) => file === normalized || file.startsWith(`${normalized}/`));
  });
  const manualChanged = changed.has(manual.path);
  if (watchedChange && !manualChanged) {
    errors.push(`Manual drift: ${manual.id} must be reviewed because a watched source changed`);
  }
}

const result = {
  ok: errors.length === 0,
  base,
  changed: [...changed].sort(),
  errors
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.ok ? 0 : 1;
