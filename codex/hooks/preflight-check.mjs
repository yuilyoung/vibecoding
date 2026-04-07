import { existsSync, readFileSync } from "node:fs";
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

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
