import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { appendAgentEvent } from "../../scripts/dashboard-observability.mjs";

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
  result.runtimeBaseline = baselineText.includes("workspace/2D-FPS-game")
    ? "workspace/2D-FPS-game"
    : "unknown";
}

try {
  appendAgentEvent({
    agentId: "ultron",
    timestamp: new Date().toISOString(),
    state: "active",
    eventType: "lifecycle",
    taskId: "codex-preflight",
    message: "Codex preflight completed"
  }, { root: repoRoot });
} catch (error) {
  result.dashboardEventError = error.message;
}

process.stdout.write(JSON.stringify(result, null, 2) + "\n");