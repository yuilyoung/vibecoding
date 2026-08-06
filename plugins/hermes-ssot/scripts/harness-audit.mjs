import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(pluginRoot, "..", "..");
const metadataPath = path.join(repoRoot, "codex", "state", "reliability-metadata.json");
const catalogPath = path.join(repoRoot, "codex", "manuals", "catalog.json");
const requiredPaths = [
  ".codex/agents/product-owner.toml",
  ".codex/agents/reviewer.toml",
  "codex/state/lessons.md",
  "docs/development/codex-manual-authoring.md",
  "docs/development/codex-agent-topology.md",
  "plugins/hermes-ssot/.codex-plugin/plugin.json",
  "plugins/hermes-ssot/hooks/hooks.json",
  "plugins/hermes-ssot/lib/harness-engine.mjs",
  "plugins/hermes-ssot/lib/harness-store.mjs",
  "plugins/hermes-ssot/scripts/harness-controller.mjs",
  "plugins/hermes-ssot/scripts/harness-controller.test.mjs",
  "plugins/hermes-ssot/schemas/harness-state.schema.json",
  "plugins/hermes-ssot/schemas/harness-event.schema.json",
  "plugins/hermes-ssot/skills/delivery-runbook/references/state-machine.md"
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
const manifest = readJson(path.join(pluginRoot, ".codex-plugin", "plugin.json"), "plugin manifest");
const hookConfig = readJson(path.join(pluginRoot, "hooks", "hooks.json"), "plugin hooks");
readJson(path.join(pluginRoot, "schemas", "harness-state.schema.json"), "harness state schema");
readJson(path.join(pluginRoot, "schemas", "harness-event.schema.json"), "harness event schema");

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

if (manifest) {
  if (manifest.name !== "hermes-ssot") errors.push("Plugin manifest name must be hermes-ssot");
  if (Object.hasOwn(manifest, "hooks")) errors.push("Use the default hooks/hooks.json path instead of a manifest hook override");
}

if (hookConfig) {
  const requiredEvents = ["SessionStart", "UserPromptSubmit", "SubagentStart", "SubagentStop", "PreToolUse", "PostToolUse", "Stop"];
  for (const eventName of requiredEvents) {
    const groups = hookConfig.hooks?.[eventName];
    if (!Array.isArray(groups) || groups.length === 0) {
      errors.push(`Missing plugin hook event: ${eventName}`);
      continue;
    }
    for (const group of groups) {
      if (group.matcher) {
        try { new RegExp(group.matcher); } catch { errors.push(`Invalid hook matcher for ${eventName}`); }
      }
      for (const handler of group.hooks ?? []) {
        if (handler.type !== "command") errors.push(`Unsupported hook handler type for ${eventName}`);
        if (!String(handler.command ?? "").includes("$PLUGIN_ROOT")) errors.push(`Unix hook command must use PLUGIN_ROOT for ${eventName}`);
        if (!String(handler.commandWindows ?? "").includes("%PLUGIN_ROOT%")) errors.push(`Windows hook command must use PLUGIN_ROOT for ${eventName}`);
        if (!Number.isFinite(handler.timeout) || handler.timeout <= 0) errors.push(`Hook timeout is required for ${eventName}`);
      }
    }
  }
}

const productOwner = readFileSync(path.join(repoRoot, ".codex", "agents", "product-owner.toml"), "utf8");
const reviewer = readFileSync(path.join(repoRoot, ".codex", "agents", "reviewer.toml"), "utf8");
const runbook = readFileSync(path.join(pluginRoot, "skills", "delivery-runbook", "SKILL.md"), "utf8");
if (!productOwner.includes("Decision: approved") || !productOwner.includes("Decision: blocked")) errors.push("Product-owner contract is missing the exact decision line");
if (!reviewer.includes("Verdict: pass") || !reviewer.includes("Verdict: revise") || !reviewer.includes("Verdict: blocked")) errors.push("Reviewer contract is missing exact verdict lines");
for (const phrase of ["Always ask", "workspace fingerprint", "hook state reaches `completed`", "state-machine.md"]) {
  if (!runbook.includes(phrase)) errors.push(`Delivery runbook is missing required contract: ${phrase}`);
}

const result = {
  ok: errors.length === 0,
  profile: "hermes-skills-codex",
  checkedAt: new Date().toISOString(),
  errors
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.ok ? 0 : 1;
