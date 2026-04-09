import { readFileSync } from "node:fs";

const rawInput = readFileSync(0, "utf8");
const payload = rawInput.length > 0 ? JSON.parse(rawInput) : {};
const filePath = String(payload.tool_input?.file_path ?? "");
const agentType = String(payload.agent_type ?? "");

const normalized = filePath.replace(/\\/g, "/");

if (normalized.includes("/work/") || normalized.startsWith("work/")) {
  if (/\/docs\/.*\.md$/u.test(normalized) && agentType.length > 0 && agentType !== "doc-writer") {
    process.stdout.write(
      JSON.stringify({
        decision: "block",
        reason: "[GUARD] work/**/docs/*.md 문서는 doc-writer만 수정 가능합니다."
      })
    );
  }

  process.exit(0);
}

if (/(^|\/)(\.claude\/|CLAUDE\.md$|\.mcp\.json$|\.gitignore$)/u.test(normalized)) {
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: "[GUARD] 루트 설정 파일 수정 금지. work/ 하위 프로젝트에서만 작업하세요."
    })
  );
}
