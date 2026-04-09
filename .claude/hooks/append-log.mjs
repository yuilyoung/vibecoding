import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const logPath = path.join(projectDir, ".claude", "pm-hook.log");
const message = process.argv.slice(2).join(" ").trim();

if (message.length === 0) {
  process.exit(0);
}

mkdirSync(path.dirname(logPath), { recursive: true });

const now = new Date();
const timestamp = `[${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}]`;

appendFileSync(logPath, `${timestamp} ${message}\n`, "utf8");
