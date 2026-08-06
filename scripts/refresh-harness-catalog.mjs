import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const metadataPath = path.join(repoRoot, ".claude", "state", "ssot-metadata.json");
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const requiredPluginNames = new Set((metadata.pluginPolicy?.required ?? []).map((plugin) => plugin.name));
const results = [];

for (const source of metadata.sources ?? []) {
  const response = await fetch(source.url, { headers: { "user-agent": "ai-project-harness-refresh/1.0" } });
  if (!response.ok) throw new Error(`Refresh failed for ${source.id}: HTTP ${response.status}`);

  const body = await response.text();
  const result = { id: source.id, bytes: body.length };
  if (source.id === "anthropic-plugin-marketplace") {
    const catalog = JSON.parse(body);
    const available = new Set((catalog.plugins ?? []).map((plugin) => plugin.name));
    const missing = [...requiredPluginNames].filter((name) => !available.has(name));
    if (missing.length > 0) throw new Error(`Official marketplace no longer contains: ${missing.join(", ")}`);
    result.requiredPluginsPresent = [...requiredPluginNames].sort();
  }
  results.push(result);
}

const refreshedAt = new Date().toISOString();
for (const source of metadata.sources ?? []) source.lastVerifiedAt = refreshedAt;
metadata.lastVerifiedAt = refreshedAt;
metadata.lastRefresh = { refreshedAt, sources: results, result: "success" };
writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ok: true, refreshedAt, sources: results }, null, 2)}\n`);