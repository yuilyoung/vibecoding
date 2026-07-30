import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const metadataPath = path.join(repoRoot, "codex", "state", "reliability-metadata.json");
const catalogPath = path.join(repoRoot, "codex", "manuals", "catalog.json");
const requiredPaths = [
  ".codex/agents/product-owner.toml",
  ".codex/agents/reviewer.toml",
  "codex/state/lessons.md",
  "docs/development/codex-manual-authoring.md",
  "docs/development/codex-agent-topology.md"
];
const errors = [];

for (const requiredPath of requiredPaths) {
  if (!existsSync(path.join(repoRoot, requiredPath))) errors.push(`Missing required path: ${requiredPath}`);
}

function readJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`Invalid ${label}: ${error.message}`);
    return undefined;
  }
}

const metadata = existsSync(metadataPath) ? readJson(metadataPath, "reliability metadata") : undefined;
const catalog = existsSync(catalogPath) ? readJson(catalogPath, "manual catalog") : undefined;

if (metadata) {
  if (metadata.schemaVersion !== "1.0.0") errors.push("Unsupported reliability metadata schemaVersion");
  for (const axis of ["dataMetadata", "manualSsot", "adversarialValidation", "freshness"]) {
    if (typeof metadata.axes?.[axis] !== "string" || metadata.axes[axis].length === 0) {
      errors.push(`Missing reliability axis: ${axis}`);
    }
  }
  if (!Array.isArray(metadata.adoptionGates) || metadata.adoptionGates.length !== 5) {
    errors.push("Reliability metadata must define five adoption gates");
  }
}

if (catalog) {
  if (catalog.schemaVersion !== "1.0.0" || !Array.isArray(catalog.manuals) || catalog.manuals.length === 0) {
    errors.push("Manual catalog is missing a supported manual list");
  }

  for (const manual of catalog.manuals ?? []) {
    for (const field of ["id", "path", "name", "description"]) {
      if (typeof manual[field] !== "string" || manual[field].length === 0) errors.push(`Manual is missing ${field}: ${manual.id ?? "unknown"}`);
    }
    if (!Array.isArray(manual.triggers) || manual.triggers.length === 0) errors.push(`Manual has no triggers: ${manual.id}`);
    if (!Array.isArray(manual.watchPaths) || manual.watchPaths.length === 0) errors.push(`Manual has no watchPaths: ${manual.id}`);

    const manualPath = path.join(repoRoot, manual.path ?? "");
    if (!existsSync(manualPath)) {
      errors.push(`Missing manual: ${manual.path ?? manual.id}`);
      continue;
    }

    const text = readFileSync(manualPath, "utf8");
    const requiredHeadings = ["## Order", "## Method", "## Cautions"];
    if (!text.startsWith("# ")) errors.push(`Manual needs a one-line title: ${manual.path}`);
    if (!/^> .+/m.test(text)) errors.push(`Manual needs a one-line description: ${manual.path}`);
    for (const heading of requiredHeadings) {
      if (!text.includes(heading)) errors.push(`Manual is missing ${heading}: ${manual.path}`);
    }
  }
}

const result = {
  ok: errors.length === 0,
  profile: "hermes-skills-codex",
  checkedAt: new Date().toISOString(),
  errors
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.ok ? 0 : 1;
