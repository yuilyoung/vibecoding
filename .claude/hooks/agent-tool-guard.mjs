import { readFileSync } from "node:fs";

const rawInput = readFileSync(0, "utf8");
const payload = rawInput.length > 0 ? JSON.parse(rawInput) : {};
const toolName = String(payload.tool_name ?? "");
const agentType = String(payload.agent_type ?? "");

if (agentType.length === 0) {
  process.exit(0);
}

const allowedToolsByAgent = {
  planner: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
  "prd-generator": ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
  "prd-validator": ["Read", "Glob", "Grep", "Bash"],
  architect: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
  "create-tasks": ["Read", "Glob", "Grep", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet"],
  frontend: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "TaskUpdate"],
  backend: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "TaskUpdate"],
  "app-developer": ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "TaskUpdate"],
  devops: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "TaskUpdate"],
  "code-reviewer": ["Read", "Glob", "Grep", "Bash"],
  qa: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "TaskUpdate"],
  "doc-writer": ["Read", "Write", "Edit", "Glob", "Grep"],
  pm: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Agent", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet"],
  "git-manager": ["Read", "Glob", "Grep", "Bash"]
};

const allowed = allowedToolsByAgent[agentType];

if (allowed === undefined) {
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: `[GUARD] 미등록 에이전트: ${agentType}`
    })
  );
  process.exit(0);
}

if (!allowed.includes(toolName)) {
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: `[GUARD] ${agentType} 에이전트에 허용되지 않은 도구: ${toolName}`
    })
  );
}
