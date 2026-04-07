import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const readText = (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) {
    return "";
  }

  return readFileSync(filePath, "utf8");
};

const extractTableValue = (text, label) => {
  const line = text
    .split(/\r?\n/)
    .find((entry) => entry.includes(`| ${label} |`));

  if (line === undefined) {
    return "";
  }

  const parts = line.split("|").map((entry) => entry.trim()).filter(Boolean);
  return parts[1] ?? "";
};

const checklist = readText("docs/development/agent-workspace-harness-checklist.md");
const baseline = readText("docs/development/active-workspace-baseline.md");
const agentsContract = readText("AGENTS.md");

const payload = {
  ctx: "repo-root agent workspace",
  orchestrator: "vision",
  executor: "ultron",
  status: extractTableValue(checklist, "에이전트 작업환경 하네스"),
  runtimeBaseline: extractTableValue(checklist, "현재 활성 실행 베이스라인"),
  roadmapBaseline: extractTableValue(checklist, "장기 제품 로드맵"),
  contract: agentsContract.length > 0 ? "AGENTS.md present" : "AGENTS.md missing",
  baselineSummary: baseline
    .split(/\r?\n/)
    .filter((line) => line.startsWith("- "))
    .slice(0, 4),
  sourceFiles: [
    path.join(repoRoot, "AGENTS.md"),
    path.join(repoRoot, "docs", "development", "agent-workspace-harness-checklist.md"),
    path.join(repoRoot, "docs", "development", "active-workspace-baseline.md")
  ]
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
