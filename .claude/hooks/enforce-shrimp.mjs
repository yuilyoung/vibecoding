import { readFileSync } from "node:fs";

const rawInput = readFileSync(0, "utf8");
const payload = rawInput.length > 0 ? JSON.parse(rawInput) : {};
const toolName = String(payload.tool_name ?? "");
const agentType = String(payload.agent_type ?? "");

if (agentType !== "verify") {
  process.exit(0);
}

if (toolName.startsWith("mcp__")) {
  if (!toolName.startsWith("mcp__shrimp-task-manager__")) {
    process.stderr.write(
      `verify 에이전트는 shrimp-task-manager MCP만 사용 가능합니다. (차단: ${toolName})\n`
    );
    process.exit(2);
  }

  process.exit(0);
}

const allowed = new Set(["Read", "Glob", "Grep", "Bash", "TaskUpdate", "TaskList", "TaskGet"]);

if (!allowed.has(toolName)) {
  process.stderr.write(`verify 에이전트에서 허용되지 않은 도구: ${toolName}\n`);
  process.exit(2);
}
