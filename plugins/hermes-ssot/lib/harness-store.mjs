import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createBoundedPromptPreview, redactSensitiveText } from "./safe-preview.mjs";
import { DASHBOARD_PROJECT_ID_PATTERN, deriveDashboardProjectId } from "../../../scripts/dashboard-project-id.mjs";

const safeId = (value) => String(value ?? "unknown").replace(/[^a-z0-9._-]+/gi, "-").slice(0, 96) || "unknown";
const redact = redactSensitiveText;
const runtimeRoot = (workspace, environment) => environment.HERMES_STATE_DIR || environment.PLUGIN_DATA || path.join(workspace, ".codex", "runtime", "hermes");

export class JsonlHarnessStore {
  constructor({ workspace, sessionId, environment = process.env }) {
    this.workspace = path.resolve(workspace);
    this.sessionId = safeId(sessionId);
    this.root = path.join(runtimeRoot(this.workspace, environment), this.sessionId);
    this.statusPath = path.join(this.root, "status.json");
    this.eventsPath = path.join(this.root, "events.jsonl");
    this.lockPath = path.join(this.root, ".lock");
    const configuredStaleMs = Number(environment.HERMES_LOCK_STALE_MS ?? 120_000);
    this.lockStaleMs = Number.isFinite(configuredStaleMs) && configuredStaleMs > 0 ? configuredStaleMs : 120_000;
  }

  withLock(operation) {
    mkdirSync(this.root, { recursive: true });
    let handle;
    try {
      handle = openSync(this.lockPath, "wx");
    } catch {
      const stale = existsSync(this.lockPath) && Date.now() - statSync(this.lockPath).mtimeMs > this.lockStaleMs;
      if (!stale) throw new Error("Another Hermes transition is active for this session.");
      unlinkSync(this.lockPath);
      try { handle = openSync(this.lockPath, "wx"); } catch { throw new Error("Another Hermes transition is active for this session."); }
    }
    try {
      writeFileSync(handle, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }), "utf8");
      return operation();
    } finally {
      if (handle !== undefined) closeSync(handle);
      if (existsSync(this.lockPath)) unlinkSync(this.lockPath);
    }
  }

  load() {
    if (existsSync(this.statusPath)) {
      try { return JSON.parse(readFileSync(this.statusPath, "utf8")); } catch { /* replay below */ }
    }
    if (!existsSync(this.eventsPath)) return null;
    const events = readFileSync(this.eventsPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    let expected = 1;
    for (const event of events) {
      if (event.sequence !== expected++) throw new Error("Hermes event journal sequence is corrupted.");
    }
    return events.at(-1)?.snapshot ?? null;
  }

  commit(previous, next, meta = {}) {
    return this.withLock(() => {
      const current = this.load();
      const expectedVersion = previous?.version ?? 0;
      if ((current?.version ?? 0) !== expectedVersion) throw new Error("Hermes state changed concurrently.");
      const event = {
        schema_version: "1.0.0",
        sequence: next.version,
        timestamp: next.updatedAt,
        severity: meta.severity ?? "info",
        event: meta.event ?? "state.transition",
        run_id: next.runId,
        operation_id: safeId(meta.operationId ?? next.runId),
        correlation_id: next.correlationId,
        task_id: meta.taskId ? safeId(meta.taskId) : null,
        previous_state: previous?.state ?? null,
        state: next.state,
        gate_id: meta.gateId ?? null,
        attempt: meta.attempt ?? 1,
        progress: next.progress,
        duration_ms: Number.isFinite(meta.durationMs) ? meta.durationMs : null,
        command_id: meta.commandId ?? null,
        exit_code: Number.isInteger(meta.exitCode) ? meta.exitCode : null,
        outcome: meta.outcome ?? "recorded",
        error_code: meta.errorCode ?? null,
        message: redact(meta.message ?? meta.event ?? "state transition").slice(0, 500),
        artifact_refs: Array.isArray(meta.artifactRefs) ? meta.artifactRefs.map((item) => safeId(item)) : [],
        source: meta.source ?? "hermes-ssot",
        snapshot: next,
      };
      appendFileSync(this.eventsPath, JSON.stringify(event) + "\n", "utf8");
      const temporary = this.statusPath + "." + process.pid + ".tmp";
      writeFileSync(temporary, JSON.stringify(next, null, 2) + "\n", "utf8");
      renameSync(temporary, this.statusPath);
      return event;
    });
  }
}

export class NullStatusObserver {
  onStatus() {}
}

export class ConsoleStatusObserver {
  constructor(write = (value) => process.stderr.write(value + "\n")) { this.write = write; }
  onStatus(event) { this.write(JSON.stringify({ event: event.event, state: event.state, progress: event.progress, run_id: event.run_id })); }
}

export class CompositeStatusObserver {
  constructor(observers = []) { this.observers = observers; }
  onStatus(event) {
    for (const observer of this.observers) {
      try { observer.onStatus(event); } catch { /* optional observers are isolated */ }
    }
  }
}

const agentId = (value) => safeId(value).slice(0, 64);
const eventText = (value) => redact(value).slice(0, 280);
const promptPreview = createBoundedPromptPreview;
const authoritativeProjectId = (value) => DASHBOARD_PROJECT_ID_PATTERN.test(String(value ?? "")) ? String(value) : deriveDashboardProjectId(value);

export class NullAgentActivityObserver {
  heartbeat() {}
  lifecycle() {}
  communication() {}
  prompt() {}
  invocation() {}
  cycle() {}
}

export class DashboardAgentActivityObserver {
  constructor({ workspace, now = () => new Date(), projectId = "workspace" }) {
    this.workspace = path.resolve(workspace);
    this.eventPath = path.join(this.workspace, "dashboard", "runtime", "agent-events.jsonl");
    this.enabled = existsSync(path.join(this.workspace, "dashboard"));
    this.now = typeof now === "function" ? now : () => now;
    this.projectId = authoritativeProjectId(projectId);
  }

  context(taskId, details = {}) {
    return { projectId: authoritativeProjectId(details.projectId ?? this.projectId), cycleId: safeId(details.cycleId ?? taskId).slice(0, 128) };
  }

  append(event) {
    if (!this.enabled) return;
    try {
      mkdirSync(path.dirname(this.eventPath), { recursive: true });
      const timestamp = this.now().toISOString();
      appendFileSync(this.eventPath, JSON.stringify({ id: randomUUID(), timestamp, ingestedAt: timestamp, ...event }) + "\n", "utf8");
    } catch { /* dashboard telemetry is optional and must not break delivery */ }
  }

  heartbeat(subject, taskId, message = "Hermes gate activity") {
    this.append({ agentId: agentId(subject), state: "active", eventType: "heartbeat", taskId: safeId(taskId).slice(0, 128), ...this.context(taskId), message: eventText(message) });
  }

  lifecycle(subject, state, taskId, message) {
    this.append({ agentId: agentId(subject), state, eventType: "lifecycle", taskId: safeId(taskId).slice(0, 128), ...this.context(taskId), message: eventText(message) });
  }

  communication(from, to, kind, taskId, summary, correlationId) {
    const fromAgentId = agentId(from), toAgentId = agentId(to);
    this.append({ agentId: fromAgentId, state: "active", eventType: kind, taskId: safeId(taskId).slice(0, 128), ...this.context(taskId), communication: { fromAgentId, toAgentId, kind, summary: eventText(summary), correlationId: safeId(correlationId).slice(0, 128) } });
  }

  prompt(subject, taskId, value, details = {}) {
    this.append({ agentId: agentId(subject), state: "active", eventType: "prompt", taskId: safeId(taskId).slice(0, 128), ...this.context(taskId, details), ...(details.invocationId ? { invocationId: safeId(details.invocationId).slice(0, 128), invocationProvider: details.invocationProvider ?? "runtime" } : {}), prompt: promptPreview(value) });
  }

  invocation(parent, child, taskId, details) {
    const parentAgentId = agentId(parent), childAgentId = agentId(child), direction = details.direction;
    this.append({
      agentId: direction === "call" ? parentAgentId : childAgentId,
      state: details.stage === "failed" ? "failed" : details.stage === "stopped" ? "idle" : "active",
      eventType: "invocation",
      taskId: safeId(taskId).slice(0, 128),
      ...this.context(taskId, details),
      invocation: {
        invocationId: safeId(details.invocationId).slice(0, 128),
        parentInvocationId: details.parentInvocationId ? safeId(details.parentInvocationId).slice(0, 128) : null,
        rootInvocationId: safeId(details.rootInvocationId ?? details.invocationId).slice(0, 128),
        parentAgentId,
        childAgentId,
        stage: details.stage,
        direction,
        sequence: details.sequence,
        provenance: { provider: "runtime", reference: eventText(details.reference ?? "hermes:subagent") },
      },
    });
  }

  cycle(subject, taskId, details) {
    const context = this.context(taskId, details);
    const cycleState = details.state;
    const state = cycleState === "complete" ? "complete" : cycleState === "blocked" ? "blocked" : cycleState === "failed" ? "failed" : cycleState === "stopped" ? "idle" : "active";
    this.append({
      agentId: agentId(subject),
      state,
      eventType: "cycle",
      taskId: safeId(taskId).slice(0, 128),
      ...context,
      cycle: {
        cycleId: context.cycleId,
        stepId: safeId(details.stepId).slice(0, 128),
        predecessorStepId: details.predecessorStepId ? safeId(details.predecessorStepId).slice(0, 128) : null,
        stage: details.stage,
        sequence: details.sequence,
        state: cycleState,
        ...(details.summary ? { summary: eventText(details.summary) } : {}),
      },
    });
  }
}

export class DashboardStatusObserver {
  constructor(activity) { this.activity = activity; }
  onStatus(event) {
    const state = event.state === "completed" ? "complete" : ["blocked", "failed"].includes(event.state) ? event.state : "active";
    const step = (suffix = 0) => "step-" + (event.sequence * 10 + suffix);
    if (event.event === "run.started") {
      this.activity.cycle("ultron", event.run_id, { stepId: step(0), predecessorStepId: null, stage: "analysis", sequence: event.sequence * 10, state: "complete", summary: "User request classified for delivery." });
      this.activity.cycle("ultron", event.run_id, { stepId: step(1), predecessorStepId: step(0), stage: "design", sequence: event.sequence * 10 + 1, state: "active", summary: "Product design gate is active." });
    } else {
      const predecessorStepId = event.sequence === 2 ? "step-11" : "step-" + ((event.sequence - 1) * 10);
      if (event.event === "design-approved") this.activity.cycle("product-owner", event.run_id, { stepId: step(), predecessorStepId, stage: "design_verification", sequence: event.sequence * 10, state: "complete", summary: "Product-owner design evidence approved." });
      else if (event.event === "implementation-changed") this.activity.cycle("ultron", event.run_id, { stepId: step(), predecessorStepId, stage: event.previous_state === "revision-required" ? "revision" : "implementation", sequence: event.sequence * 10, state: "active", summary: event.previous_state === "revision-required" ? "Revision work observed." : "Implementation change observed." });
      else if (event.event === "verification-recorded") this.activity.cycle("ultron", event.run_id, { stepId: step(), predecessorStepId, stage: "implementation_verification", sequence: event.sequence * 10, state: event.outcome === "pass" ? "complete" : "blocked", summary: "Deterministic verification " + event.outcome + "." });
      else if (event.event === "review-recorded") this.activity.cycle("reviewer", event.run_id, { stepId: step(), predecessorStepId, stage: "feedback", sequence: event.sequence * 10, state: event.outcome === "pass" ? "complete" : event.outcome === "blocked" ? "blocked" : "waiting", summary: "Independent reviewer verdict " + event.outcome + "." });
    }
    this.activity.lifecycle("ultron", state, event.run_id, "Hermes " + event.state + " · " + event.gate_id);
  }
}
