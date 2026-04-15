import { readFileSync } from "node:fs";
import path from "node:path";

const reportPath = path.join(process.cwd(), "work", "2D-FPS-game", "docs", "reports", "project-status.md");
const text = readFileSync(reportPath, "utf8");
const lines = text.split(/\r?\n/);
const startIndex = lines.findIndex((line) => line.includes("Immediate Next Tasks") || line.includes("다음 단계"));

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

let tasks = taskLines
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

if (tasks.length === 0) {
  tasks = lines
    .slice(startIndex + 1)
    .filter((line) => /^\d+\.\s+/.test(line.trim()))
    .slice(0, 10)
    .map((line) => {
      const match = line.trim().match(/^(\d+)\.\s+(.*)$/);
      const body = match?.[2] ?? line.trim();
      const ownerMatch = body.match(/\(([^)]+)\)\s*$/);
      const owner = ownerMatch !== null && !ownerMatch[1].includes(" ") ? ownerMatch[1] : "";
      return {
        priority: match?.[1] ?? "",
        id: "",
        task: body.replace(/\*\*/g, "").replace(owner === "" ? /$^/ : /\s+\([^)]+\)\s*$/, ""),
        owner,
        estimate: ""
      };
    });
}

process.stdout.write(`${JSON.stringify({ ctx: "work/2D-FPS-game/docs/reports/project-status.md", nextTasks: tasks }, null, 2)}\n`);
