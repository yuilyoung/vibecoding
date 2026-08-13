import { readFileSync } from "node:fs";

const rawInput = readFileSync(0, "utf8");
const payload = rawInput.length > 0 ? JSON.parse(rawInput) : {};
const filePath = String(payload.tool_input?.file_path ?? "");
const agentType = String(payload.agent_type ?? "");

const normalized = filePath.replace(/\\/g, "/");
const isMailboxFile = /(^|\/)workspace\/[^/]+\/\.mailbox\/[^/]+\.md$/u.test(normalized);
const isHermesStateFile = /(^|\/)\.claude\/state\/ssot-(metadata|evidence)\.json$/u.test(normalized);

if (agentType === "hermes") {
  if (isMailboxFile || isHermesStateFile) {
    process.exit(0);
  }

  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: "[GUARD] hermes may edit only SSOT state files and project mailboxes."
    })
  );
  process.exit(0);
}

if (agentType === "adversarial-validator") {
  if (isMailboxFile) {
    process.exit(0);
  }

  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: "[GUARD] adversarial-validator may edit only project mailboxes."
    })
  );
  process.exit(0);
}

if (normalized.includes("/workspace/") || normalized.startsWith("workspace/")) {
  if (/\/docs\/.*\.md$/u.test(normalized) && agentType.length > 0 && agentType !== "doc-writer") {
    process.stdout.write(
      JSON.stringify({
        decision: "block",
        reason: "[GUARD] workspace/**/docs/*.md documents may be modified only by doc-writer."
      })
    );
  }

  process.exit(0);
}

if (/(^|\/)(\.claude\/|CLAUDE\.md$|\.mcp\.json$|\.gitignore$)/u.test(normalized)) {
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: "[GUARD] Root configuration files may not be modified. Work only inside workspace/ projects."
    })
  );
}