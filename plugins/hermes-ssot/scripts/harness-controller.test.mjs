import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { classifyPrompt, createRun, pendingGate, transition } from "../lib/harness-engine.mjs";
import { CompositeStatusObserver, DashboardAgentActivityObserver, DashboardStatusObserver, JsonlHarnessStore, NullAgentActivityObserver } from "../lib/harness-store.mjs";
import { dashboardProjectId, processHook } from "./harness-controller.mjs";
import { validateAgentEvent } from "../../../scripts/dashboard-observability.mjs";
import { deriveDashboardProjectId } from "../../../scripts/dashboard-project-id.mjs";

const NOW = new Date("2026-08-06T12:00:00.000Z");

const withRuntime = (run) => {
  const root = mkdtempSync(path.join(tmpdir(), "hermes-harness-"));
  try { return run(root); } finally { rmSync(root, { recursive: true, force: true }); }
};

const loadStatus = (root, session = "session-1") => JSON.parse(readFileSync(path.join(root, session, "status.json"), "utf8"));

test("classifies Korean and English prompts without routing read-only review into delivery", () => {
  assert.equal(classifyPrompt("\uad6c\ud604\ud574\uc918"), "delivery");
  assert.equal(classifyPrompt("UML architecture design"), "design");
  assert.equal(classifyPrompt("\uac80\ud1a0\ud574\uc918"), "read-only");
  assert.equal(classifyPrompt("hello"), "none");
});

test("state machine rejects edits before design and keeps terminal states immutable", () => {
  const run = createRun({ sessionId: "s", mode: "delivery", now: NOW, runId: "run-1" });
  assert.equal(pendingGate(run, "fp-1"), "design");
  assert.throws(() => transition(run, { type: "implementation-changed", fingerprint: "fp-1" }, NOW), /blocked until design approval/);
  const approved = transition(run, { type: "design-approved", evidenceValid: true }, NOW);
  const implemented = transition(approved, { type: "implementation-changed", fingerprint: "fp-1" }, NOW);
  const verified = transition(implemented, { type: "verification-recorded", fingerprint: "fp-1", commandId: "unit", passed: true }, NOW);
  const reviewed = transition(verified, { type: "review-recorded", fingerprint: "fp-1", verdict: "pass" }, NOW);
  const finalized = transition(reviewed, { type: "drift-recorded", fingerprint: "fp-1", passed: true }, NOW);
  const completed = transition(finalized, { type: "complete", fingerprint: "fp-1" }, NOW);
  assert.equal(completed.state, "completed");
  assert.throws(() => transition(completed, { type: "cancel" }, NOW), /immutable/);
});

test("hook automation enforces design, verification, review, drift, and completion in order", () => withRuntime((root) => {
  let fingerprint = "fp-1";
  const observed = [];
  const observer = new CompositeStatusObserver([
    { onStatus() { throw new Error("optional observer unavailable"); } },
    { onStatus(event) { observed.push({ event: event.event, state: event.state }); } },
  ]);
  const invoke = (hook_event_name, extra = {}) => processHook({
    cwd: process.cwd(), session_id: "session-1", turn_id: "turn-1", hook_event_name, ...extra,
  }, {
    environment: { HERMES_STATE_DIR: root },
    fingerprint: () => fingerprint,
    now: NOW,
    observer,
    activityObserver: new NullAgentActivityObserver(),
  });

  invoke("UserPromptSubmit", { prompt: "\ub300\uc2dc\ubcf4\ub4dc\ub97c \uad6c\ud604\ud574\uc918" });
  assert.equal(loadStatus(root).state, "designing");
  assert.equal(invoke("PreToolUse", { tool_name: "apply_patch", tool_input: { command: "*** Begin Patch" } }).hookSpecificOutput.permissionDecision, "deny");
  assert.equal(invoke("PreToolUse", { tool_name: "Edit", tool_input: { file_path: "example.js" } }).hookSpecificOutput.permissionDecision, "deny");
  assert.equal(invoke("PreToolUse", { tool_name: "Bash", tool_input: { command: "npm install" } }).hookSpecificOutput.permissionDecision, "deny");

  const design = [
    "# Goal", "Bound the change.",
    "## Scope boundaries", "Only the harness.",
    "## Acceptance criteria", "All gates are evidenced.",
    "## Required manuals", "reliability-gate",
    "## Verification plan", "Run deterministic tests.",
    "Decision: approved",
  ].join("\n");
  assert.deepEqual(invoke("SubagentStop", { agent_type: "product_owner", agent_id: "po-1", last_assistant_message: design }), {});
  assert.equal(loadStatus(root).state, "design-approved");

  assert.deepEqual(invoke("PreToolUse", { tool_name: "Write", tool_input: { file_path: "example.js" } }), {});
  invoke("PostToolUse", { tool_name: "Write", tool_use_id: "edit-1", tool_response: "Success" });
  assert.equal(loadStatus(root).state, "implementing");
  assert.match(invoke("Stop").reason, /verification gate/i);

  invoke("PostToolUse", { tool_name: "Bash", tool_input: { command: "npm run test:dashboard" }, tool_response: { exit_code: 0 } });
  assert.equal(loadStatus(root).verification.passed, true);
  fingerprint = "fp-2";
  assert.match(invoke("Stop").reason, /verification gate/i);
  fingerprint = "fp-1";

  assert.deepEqual(invoke("SubagentStop", {
    agent_type: "reviewer", agent_id: "review-1",
    last_assistant_message: "Findings\nNone\nEvidence\nTests passed\nRequired follow-up\nNone\nVerdict: pass",
  }), {});
  assert.equal(loadStatus(root).state, "reviewing");

  invoke("PostToolUse", { tool_name: "Bash", tool_input: { command: "node plugins/hermes-ssot/scripts/manual-drift-check.mjs" }, tool_response: { exitCode: 0 } });
  assert.equal(loadStatus(root).state, "finalizing");
  assert.deepEqual(invoke("Stop"), {});
  assert.equal(loadStatus(root).state, "completed");

  const events = readFileSync(path.join(root, "session-1", "events.jsonl"), "utf8").trim().split(/\r?\n/).map(JSON.parse);
  assert.deepEqual(events.map((event) => event.sequence), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(events.every((event) => event.run_id && event.correlation_id && event.timestamp), true);
  assert.equal(observed.length, 7);
}));

test("invalid product-owner and reviewer evidence is blocked", () => withRuntime((root) => {
  const options = { environment: { HERMES_STATE_DIR: root }, fingerprint: () => "fp", now: NOW, activityObserver: new NullAgentActivityObserver() };
  const base = { cwd: process.cwd(), session_id: "session-1", turn_id: "turn-1" };
  processHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: "implement harness" }, options);
  const productOwner = processHook({ ...base, hook_event_name: "SubagentStop", agent_type: "product_owner", last_assistant_message: "Looks fine" }, options);
  assert.equal(productOwner.decision, "block");
  assert.equal(loadStatus(root).state, "designing");
}));

test("dashboard activity observer emits validated heartbeat and communication events", () => withRuntime((root) => {
  const dashboard = path.join(root, "dashboard");
  mkdirSync(dashboard, { recursive: true });
  const observer = new DashboardAgentActivityObserver({ workspace: root, now: NOW });
  observer.heartbeat("ultron", "run-1");
  observer.heartbeat("reviewer", "run-1");
  observer.communication("ultron", "reviewer", "delegation", "run-1", "Review api_key=hidden", "correlation-1");
  observer.prompt("ultron", "run-1", "Review password=hidden " + "가".repeat(200));
  const invocation = { invocationId: "review-1", parentInvocationId: null, rootInvocationId: "review-1" };
  observer.invocation("ultron", "reviewer", "run-1", { ...invocation, stage: "created", direction: "call", sequence: 1, reference: "hermes:test" });
  observer.invocation("ultron", "reviewer", "run-1", { ...invocation, stage: "called", direction: "call", sequence: 2, reference: "hermes:test" });
  observer.invocation("ultron", "reviewer", "run-1", { ...invocation, stage: "responded", direction: "return", sequence: 3, reference: "hermes:test" });
  const rows = readFileSync(path.join(dashboard, "runtime", "agent-events.jsonl"), "utf8").trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(rows.length, 7);
  rows.forEach((row) => assert.doesNotThrow(() => validateAgentEvent(row, NOW)));
  assert.equal(rows[2].communication.summary, "Review [REDACTED]");
  assert.equal(rows[3].prompt.redactionStatus, "redacted");
  assert.ok(rows[3].prompt.capturedLength <= 160);
  assert.equal(rows[4].invocation.direction, "call");
  assert.equal(rows[6].invocation.direction, "return");
  assert.doesNotMatch(JSON.stringify(rows), /password=hidden/);
}));

test("unsafe work folder identities match portfolio discovery and validated Hermes telemetry", () => withRuntime((root) => {
  mkdirSync(path.join(root, "dashboard"), { recursive: true });
  const names=["a b","a+b","unassigned","workspace","한글도구"],ids=names.map((name)=>{
    const expected=deriveDashboardProjectId(name),actual=dashboardProjectId(root,path.join(root,"work",name),{});assert.equal(actual,expected);
    new DashboardAgentActivityObserver({workspace:root,now:NOW,projectId:actual}).heartbeat("ultron","identity-test");return actual;
  });
  const rootProjectId=dashboardProjectId(root,root,{});assert.equal(new Set(ids).size,names.length);assert.equal(rootProjectId,"workspace");assert.equal(ids.includes(rootProjectId),false);
  new DashboardAgentActivityObserver({workspace:root,now:NOW,projectId:rootProjectId}).heartbeat("ultron","root-identity-test");
  const events=readFileSync(path.join(root,"dashboard","runtime","agent-events.jsonl"),"utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(events.map((event)=>event.projectId),[...ids,rootProjectId]);assert.notEqual(events.at(-1).projectId,events[names.indexOf("workspace")].projectId);events.forEach((event)=>assert.doesNotThrow(()=>validateAgentEvent(event,NOW)));
}));

test("dashboard status observer maps delivery gates into a project-scoped vertical cycle", () => withRuntime((root) => {
  mkdirSync(path.join(root, "dashboard"), { recursive: true });
  const activity = new DashboardAgentActivityObserver({ workspace: root, now: NOW, projectId: "2D-FPS-game" }), observer = new DashboardStatusObserver(activity);
  [
    { event: "run.started", sequence: 1, state: "designing", gate_id: "design", run_id: "run-cycle" },
    { event: "design-approved", sequence: 2, state: "design-approved", gate_id: "implementation", run_id: "run-cycle" },
    { event: "implementation-changed", sequence: 3, state: "implementing", previous_state: "design-approved", gate_id: "verification", run_id: "run-cycle" },
    { event: "verification-recorded", sequence: 4, state: "verified", outcome: "pass", gate_id: "review", run_id: "run-cycle" },
    { event: "review-recorded", sequence: 5, state: "reviewing", outcome: "pass", gate_id: "drift", run_id: "run-cycle" },
  ].forEach((event) => observer.onStatus(event));
  const rows = readFileSync(path.join(root, "dashboard", "runtime", "agent-events.jsonl"), "utf8").trim().split(/\r?\n/).map(JSON.parse), cycles = rows.filter((row) => row.eventType === "cycle");
  rows.forEach((row) => assert.doesNotThrow(() => validateAgentEvent(row, NOW)));
  assert.deepEqual(cycles.map((row) => row.cycle.stage), ["analysis", "design", "design_verification", "implementation", "implementation_verification", "feedback"]);
  assert.equal(cycles.every((row) => row.projectId === "2D-FPS-game" && row.cycleId === "run-cycle"), true);
  assert.deepEqual(cycles.map((row) => row.cycle.predecessorStepId), [null, "step-10", "step-11", "step-20", "step-30", "step-40"]);
}));

test("hook emits bounded prompt and only documented subagent call-stop evidence", () => withRuntime((root) => {
  mkdirSync(path.join(root, "dashboard"), { recursive: true });
  const environment = { HERMES_STATE_DIR: path.join(root, "hermes") }, base = { cwd: root, session_id: "session-v4", turn_id: "turn-v4" };
  const options = { workspace: root, environment, fingerprint: () => "fp-v4", now: NOW };
  const submitted = "implement dashboard API key: journal-space-api\nsecret key: journal-space-secret\naccess key: journal-space-access\nOPENAI_API_KEY=never-store\nAWS_SECRET_ACCESS_KEY='aws secret value'\nAuthorization: Basic dXNlcjpwYXNz";
  processHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: submitted }, options);
  processHook({ ...base, hook_event_name: "SubagentStart", agent_type: "product_owner", agent_id: "po-v4", parent_invocation_id: "invented-parent" }, options);
  const design = "# Goal\nG\n## Scope boundaries\nS\n## Acceptance criteria\nA\n## Required manuals\nM\n## Verification plan\nV\nDecision: approved";
  processHook({ ...base, hook_event_name: "SubagentStop", agent_type: "product_owner", agent_id: "po-v4", last_assistant_message: design, agent_status: "failed", stop_reason: "cancelled", parent_invocation_id: "invented-parent" }, options);
  const target = path.join(root, "dashboard", "runtime", "agent-events.jsonl"), raw = readFileSync(target, "utf8"), rows = raw.trim().split(/\r?\n/).map(JSON.parse);
  rows.forEach((row) => assert.doesNotThrow(() => validateAgentEvent(row, NOW)));
  ["journal-space-api", "journal-space-secret", "journal-space-access", "never-store", "aws secret value", "dXNlcjpwYXNz", "invented-parent"].forEach((secret) => assert.equal(raw.includes(secret), false));
  assert.equal(rows.find((row) => row.eventType === "prompt").prompt.redactionStatus, "redacted");
  const invocations = rows.filter((row) => row.eventType === "invocation").map((row) => row.invocation);
  assert.deepEqual(invocations.map((row) => row.stage), ["called", "stopped"]);
  assert.equal(invocations[0].parentAgentId, "codex-session-session-v4");
  assert.equal(invocations[0].childAgentId, "codex-agent-po-v4");
  assert.equal(invocations[0].parentInvocationId, null);
  assert.equal(invocations[1].stage, "stopped");
}));

test("documented hook agent_id keeps repeated roles as separate invocation nodes", () => withRuntime((root) => {
  mkdirSync(path.join(root, "dashboard"), { recursive: true });
  const environment = { HERMES_STATE_DIR: path.join(root, "hermes") }, base = { cwd: root, session_id: "session-workers", turn_id: "turn-workers" };
  const options = { workspace: root, environment, fingerprint: () => "fp-workers", now: NOW };
  processHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: "implement worker telemetry" }, options);
  for (const agent_id of ["worker-1", "worker-2"]) {
    processHook({ ...base, hook_event_name: "SubagentStart", agent_type: "researcher", agent_id }, options);
    processHook({ ...base, hook_event_name: "SubagentStop", agent_type: "researcher", agent_id, last_assistant_message: "done" }, options);
  }
  const rows = readFileSync(path.join(root, "dashboard", "runtime", "agent-events.jsonl"), "utf8").trim().split(/\r?\n/).map(JSON.parse);
  const children = new Set(rows.filter((row) => row.eventType === "invocation").map((row) => row.invocation.childAgentId));
  assert.deepEqual([...children].sort(), ["codex-agent-worker-1", "codex-agent-worker-2"]);
}));

test("journal redacts secrets while preserving structured status fields", () => withRuntime((root) => {
  const store = new JsonlHarnessStore({ workspace: process.cwd(), sessionId: "secret-session", environment: { HERMES_STATE_DIR: root } });
  const run = createRun({ sessionId: "secret-session", mode: "delivery", now: NOW, runId: "run-secret" });
  run.version = 1;
  const event = store.commit(null, run, { event: "run.started", message: "api_key=do-not-log", operationId: "op-1" });
  assert.equal(event.message, "[REDACTED]");
  assert.equal(event.operation_id, "op-1");
  assert.equal(event.progress, 0.1);
}));

test("store recovers an abandoned stale lock without overriding a live transition", () => withRuntime((root) => {
  const store = new JsonlHarnessStore({ workspace: process.cwd(), sessionId: "stale-session", environment: { HERMES_STATE_DIR: root, HERMES_LOCK_STALE_MS: "1" } });
  mkdirSync(store.root, { recursive: true });
  writeFileSync(store.lockPath, "abandoned", "utf8");
  const old = new Date(NOW.getTime() - 60_000);
  utimesSync(store.lockPath, old, old);
  const run = createRun({ sessionId: "stale-session", mode: "delivery", now: NOW, runId: "run-stale" });
  run.version = 1;
  assert.doesNotThrow(() => store.commit(null, run, { event: "run.started" }));
  assert.equal(store.load().runId, "run-stale");
}));

test("fingerprint failures deny edits after approval and cannot become reusable evidence", () => withRuntime((root) => {
  const options = { environment: { HERMES_STATE_DIR: root }, fingerprint: () => { throw new Error("git unavailable"); }, now: NOW, activityObserver: new NullAgentActivityObserver() };
  const base = { cwd: process.cwd(), session_id: "session-1", turn_id: "turn-1" };
  processHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: "implement harness" }, options);
  const design = "# Goal\nG\n## Scope boundaries\nS\n## Acceptance criteria\nA\n## Required manuals\nM\n## Verification plan\nV\nDecision: approved";
  processHook({ ...base, hook_event_name: "SubagentStop", agent_type: "product_owner", last_assistant_message: design }, options);
  const edit = processHook({ ...base, hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "x.js" } }, options);
  assert.equal(edit.hookSpecificOutput.permissionDecision, "deny");
  assert.match(edit.hookSpecificOutput.permissionDecisionReason, /git unavailable/);
  assert.equal(loadStatus(root).state, "design-approved");
}));
