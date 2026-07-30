import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const handoffPath = path.join(repoRoot, "docs", "handoffs", "current-handoff.json");
const baselinePath = path.join(repoRoot, "docs", "development", "active-workspace-baseline.md");

const result = {
  ctx: "ultron preflight",
  handoffPresent: existsSync(handoffPath),
  baselinePresent: existsSync(baselinePath),
  runtimeBaseline: "unknown",
  planner: "vision",
  executor: "ultron"
};

if (existsSync(baselinePath)) {
  const baselineText = readFileSync(baselinePath, "utf8");
  result.runtimeBaseline = baselineText.includes("work/2D-FPS-game")
    ? "work/2D-FPS-game"
    : "unknown";
}

const dashboard = spawnSync(process.execPath, ["scripts/agent-observability-service.mjs", "start"], { cwd: repoRoot, encoding: "utf8", timeout: 7000 });
try {
  result.dashboard = JSON.parse(dashboard.stdout);
} catch {
  result.dashboard = {
    started: false,
    error: dashboard.stderr?.trim?.() || dashboard.error?.message || dashboard.stdout?.trim?.() || "service start failed"
  };
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
