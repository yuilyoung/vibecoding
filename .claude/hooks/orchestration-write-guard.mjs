import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const statePath = path.join(projectDir, ".claude", "state", "orchestration-required.json");

if (!existsSync(statePath)) {
  process.exit(0);
}

const rawInput = readFileSync(0, "utf8");
const payload = rawInput.length > 0 ? JSON.parse(rawInput) : {};
const filePath = String(payload.tool_input?.file_path ?? "").replace(/\\/g, "/");
const agentType = String(payload.agent_type ?? "").trim();

if (agentType.length > 0) {
  process.exit(0);
}

const guardedRoots = [
  "work/2D-FPS-game/src/",
  "work/2D-FPS-game/tests/",
  "work/2D-FPS-game/public/assets/"
];

const isGuardedWrite = guardedRoots.some((root) => filePath.includes(root) || filePath.startsWith(root));

if (!isGuardedWrite) {
  process.exit(0);
}

process.stdout.write(JSON.stringify({
  decision: "block",
  reason: "[GUARD] This request is marked as requiring domain subagent orchestration. The main agent must delegate work to specialist subagents before editing work/2D-FPS-game files."
}));
