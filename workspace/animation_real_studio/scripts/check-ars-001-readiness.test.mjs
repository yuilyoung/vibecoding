import assert from "node:assert/strict";
import test from "node:test";
import { evaluateArs001Readiness, loadDecisionLog } from "./check-ars-001-readiness.mjs";

test("ARS-001 reports the initial decision and interview gates as pending external evidence", () => {
  const log = loadDecisionLog();
  const result = evaluateArs001Readiness(log);
  assert.equal(result.taskId, "ARS-001");
  assert.equal(result.ready, false);
  assert.equal(result.taskStatus, "pending_external_evidence");
  const retryPolicy = log.decisions.find((decision) => decision.id === "D-002").retryPolicy;
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

test("D-001 separates MiniMax H3 open-weight territory licensing from hosted API availability without selecting a provider", () => {
  const d001 = loadDecisionLog().decisions.find((decision) => decision.id === "D-001");
  assert.equal(d001.providerAssessment.integrationStatus, "deferred");
  assert.equal(d001.openSourceCapabilityAssessment.status, "official_document_review_complete_provider_unselected");
  assert.equal(d001.openSourceCapabilityAssessment.decisionCard, "docs/20-open-video-provider-capability-2026-08-24.md");
  assert.equal(d001.openSourceCapabilityAssessment.hostedApiPilotPreparation.status, "offline_job_orchestration_contract_complete_runtime_disabled");
  assert.equal(d001.openSourceCapabilityAssessment.hostedApiPilotPreparation.protocolVersion, "video-job.v1");
  assert.equal(d001.openSourceCapabilityAssessment.hostedApiPilotPreparation.architecture, "docs/22-video-job-orchestration-architecture.md");
  assert.equal(d001.openSourceCapabilityAssessment.hostedApiPilotPreparation.productionBinding, false);
  assert.ok(d001.openSourceCapabilityAssessment.hostedApiPilotPreparation.externalEffects.includes("no provider network call"));
  assert.ok(d001.openSourceCapabilityAssessment.hostedApiPilotPreparation.remainingGates.includes("production database and migration"));

  const candidates = Object.fromEntries(d001.openSourceCapabilityAssessment.candidates.map((candidate) => [candidate.modelId, candidate]));
  const h3 = candidates["MiniMaxAI/MiniMax-H3"];
  assert.equal(h3.checkedAt, "2026-08-24");
  assert.equal(h3.aspectRatio, "includes 9:16");
  assert.equal(h3.integrationDisposition, "provider_integration_deferred");
  assert.equal(h3.openWeightDisposition, "blocked_without_formal_license_in_south_korea");
  assert.match(h3.openWeightTerritoryEligibility, /south_korea/);
  assert.equal(h3.hostedApiAvailability, "globally_available_per_official_minimax_license_qa");
  assert.equal(h3.hostedApiModelId, "MiniMax-H3");
  assert.match(h3.hostedApiContract, /POST \/v2\/video_generation/);
  assert.match(h3.hostedApiContract, /GET \/v2\/query\/video_generation/);
  assert.match(h3.hostedApiContract, /DELETE \/v2\/video_generation/);
  assert.equal(h3.hostedApiDisposition, "documented_globally_available_but_product_integration_deferred");
  assert.ok(h3.officialSources.includes("https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE"));
  assert.ok(h3.officialSources.includes("https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/docs/QA-about-License.md"));
  assert.ok(h3.officialSources.includes("https://platform.minimax.io/docs/api-reference/video-generation-v2-create"));

  const wan = candidates["Wan-AI/Wan2.2-TI2V-5B"];
  assert.equal(wan.checkedAt, "2026-08-24");
  assert.equal(wan.license, "Apache-2.0");
  assert.equal(wan.resolution, "720p");
  assert.match(wan.aspectRatio, /704x1280/);
  assert.match(wan.hardwareFloor, /24GB VRAM/);
  assert.equal(wan.integrationDisposition, "benchmark_candidate");
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
