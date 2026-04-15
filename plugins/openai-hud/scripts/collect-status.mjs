import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const harnessPath = path.join(repoRoot, "work", "2D-FPS-game", "docs", "development", "harness-checklist.md");
const reportPath = path.join(repoRoot, "work", "2D-FPS-game", "docs", "reports", "project-status.md");

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

const extractBulletValue = (text, key) => {
  const line = text
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`- **${key}:**`));

  return line?.replace(new RegExp(`^- \\*\\*${key}:\\*\\*\\s*`), "").trim() ?? "";
};

const extractSectionText = (text, heading) => {
  const lines = text.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);

  if (startIndex === -1) {
    return "";
  }

  const sectionLines = [];

  for (const line of lines.slice(startIndex + 1)) {
    if (line.startsWith("## ")) {
      break;
    }

    if (line.trim() !== "") {
      sectionLines.push(line.trim());
    }
  }

  return sectionLines.join(" ");
};

const harnessText = readText(harnessPath);
const reportText = readText(reportPath);
const summaryText = extractSectionText(reportText, "요약");
const inProgressText = extractSectionText(reportText, "진행 중");

const payload = {
  ctx: "work/2D-FPS-game",
  status: extractTableValue(reportText, "Verification") || (summaryText.includes("검증") ? summaryText : "unknown"),
  stage: extractTableValue(reportText, "Active milestone") || extractBulletValue(reportText, "Phase") || "unknown",
  readiness: extractTableValue(reportText, "Development status") || inProgressText || "unknown",
  sourceFiles: [harnessPath, reportPath]
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
