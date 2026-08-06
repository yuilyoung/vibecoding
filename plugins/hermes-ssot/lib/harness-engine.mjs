import { randomUUID } from "node:crypto";

export const HARNESS_SCHEMA_VERSION = "1.0.0";
export const TERMINAL_STATES = new Set(["completed", "blocked", "failed", "cancelled"]);
const DELIVERY_WORDS = /(?:구현|개발|고도화|리팩터|수정|추가|교체|자동화|만들|빌드|fix|implement|build|refactor|change|update|add|automate)/i;
const DESIGN_WORDS = /(?:설계|아키텍처|uml|인터페이스|스키마|architecture|design|schema|protocol)/i;
const READ_ONLY_WORDS = /(?:검토|설명|분석|상태|찾아|확인|review|explain|analy[sz]e|status|inspect)/i;

export const classifyPrompt = (prompt) => {
  const value = String(prompt ?? "");
  if (DELIVERY_WORDS.test(value)) return "delivery";
  if (DESIGN_WORDS.test(value)) return "design";
  if (READ_ONLY_WORDS.test(value)) return "read-only";
  return "none";
};

export const createRun = ({ sessionId, turnId, mode, now = new Date(), runId = randomUUID() }) => ({
  schemaVersion: HARNESS_SCHEMA_VERSION,
  version: 0,
  runId,
  sessionId,
  turnId: turnId ?? null,
  correlationId: runId,
  mode,
  state: "designing",
  terminal: false,
  startedAt: now.toISOString(),
  updatedAt: now.toISOString(),
  progress: 0.1,
  design: { approved: false, evidenceRef: null },
  implementation: { observed: false, fingerprint: null, changedAt: null },
  verification: { passed: false, fingerprint: null, checks: [] },
  review: { verdict: null, fingerprint: null, evidenceRef: null },
  finalization: { driftPassed: false, fingerprint: null },
});

const clone = (value) => structuredClone(value);
const requireState = (state, allowed, action) => {
  if (!allowed.includes(state.state)) throw new Error(action + " is not allowed from " + state.state + ".");
};
const requireMutable = (state) => {
  if (state.terminal || TERMINAL_STATES.has(state.state)) throw new Error("Terminal harness state is immutable.");
};
const resetDownstream = (next) => {
  next.verification = { passed: false, fingerprint: null, checks: [] };
  next.review = { verdict: null, fingerprint: null, evidenceRef: null };
  next.finalization = { driftPassed: false, fingerprint: null };
};
const sameFingerprint = (expected, actual, gate) => {
  if (!expected || !actual || expected !== actual) throw new Error(gate + " workspace fingerprint does not match current implementation.");
};

export const transition = (state, action, now = new Date()) => {
  requireMutable(state);
  const next = clone(state);
  const timestamp = now.toISOString();
  switch (action.type) {
    case "design-approved":
      requireState(next, ["designing", "revision-required"], action.type);
      if (!action.evidenceValid) throw new Error("Design evidence is incomplete.");
      next.design = { approved: true, evidenceRef: action.evidenceRef ?? "product-owner" };
      next.state = "design-approved";
      next.progress = Math.max(next.progress, 0.25);
      break;
    case "implementation-changed":
      if (!next.design.approved) throw new Error("Implementation is blocked until design approval.");
      requireState(next, ["design-approved", "implementing", "revision-required", "verifying", "reviewing", "finalizing"], action.type);
      if (!action.fingerprint) throw new Error("Implementation fingerprint is required.");
      next.implementation = { observed: true, fingerprint: action.fingerprint, changedAt: timestamp };
      resetDownstream(next);
      next.state = "implementing";
      next.progress = Math.max(next.progress, 0.45);
      break;
    case "verification-recorded":
      if (!next.implementation.observed) throw new Error("Verification requires implementation evidence.");
      requireState(next, ["implementing", "verifying", "revision-required"], action.type);
      sameFingerprint(next.implementation.fingerprint, action.fingerprint, "Verification");
      next.verification.checks.push({ commandId: action.commandId, passed: Boolean(action.passed), durationMs: action.durationMs ?? null, observedAt: timestamp });
      next.verification.passed = next.verification.checks.length > 0 && next.verification.checks.every((check) => check.passed);
      next.verification.fingerprint = action.fingerprint;
      next.state = action.passed ? "verifying" : "revision-required";
      next.progress = action.passed ? Math.max(next.progress, 0.65) : next.progress;
      if (!action.passed) {
        next.review = { verdict: null, fingerprint: null, evidenceRef: null };
        next.finalization = { driftPassed: false, fingerprint: null };
      }
      break;
    case "review-recorded":
      if (!next.verification.passed) throw new Error("Review requires passing deterministic verification.");
      requireState(next, ["verifying", "reviewing"], action.type);
      sameFingerprint(next.verification.fingerprint, action.fingerprint, "Review");
      if (!["pass", "revise", "blocked"].includes(action.verdict)) throw new Error("Reviewer verdict is invalid.");
      next.review = { verdict: action.verdict, fingerprint: action.fingerprint, evidenceRef: action.evidenceRef ?? "reviewer" };
      next.state = action.verdict === "pass" ? "reviewing" : action.verdict === "revise" ? "revision-required" : "blocked";
      next.terminal = action.verdict === "blocked";
      next.progress = action.verdict === "pass" ? Math.max(next.progress, 0.82) : next.progress;
      break;
    case "drift-recorded":
      if (next.review.verdict !== "pass") throw new Error("Manual drift gate requires reviewer pass.");
      requireState(next, ["reviewing", "finalizing"], action.type);
      sameFingerprint(next.review.fingerprint, action.fingerprint, "Manual drift");
      next.finalization = { driftPassed: Boolean(action.passed), fingerprint: action.fingerprint };
      next.state = action.passed ? "finalizing" : "revision-required";
      next.progress = action.passed ? Math.max(next.progress, 0.94) : next.progress;
      break;
    case "complete":
      requireState(next, ["finalizing"], action.type);
      if (!next.design.approved || !next.implementation.observed || !next.verification.passed || next.review.verdict !== "pass" || !next.finalization.driftPassed) throw new Error("Completion evidence is incomplete.");
      sameFingerprint(next.finalization.fingerprint, action.fingerprint, "Completion");
      next.state = "completed";
      next.terminal = true;
      next.progress = 1;
      break;
    case "complete-design":
      requireState(next, ["design-approved"], action.type);
      if (next.mode !== "design" || !next.design.approved) throw new Error("Design-only completion requires approved design evidence.");
      next.state = "completed";
      next.terminal = true;
      next.progress = 1;
      break;
    case "cancel":
      next.state = "cancelled";
      next.terminal = true;
      break;
    case "fail":
      next.state = "failed";
      next.terminal = true;
      break;
    default:
      throw new Error("Unsupported harness action: " + action.type);
  }
  next.version += 1;
  next.updatedAt = timestamp;
  return next;
};

export const pendingGate = (state, fingerprint) => {
  if (!state) return "design";
  if (state.terminal) return null;
  if (!state.design.approved) return "design";
  if (state.mode === "design") return null;
  if (state.state === "revision-required") return "implementation";
  if (!state.implementation.observed) return "implementation";
  if (!state.verification.passed || state.verification.fingerprint !== fingerprint) return "verification";
  if (state.review.verdict !== "pass" || state.review.fingerprint !== fingerprint) return "review";
  if (!state.finalization.driftPassed || state.finalization.fingerprint !== fingerprint) return "drift";
  return null;
};
