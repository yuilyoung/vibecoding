import { readFileSync } from "node:fs";
import path from "node:path";

const reportPath = path.join(process.cwd(), "docs", "reports", "project-status.md");
const text = readFileSync(reportPath, "utf8");
const lines = text.split(/\r?\n/);
const startIndex = lines.findIndex((line) => line.includes("Immediate Next Tasks"));

if (startIndex === -1) {
  process.stderr.write("next tasks section not found\n");
  process.exit(1);
}

const taskLines = [];

for (const line of lines.slice(startIndex + 1)) {
  if (line.startsWith("#")) {
    break;
  }

  if (line.trim().startsWith("|") && !line.includes("---")) {
    taskLines.push(line);
  }
}

const tasks = taskLines
  .slice(1, 11)
  .map((line) => line.split("|").map((entry) => entry.trim()).filter(Boolean))
  .filter((columns) => columns.length >= 5)
  .map((columns) => ({
    priority: columns[0],
    id: columns[1],
    task: columns[2],
    owner: columns[3],
    estimate: columns[4]
  }));

process.stdout.write(`${JSON.stringify({ ctx: "docs/reports/project-status.md", nextTasks: tasks }, null, 2)}\n`);
