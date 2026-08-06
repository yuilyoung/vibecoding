import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const metadataPath = path.join(repoRoot, ".claude", "state", "ssot-metadata.json");
const errors = [];
const now = Date.now();

if (!existsSync(metadataPath)) {
  errors.push("Missing .claude/state/ssot-metadata.json");
}

let metadata;
if (errors.length === 0) {
  try {
    metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  } catch (error) {
    errors.push(`Invalid SSOT metadata JSON: ${error.message}`);
  }
}

if (metadata !== undefined) {
  if (metadata.schemaVersion !== "1.0.0") errors.push("Unsupported or missing SSOT schemaVersion");

  for (const axis of ["dataMetadata", "manualSsot", "adversarialValidation", "freshness"]) {
    if (typeof metadata.axes?.[axis] !== "string" || metadata.axes[axis].length === 0) {
      errors.push(`Missing SSOT axis: ${axis}`);
    }
  }

  for (const source of metadata.sources ?? []) {
    const verifiedAt = Date.parse(source.lastVerifiedAt ?? "");
    if (!source.id || !source.url || !Number.isFinite(verifiedAt) || !Number.isFinite(source.refreshAfterDays)) {
      errors.push(`Malformed source entry: ${source.id ?? "unknown"}`);
    } else if ((now - verifiedAt) / 86_400_000 > source.refreshAfterDays) {
      errors.push(`Stale source: ${source.id}`);
    }
  }

  for (const requiredSource of ["anthropic-plugin-marketplace", "hermes-agent-cli-reference"]) {
    if (!metadata.sources?.some((source) => source.id === requiredSource)) errors.push(`Missing source: ${requiredSource}`);
  }

  for (const manual of metadata.manuals ?? []) {
    if (!manual.path || !existsSync(path.join(repoRoot, manual.path))) errors.push(`Missing manual: ${manual.path ?? "unknown"}`);
  }

  for (const plugin of metadata.pluginPolicy?.required ?? []) {
    if (!plugin.name || plugin.marketplace !== "claude-plugins-official") errors.push(`Invalid plugin policy: ${plugin.name ?? "unknown"}`);
  }

  if ((metadata.pluginPolicy?.required?.length ?? 0) < 3) errors.push("Incomplete required plugin policy");
  if (!metadata.loop?.terminalStates?.includes("success") || !metadata.loop?.terminalStates?.includes("blocked")) errors.push("Incomplete terminal states");
}

const result = { ok: errors.length === 0, checkedAt: new Date().toISOString(), metadataPath: path.relative(repoRoot, metadataPath), errors };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.ok ? 0 : 1;