import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

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

writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
