import assert from "node:assert/strict";
import test from "node:test";
import { evaluateArs001Readiness, loadDecisionLog } from "./check-ars-001-readiness.mjs";

test("ARS-001 reports the initial decision and interview gates as pending external evidence", () => {
  const result = evaluateArs001Readiness(loadDecisionLog());
  assert.equal(result.taskId, "ARS-001");
  assert.equal(result.ready, false);
  assert.equal(result.taskStatus, "pending_external_evidence");
  const retryPolicy = loadDecisionLog().decisions.find((decision) => decision.id === "D-002").retryPolicy;
  assert.equal(retryPolicy.retry_consumes_daily_quota, true);
  assert.equal(retryPolicy.dailyQuotaTreatment, "Each retry submission counts against the per-user maximum of five generation submissions per day.");
  assert.deepEqual(result.pending.interview, ["records:0/5", "independentCompletions:0/4"]);
  assert.deepEqual(result.pending.decisions.map(({ id, missing }) => ({ id, missing })), [
    { id: "D-001", missing: ["ownerRole", "decisionDeadline", "recordedEvidence", "pendingQuestions:4"] },
    { id: "D-002", missing: ["ownerRole", "decisionDeadline", "recordedEvidence", "pendingQuestions:3"] },
    { id: "D-003", missing: ["ownerRole", "decisionDeadline", "recordedEvidence", "pendingQuestions:3"] },
    { id: "D-004", missing: ["ownerRole", "decisionDeadline", "recordedEvidence", "pendingQuestions:2"] }
  ]);
});

test("ARS-001 becomes reviewable only with every decision field and the V1 threshold", () => {
  const log = structuredClone(loadDecisionLog());
  for (const decision of log.decisions) {
    decision.ownerRole = "assigned role";
    decision.decisionDeadline = "2026-08-31";
    decision.evidence = [{ recordedAt: "2026-08-02", location: "approved evidence record" }];
    decision.pendingQuestions = [];
  }
  log.v1Interview.records = Array.from({ length: 5 }, (_, index) => ({
    participantCode: `P${String(index + 1).padStart(2, "0")}`,
    completedWithoutAssistance: index < 4
  }));
  const result = evaluateArs001Readiness(log);
  assert.equal(result.ready, true);
  assert.equal(result.taskStatus, "ready_for_human_completion_review");
  assert.deepEqual(result.pending, { decisions: [], interview: [] });
});
