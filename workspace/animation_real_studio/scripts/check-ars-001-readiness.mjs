import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const decisionLogUrl = new URL("../tasks/ars-001-decision-log.json", import.meta.url);

export function loadDecisionLog() {
  return JSON.parse(readFileSync(decisionLogUrl, "utf8"));
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasRecordedEvidence(evidence) {
  return Array.isArray(evidence) && evidence.length > 0 && evidence.every((item) => hasText(item?.recordedAt) && hasText(item?.location));
}

export function evaluateArs001Readiness(log) {
  const decisions = (log.decisions ?? []).map((decision) => {
    const missing = [];
    if (!hasText(decision.ownerRole)) missing.push("ownerRole");
    if (!hasText(decision.decisionDeadline)) missing.push("decisionDeadline");
    if (!hasRecordedEvidence(decision.evidence)) missing.push("recordedEvidence");
    const pendingQuestions = Array.isArray(decision.pendingQuestions) ? decision.pendingQuestions.filter(hasText) : [];
    if (pendingQuestions.length) missing.push(`pendingQuestions:${pendingQuestions.length}`);
    return { id: decision.id, missing };
  }).filter((decision) => decision.missing.length > 0);

  const interview = log.v1Interview ?? {};
  const records = Array.isArray(interview.records) ? interview.records : [];
  const independentlyCompleted = records.filter((record) => record.completedWithoutAssistance === true).length;
  const minimumParticipants = Number(interview.minimumParticipants ?? 5);
  const minimumIndependentCompletions = Number(interview.minimumIndependentCompletions ?? 4);
  const interviewMissing = [];
  if (records.length < minimumParticipants) interviewMissing.push(`records:${records.length}/${minimumParticipants}`);
  if (independentlyCompleted < minimumIndependentCompletions) interviewMissing.push(`independentCompletions:${independentlyCompleted}/${minimumIndependentCompletions}`);

  const pending = { decisions, interview: interviewMissing };
  const ready = decisions.length === 0 && interviewMissing.length === 0;
  return {
    taskId: log.task?.id,
    taskStatus: ready ? "ready_for_human_completion_review" : "pending_external_evidence",
    ready,
    pending,
    automationBoundary: log.automationBoundary
  };
}

function run() {
  const requireReady = process.argv.includes("--require-ready");
  const result = evaluateArs001Readiness(loadDecisionLog());
  console.log(JSON.stringify(result, null, 2));
  if (requireReady && !result.ready) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run();
