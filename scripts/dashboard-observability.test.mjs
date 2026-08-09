import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { appendAgentEvent, collectDashboardSnapshot, createPromptPreview, defaultEventPath, reduceInvocations, runCollector, validateAgentEvent } from "./dashboard-observability.mjs";
import { createDashboardServer } from "./dashboard-server.mjs";

const report = `# 2D-FPS-game Project Status Report
- **Phase:** Phase 8 - Environment Audio Polish (complete)
| Key | Value |
| --- | --- |
| Active milestone | Phase 8 - Environment Audio Polish |
| Development status | Phase 8 T0-T8 are complete: QA is ready. |
| Verification | pass |
## Completed Work
### Phase 7 - Tactical Combat Depth
## Immediate Next Tasks
| Priority | ID | Task | Owner | Estimate |
| --- | --- | --- | --- | --- |
| 1 | Phase 9 | Select the next product slice. | vision / product | decision |
## Blocking Issues
None.
`;
const temporaryRoot = () => { const root = mkdtempSync(path.join(tmpdir(), "dashboard-v4-")); const reportPath = path.join(root, "work", "2D-FPS-game", "docs", "reports"); mkdirSync(reportPath, { recursive: true }); mkdirSync(path.join(root, "dashboard"), { recursive: true }); writeFileSync(path.join(reportPath, "project-status.md"), report); writeFileSync(path.join(root, "dashboard", "index.html"), "<!doctype html><title>Control Plane</title>"); return root; };

test("v4 derives report-backed phase, progress, roadmap decision, and kanban cards", () => { const root = temporaryRoot(); const snapshot = collectDashboardSnapshot({ root, now: new Date("2026-08-04T12:00:00Z"), runCollectors: false }); assert.equal(snapshot.schemaVersion, "4.0.0"); assert.equal(snapshot.project.phase.title, "Phase 8 - Environment Audio Polish"); assert.equal(snapshot.project.progress.percentage, 100); assert.equal(snapshot.kanban.columns.decision[0].taskId, "Phase 9"); assert.equal(snapshot.roadmap.phases.at(-1).state, "decision"); assert.equal(snapshot.roadmap.sprintStatus, "none"); assert.equal(snapshot.metrics.project.blocked.value, 0); assert.equal(snapshot.metrics.events.producer.status, "unavailable"); rmSync(root, { recursive: true, force: true }); });
test("v4 combines durable WBS tasks and execution quality without runtime demotion", () => {
  const root = temporaryRoot(), now = new Date("2026-08-04T12:00:00Z"), eventPath = defaultEventPath(root);
  const planning = path.join(root, "work", "2D-FPS-game", "docs", "planning"), handoffs = path.join(root, "docs", "handoffs");
  mkdirSync(planning, { recursive: true }); mkdirSync(handoffs, { recursive: true });
  writeFileSync(path.join(planning, "phase8-tasks.json"), JSON.stringify({ created: "2026-08-04", acceptanceMap: { A1: "Contract ready.", A2: "Verified." }, tasks: [{ id: "T0", subject: "Plan", assignee: "ultron", status: "completed", depends: [], acceptance: ["A1"], files: ["plan.md"] }, { id: "T1", subject: "Verify", assignee: "ultron/qa", status: "completed", depends: ["T0"], acceptance: ["A2"], files: ["report.md"] }] }));
  writeFileSync(path.join(handoffs, "current-execution-report.md"), ["# Execution", "", "56-file/331-test unit suite", "", "## Verification", "", "| Gate | Result | Notes |", "| --- | --- | --- |", "| npm run build | pass | Largest emitted chunk observed: app at 260.49 kB, gzip 71.63 kB. |", "| npx playwright test | pass | 30 / 30 Playwright E2E passed. |", "| node scripts/check-mainscene-loc.mjs | pass | MainScene.ts line count 835/850. |"].join("\n"));
  appendAgentEvent({ agentId: "ultron", timestamp: "2026-08-04T11:59:00Z", state: "active", eventType: "task", taskId: "T1", message: "Stale runtime replay" }, { eventPath, now });
  const snapshot = collectDashboardSnapshot({ root, eventPath, now, runCollectors: false });
  assert.deepEqual(snapshot.project.progress, { status: "known", done: 2, total: 2, percentage: 100, source: snapshot.project.sources.tasks });
  assert.equal(snapshot.kanban.columns.complete.find((task) => task.taskId === "T1").title, "Verify");
  assert.equal(snapshot.project.quality.unit.value.tests, 331);
  assert.deepEqual(snapshot.project.quality.e2e.value, { passed: 30, total: 30 });
  assert.deepEqual(snapshot.project.quality.loc.value, { value: 835, limit: 850 });
  rmSync(root, { recursive: true, force: true });
});
test("missing optional harness collector is unavailable without degrading required collectors", () => { const root = temporaryRoot(), now = new Date("2026-08-04T12:00:00Z"), collectorRunner = (collectorRoot, script, optional) => optional ? runCollector(collectorRoot, script, true) : { ok: true, status: "available", source: script, observedAt: now.toISOString(), value: { status: "pass" } }; const snapshot = collectDashboardSnapshot({ root, now, collectorRunner }); assert.equal(snapshot.collectors.workspace.status, "available"); assert.equal(snapshot.collectors.project.status, "available"); assert.equal(snapshot.collectors.harness.status, "unavailable"); assert.equal(snapshot.collectors.harness.ok, false); assert.equal(snapshot.collectors.hermes.status, "available"); rmSync(root, { recursive: true, force: true }); });
test("topology edges and trace use only directed communication events", () => { const root = temporaryRoot(), eventPath = defaultEventPath(root), now = new Date("2026-08-04T12:00:00Z"); appendAgentEvent({ agentId: "ultron", timestamp: "2026-08-04T11:59:00Z", state: "active", eventType: "delegation", taskId: "dashboard-v2", message: "Request review", communication: { toAgentId: "reviewer", kind: "delegation", summary: "Request independent review", correlationId: "v2" } }, { eventPath, now }); const snapshot = collectDashboardSnapshot({ root, eventPath, now, runCollectors: false }); assert.equal(snapshot.topology.edges.length, 1); assert.equal(snapshot.communications[0].toAgentId, "reviewer"); assert.equal(snapshot.metrics.agents.active, 1); assert.equal(snapshot.topology.edges[0].state, "historical"); assert.equal(snapshot.topology.edges[0].sourceEventIds.length, 1); rmSync(root, { recursive: true, force: true }); });
test("stale task evidence is never reported as active work", () => { const root = temporaryRoot(), eventPath = defaultEventPath(root), now = new Date("2026-08-04T12:00:00Z"); appendAgentEvent({ agentId: "ultron", timestamp: "2026-08-04T11:40:00Z", state: "active", eventType: "task", taskId: "old-task", message: "Old work" }, { eventPath, now }); const snapshot = collectDashboardSnapshot({ root, eventPath, now, runCollectors: false }); assert.equal(snapshot.metrics.tasks.active, 0); assert.equal(snapshot.metrics.tasks.stale, 1); rmSync(root, { recursive: true, force: true }); });
test("server rejects invalid trace, exposes v4, and reuses static collectors", async () => { const root = temporaryRoot(); let collectorCalls = 0; const collectorRunner = (_root, script) => { collectorCalls += 1; return { ok: true, status: "available", source: script, observedAt: "2026-08-04T12:00:00.000Z", value: {} }; }; const server = createDashboardServer({ root, snapshotOptions: { collectorRunner } }); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); const origin = "http://127.0.0.1:" + server.address().port; const invalid = await fetch(origin + "/api/observability/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: "ultron", timestamp: "2026-08-04T12:00:00Z", state: "active", eventType: "message", communication: { toAgentId: "reviewer", kind: "message" } }) }); assert.equal(invalid.status, 400); const accepted = await fetch(origin + "/api/observability/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: "ultron", timestamp: "2026-08-04T12:00:00Z", state: "active", eventType: "handoff", communication: { toAgentId: "reviewer", kind: "handoff", summary: "Review dashboard v4" } }) }); assert.equal(accepted.status, 201); const snapshot = await (await fetch(origin + "/api/observability/snapshot")).json(); const repeated = await (await fetch(origin + "/api/observability/snapshot")).json(); assert.equal(snapshot.schemaVersion, "4.0.0"); assert.equal(repeated.schemaVersion, "4.0.0"); assert.equal(snapshot.topology.edges.length, 1); assert.equal(collectorCalls, 4); await new Promise((resolve) => server.close(resolve)); rmSync(root, { recursive: true, force: true }); });
test("trace events bind sender, type, time, and non-sensitive text", () => { const now = new Date("2026-08-04T12:00:00Z"); const base = { agentId: "ultron", timestamp: "2026-08-04T12:00:00Z", state: "active", eventType: "delegation", communication: { toAgentId: "reviewer", kind: "delegation", summary: "Request review" } }; assert.throws(() => validateAgentEvent({ ...base, communication: { ...base.communication, fromAgentId: "vision" } }, now), /fromAgentId must match/); assert.throws(() => validateAgentEvent({ ...base, eventType: "heartbeat", communication: { ...base.communication, kind: "heartbeat" } }, now), /matching handoff/); assert.throws(() => validateAgentEvent({ ...base, timestamp: "2026-08-04T12:02:00Z" }, now), /60 seconds in the future/); assert.throws(() => validateAgentEvent({ ...base, communication: { ...base.communication, summary: "token=super-secret-value" } }, now), /non-sensitive summary/); assert.throws(() => validateAgentEvent({ ...base, id: "api_key=secret" }, now), /safe UUID/); });
test("prompt preview redacts before truncation and never accepts raw credentials", () => {
  const safe = createPromptPreview("대시보드 호출을 보여줘 " + "가".repeat(200));
  assert.equal(safe.originalLength, 213);
  assert.equal(safe.capturedLength, 160);
  assert.equal(safe.truncated, true);
  const redacted = createPromptPreview("use api_key=super-secret-value and Bearer abcdefghijklmnop");
  assert.equal(redacted.redactionStatus, "redacted");
  assert.doesNotMatch(redacted.preview, /super-secret|abcdefghijklmnop/);
  const expanded = createPromptPreview("API key: ordinary-secret-value\nsecret key: spaced-secret-value\naccess key: spaced-access-value\nOPENAI_API_KEY=oa-secret\nAWS_SECRET_ACCESS_KEY='aws secret value'\nAuthorization: Basic dXNlcjpwYXNz");
  ["ordinary-secret-value", "spaced-secret-value", "spaced-access-value", "oa-secret", "aws secret value", "dXNlcjpwYXNz"].forEach((secret) => assert.equal(expanded.preview.includes(secret), false));
  assert.equal(expanded.redactionStatus, "redacted");
  const suppressed = createPromptPreview("-----BEGIN PRIVATE KEY-----\nsecret");
  assert.equal(suppressed.preview, "[sensitive content omitted]");
  const event = validateAgentEvent({ agentId: "ultron", timestamp: "2026-08-04T12:00:00Z", state: "active", eventType: "prompt", prompt: redacted }, new Date("2026-08-04T12:00:00Z"));
  assert.deepEqual(event.prompt, redacted);
  const expandedEvent = validateAgentEvent({ agentId: "ultron", timestamp: "2026-08-04T12:00:00Z", state: "active", eventType: "prompt", prompt: expanded }, new Date("2026-08-04T12:00:00Z"));
  assert.deepEqual(expandedEvent.prompt, expanded);
  assert.throws(() => validateAgentEvent({ agentId: "ultron", timestamp: "2026-08-04T12:00:00Z", state: "active", eventType: "prompt", prompt: { ...redacted, preview: "token=unsafe", capturedLength: 12 } }, new Date("2026-08-04T12:00:00Z")), /non-sensitive/);
  assert.throws(() => validateAgentEvent({ agentId: "ultron", timestamp: "2026-08-04T12:00:00Z", state: "active", eventType: "prompt", prompt: { ...redacted, preview: "API key: ordinary-secret-value", capturedLength: 30 } }, new Date("2026-08-04T12:00:00Z")), /non-sensitive/);
});
test("invocation reducer builds a deterministic nested forest and excludes invalid terminal continuation", () => {
  const root = temporaryRoot(), eventPath = defaultEventPath(root), now = new Date("2026-08-04T12:00:00Z");
  ["ultron", "product-owner", "reviewer"].forEach((agentId) => appendAgentEvent({ agentId, timestamp: "2026-08-04T11:59:50Z", state: "active", eventType: "heartbeat", taskId: "invocation-tree" }, { eventPath, now }));
  const emit = (timestamp, agentId, invocation) => appendAgentEvent({ agentId, timestamp, state: invocation.stage === "failed" ? "failed" : "active", eventType: "invocation", taskId: "invocation-tree", invocation }, { eventPath, now });
  const rootCall = { invocationId: "inv-root", parentInvocationId: null, rootInvocationId: "inv-root", parentAgentId: "ultron", childAgentId: "product-owner", provenance: { provider: "runtime", reference: "test:root" } };
  emit("2026-08-04T11:59:51Z", "ultron", { ...rootCall, stage: "created", direction: "call", sequence: 1 });
  emit("2026-08-04T11:59:52Z", "ultron", { ...rootCall, stage: "called", direction: "call", sequence: 2 });
  const nested = { invocationId: "inv-child", parentInvocationId: "inv-root", rootInvocationId: "inv-root", parentAgentId: "product-owner", childAgentId: "reviewer", provenance: { provider: "runtime", reference: "test:nested" } };
  emit("2026-08-04T11:59:53Z", "product-owner", { ...nested, stage: "created", direction: "call", sequence: 1 });
  emit("2026-08-04T11:59:54Z", "product-owner", { ...nested, stage: "called", direction: "call", sequence: 2 });
  emit("2026-08-04T11:59:55Z", "reviewer", { ...nested, stage: "responded", direction: "return", sequence: 3 });
  emit("2026-08-04T11:59:56Z", "product-owner", { ...nested, stage: "called", direction: "call", sequence: 4 });
  const snapshot = collectDashboardSnapshot({ root, eventPath, now, runCollectors: false });
  assert.equal(snapshot.topology.invocations.length, 2);
  assert.equal(snapshot.topology.hierarchy.parentByAgent.reviewer, "product-owner");
  assert.equal(snapshot.topology.hierarchy.maxDepth, 2);
  assert.equal(snapshot.topology.edges.filter((edge) => edge.edgeType === "invocation").length, 3);
  assert.equal(snapshot.topology.edges.filter((edge) => edge.edgeType === "invocation").every((edge) => edge.state === "live"), true);
  assert.equal(snapshot.errors.invocations.length, 1);
  const direct = reduceInvocations(readFileSync(eventPath, "utf8").trim().split(/\r?\n/).map(JSON.parse));
  assert.equal(direct.invocations.find((item) => item.invocationId === "inv-child").stage, "responded");
  rmSync(root, { recursive: true, force: true });
});
test("documented Codex hook evidence accepts called-first and outcome-unknown stopped", () => {
  const root = temporaryRoot(), eventPath = defaultEventPath(root), now = new Date("2026-08-04T12:00:00Z");
  const invocation = { invocationId: "agent-42", parentInvocationId: null, rootInvocationId: "agent-42", parentAgentId: "codex-session-session-1", childAgentId: "codex-agent-agent-42", provenance: { provider: "runtime", reference: "codex-hook:SubagentStart" } };
  appendAgentEvent({ agentId: invocation.parentAgentId, timestamp: "2026-08-04T11:59:51Z", state: "active", eventType: "invocation", invocation: { ...invocation, stage: "called", direction: "call", sequence: 1 } }, { eventPath, now });
  appendAgentEvent({ agentId: invocation.childAgentId, timestamp: "2026-08-04T11:59:52Z", state: "idle", eventType: "invocation", invocation: { ...invocation, provenance: { provider: "runtime", reference: "codex-hook:SubagentStop" }, stage: "stopped", direction: "return", sequence: 2 } }, { eventPath, now });
  const projection = reduceInvocations(readFileSync(eventPath, "utf8").trim().split(/\r?\n/).map(JSON.parse));
  assert.equal(projection.errors.length, 0);
  assert.equal(projection.invocations[0].stage, "stopped");
  assert.deepEqual(projection.activities.map((item) => item.stage), ["called", "stopped"]);
  rmSync(root, { recursive: true, force: true });
});
test("Paperclip values require provenance, remain provider-qualified, and configured-only stays empty", () => {
  const root = temporaryRoot(), eventPath = defaultEventPath(root), now = new Date("2026-08-04T12:00:00Z");
  const organization = (entityId, parentEntityId, role) => ({ provider: "paperclip", entityId, parentEntityId, organizationId: "studio-a", team: "combat-ai", role, activity: "active", reference: "paperclip:" + entityId });
  appendAgentEvent({ agentId: "director", timestamp: "2026-08-04T11:59:50Z", state: "active", eventType: "heartbeat", providers: { paperclip: "paperclip:director" }, organization: organization("director", null, "lead") }, { eventPath, now });
  appendAgentEvent({ agentId: "worker", timestamp: "2026-08-04T11:59:51Z", state: "active", eventType: "heartbeat", providers: { paperclip: "paperclip:worker" }, organization: organization("worker", "director", "reviewer") }, { eventPath, now });
  appendAgentEvent({ agentId: "worker", timestamp: "2026-08-04T11:59:52Z", state: "active", eventType: "heartbeat" }, { eventPath, now });
  const snapshot = collectDashboardSnapshot({ root, eventPath, now, runCollectors: false, environment: { PAPERCLIP_URL: "http://loopback.invalid" } });
  assert.equal(snapshot.integrations.paperclip.observedState, "observed");
  assert.ok(snapshot.agents.some((agent) => agent.agentId === "paperclip:worker" && agent.organization.role === "reviewer"));
  assert.ok(snapshot.topology.edges.some((edge) => edge.edgeType === "organization" && edge.fromAgentId === "paperclip:director"));
  assert.equal(snapshot.errors.identities[0].agentId, "worker");
  const empty = collectDashboardSnapshot({ root: temporaryRoot(), now, runCollectors: false, environment: { PAPERCLIP_URL: "http://loopback.invalid" } });
  assert.equal(empty.integrations.paperclip.observedState, "configured-no-values");
  assert.equal(empty.agents.some((agent) => agent.provider === "paperclip"), false);
  assert.throws(() => validateAgentEvent({ agentId: "worker", timestamp: now.toISOString(), state: "active", eventType: "heartbeat", organization: organization("worker", null, "reviewer") }, now), /providers\.paperclip/);
  rmSync(root, { recursive: true, force: true });
});
test("dashboard exposes metrics, true kanban, graph nodes, and trace audit fields", () => { const html = readFileSync(new URL("../dashboard/index.html", import.meta.url), "utf8"); assert.match(html, /trace\.correlationId/); assert.match(html, /trace\.eventId/); assert.match(html, /metrics\.events\.lastFiveMinutes/); assert.match(html, /metrics\.events\.handoffsLastFiveMinutes/); assert.match(html, /id="project-progress"/); assert.match(html, /id="unit-tests"/); assert.match(html, /id="kanban-board"/); assert.match(html, /id="agent-graph"/); assert.match(html, /edge\.state===\"live\"/); assert.match(html, /edge\.eventCount/); assert.match(html, /conflictingUsageIdCount/); assert.match(html, /사용량 이벤트 미수신/); });
test("live graph requires fresh directed communication and dual heartbeats", () => { const root = temporaryRoot(), eventPath = defaultEventPath(root), now = new Date("2026-08-04T12:00:00Z"); ["ultron", "reviewer"].forEach((agentId) => appendAgentEvent({ agentId, timestamp: "2026-08-04T11:59:45Z", state: "active", eventType: "heartbeat", taskId: "dashboard-live", message: "heartbeat" }, { eventPath, now })); appendAgentEvent({ agentId: "ultron", timestamp: "2026-08-04T11:59:55Z", state: "active", eventType: "handoff", taskId: "dashboard-live", communication: { toAgentId: "reviewer", kind: "handoff", summary: "Live graph handoff" } }, { eventPath, now }); const snapshot = collectDashboardSnapshot({ root, eventPath, now, runCollectors: false }); assert.equal(snapshot.topology.edges[0].state, "live"); assert.equal(snapshot.topology.liveEdgeCount, 1); const aged = collectDashboardSnapshot({ root, eventPath, now: new Date("2026-08-04T12:00:31Z"), runCollectors: false }); assert.equal(aged.topology.edges[0].state, "historical"); rmSync(root, { recursive: true, force: true }); });
test("token deltas are exclusive, invocation-linked, de-duplicated, and never default to zero", () => {
  const root = temporaryRoot(), eventPath = defaultEventPath(root), now = new Date("2026-08-04T12:00:00Z");
  const metric = (usageId, metrics, usageSource = "runtime") => ({ agentId: "ultron", timestamp: "2026-08-04T11:59:00Z", state: "active", eventType: "metric", taskId: "dashboard-tokens", invocationId: "inv-token", invocationProvider: usageSource, metrics, usageId, usageSource, usageScope: "exclusive", metricMode: "delta" });
  appendAgentEvent(metric("runtime:run:1", { "tokens.input": 10, "tokens.output": 4, "tokens.total": 14 }), { eventPath, now });
  appendAgentEvent(metric("runtime:run:1", { "tokens.input": 10, "tokens.output": 4, "tokens.total": 14 }), { eventPath, now });
  appendAgentEvent(metric("langsmith:run:2", { "tokens.total": 7 }, "langsmith"), { eventPath, now });
  appendAgentEvent(metric("runtime:run:1", { "tokens.input": 11, "tokens.output": 4, "tokens.total": 15 }), { eventPath, now });
  const snapshot = collectDashboardSnapshot({ root, eventPath, now, runCollectors: false }), usage = snapshot.metrics.tokens;
  assert.equal(usage.status, "conflicted");
  assert.equal(usage.input.value, 10);
  assert.equal(usage.input.status, "partial");
  assert.equal(usage.total.value, 21);
  assert.equal(usage.total.status, "exact");
  assert.equal(usage.coverage.acceptedUniqueUsageDeltas, 2);
  assert.equal(usage.coverage.duplicateReplayCount, 1);
  assert.equal(usage.coverage.conflictingUsageIdCount, 1);
  assert.equal(usage.byProvider.runtime.total.value, 14);
  assert.equal(usage.byTask["dashboard-tokens"].total.value, 21);
  assert.equal(usage.byInvocation["runtime:inv-token"].total.value, 14);
  assert.equal(usage.byInvocation["langsmith:inv-token"].total.value, 7);
  appendAgentEvent({ agentId: "ultron", timestamp: "2026-08-04T11:59:01Z", state: "active", eventType: "prompt", invocationId: "inv-token", invocationProvider: "runtime", prompt: createPromptPreview("runtime prompt") }, { eventPath, now });
  appendAgentEvent({ agentId: "worker", timestamp: "2026-08-04T11:59:02Z", state: "active", eventType: "prompt", invocationId: "inv-token", invocationProvider: "paperclip", providers: { paperclip: "paperclip:invocation:prompt" }, prompt: createPromptPreview("paperclip prompt") }, { eventPath, now });
  const linked = collectDashboardSnapshot({ root, eventPath, now, runCollectors: false }).metrics.prompts.byInvocation;
  assert.equal(linked["runtime:inv-token"].preview, "runtime prompt");
  assert.equal(linked["paperclip:inv-token"].preview, "paperclip prompt");
  const empty = collectDashboardSnapshot({ root: temporaryRoot(), now, runCollectors: false });
  assert.equal(empty.metrics.tokens.total.value, null);
  assert.equal(empty.metrics.tokens.status, "unknown");
  rmSync(root, { recursive: true, force: true });
});
test("token contract rejects invalid total, unsafe values, and incomplete provenance", () => { const now = new Date("2026-08-04T12:00:00Z"), base = { agentId: "ultron", timestamp: "2026-08-04T12:00:00Z", state: "active", eventType: "metric", metrics: { "tokens.input": 2, "tokens.output": 3, "tokens.total": 5 }, usageId: "runtime:run:3", usageSource: "runtime", usageScope: "exclusive", metricMode: "delta" }; assert.throws(() => validateAgentEvent({ ...base, metrics: { ...base.metrics, "tokens.total": 6 } }, now), /must equal/); assert.throws(() => validateAgentEvent({ ...base, metrics: { ...base.metrics, "tokens.input": -1 } }, now), /non-negative/); assert.throws(() => validateAgentEvent({ ...base, usageId: undefined }, now), /requires a safe usageId/); assert.throws(() => validateAgentEvent({ ...base, usageScope: "inclusive" }, now), /exclusive scope/); assert.throws(() => validateAgentEvent({ agentId: "ultron", timestamp: now.toISOString(), state: "active", eventType: "prompt", invocationId: "inv-1", prompt: createPromptPreview("safe") }, now), /invocationProvider/); });
test("future-skew events never become live agent communication", () => { const root = temporaryRoot(), eventPath = defaultEventPath(root), now = new Date("2026-08-04T12:00:00Z"), future = "2026-08-04T12:00:30Z"; ["ultron", "reviewer"].forEach((agentId) => appendAgentEvent({ agentId, timestamp: future, state: "active", eventType: "heartbeat", taskId: "future-live" }, { eventPath, now })); appendAgentEvent({ agentId: "ultron", timestamp: future, state: "active", eventType: "message", taskId: "future-live", communication: { toAgentId: "reviewer", kind: "message", summary: "Future clock skew" } }, { eventPath, now }); const snapshot = collectDashboardSnapshot({ root, eventPath, now, runCollectors: false }); assert.equal(snapshot.topology.edges[0].state, "historical"); assert.equal(snapshot.agents.find((agent) => agent.agentId === "ultron").operationalState, "unknown"); rmSync(root, { recursive: true, force: true }); });
