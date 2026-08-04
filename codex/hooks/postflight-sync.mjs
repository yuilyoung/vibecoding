import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appendAgentEvent } from "../../scripts/dashboard-observability.mjs";

const repoRoot = process.cwd();
const reportPath = path.join(repoRoot, "docs", "handoffs", "current-execution-report.md");
const statusPath = path.join(repoRoot, "docs", "handoffs", "execution-status.json");

const status = {
  ctx: "ultron postflight",
  reportPresent: existsSync(reportPath),
  syncedAt: new Date().toISOString(),
  planner: "vision",
  executor: "ultron"
};

if (existsSync(reportPath)) {
  const reportText = readFileSync(reportPath, "utf8");
  status.hasVerificationSection = reportText.includes("## Verification");
}

try {
  appendAgentEvent({
    agentId: "ultron",
    timestamp: status.syncedAt,
    state: "complete",
    eventType: "lifecycle",
    taskId: "codex-postflight",
    message: "Codex postflight synchronized"
  }, { root: repoRoot });
} catch (error) {
  status.dashboardEventError = error.message;
}

writeFileSync(statusPath, JSON.stringify(status, null, 2) + "\n", "utf8");
process.stdout.write(JSON.stringify(status, null, 2) + "\n");