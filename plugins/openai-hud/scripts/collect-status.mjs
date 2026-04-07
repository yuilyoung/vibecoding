import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const harnessPath = path.join(repoRoot, "work", "2D-FPS-game", "docs", "development", "harness-checklist.md");
const reportPath = path.join(repoRoot, "docs", "reports", "project-status.md");

const readText = (filePath) => {
  if (!existsSync(filePath)) {
    return "";
  }

  return readFileSync(filePath, "utf8");
};

const extractTableValue = (text, key) => {
  const line = text
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`| ${key} |`));

  if (line === undefined) {
    return "";
  }

  const columns = line.split("|").map((entry) => entry.trim()).filter(Boolean);
  return columns[1] ?? "";
};

const harnessText = readText(harnessPath);
const reportText = readText(reportPath);

const payload = {
  ctx: "work/2D-FPS-game",
  status: extractTableValue(reportText, "Verification") || "unknown",
  stage: extractTableValue(reportText, "Active milestone") || "unknown",
  readiness: extractTableValue(reportText, "Development status") || "unknown",
  sourceFiles: [harnessPath, reportPath]
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
