import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const rawInput = readFileSync(0, "utf8");
const payload = rawInput.length > 0 ? JSON.parse(rawInput) : {};
const filePath = String(payload.tool_input?.file_path ?? "").replace(/\\/g, "/");
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const logPath = path.join(projectDir, ".claude", "pm-hook.log");

mkdirSync(path.dirname(logPath), { recursive: true });

const now = new Date();
const timestamp = `[${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}]`;

const rules = [
  [/docs\/planning\/prd\.md$/u, "[HOOK] PRD 수정 감지 - [RULE] prd-validator 검증 필요 (90점 이상 달성 시 비전 승인 요청)"],
  [/docs\/planning\/prd-draft\.md$/u, "[HOOK] PRD 초안 수정 감지 - [RULE] prd-generator → prd-validator 검증 단계 실행 필요"],
  [/docs\/architecture\//u, "[HOOK] 아키텍처 문서 수정 감지 - [RULE] architect 리뷰 및 비전 승인 요청 필요"],
  [/(Assets|src)\/.*\.(cs|js|ts|tsx|jsx|go|py)$/u, `[HOOK] 소스코드 수정 감지 (${filePath}) - [RULE] code-reviewer 검토 필요 (90점 이상 달성 시 qa 단계 진행)`],
  [/docs\/test\//u, "[HOOK] 테스트 문서 수정 감지 - [RULE] qa 검증 완료 확인 후 doc-writer 기술문서 작성 단계 진행"],
  [/docs\/(api|guides|changelog)\//u, `[HOOK] 기술문서 수정 감지 (${filePath}) - [RULE] doc-writer 완료 → PM 보고서 2종 생성 단계 진행`],
  [/docs\/reports\/project-status\.md$/u, "[HOOK] PM MD 보고서 생성 감지 - [RULE] 비전 검토 후 이상 없으면 대시보드 생성 요청"],
  [/reports\/project-status\.html$/u, "[HOOK] PM HTML 보고서 생성 감지 - [RULE] 비전: 누락 섹션 확인 필요"],
  [/dashboard\/index\.html$/u, "[HOOK] 대시보드 생성 완료 - [RULE] 비전: 사용자에게 결과 보고 및 dashboard/index.html 경로 안내"]
];

for (const [pattern, message] of rules) {
  if (pattern.test(filePath)) {
    appendFileSync(logPath, `${timestamp} ${message}\n`, "utf8");
  }
}
