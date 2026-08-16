import { createHash } from "node:crypto";
import { closeSync, lstatSync, openSync, readFileSync, readlinkSync, readSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyPrompt, createRun, pendingGate, transition } from "../lib/harness-engine.mjs";
import { CompositeStatusObserver, DashboardAgentActivityObserver, DashboardStatusObserver, JsonlHarnessStore, NullAgentActivityObserver } from "../lib/harness-store.mjs";
import { deriveDashboardProjectId } from "../../../scripts/dashboard-project-id.mjs";

const DESIGN_SECTIONS = ["Goal", "Scope boundaries", "Acceptance criteria", "Required manuals", "Verification plan"];
const hookContext = (event, additionalContext, extra = {}) => ({ ...extra, hookSpecificOutput: { hookEventName: event, additionalContext } });
const denyTool = (reason) => ({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });
const continueTurn = (reason, active) => active ? { continue: false, systemMessage: reason } : { decision: "block", reason };
const text = (value) => typeof value === "string" ? value : JSON.stringify(value ?? "");
const responseSucceeded = (response) => {
  if (response && typeof response === "object") {
    if (response.isError === true) return false;
    const exitCode = response.exit_code ?? response.exitCode;
    if (Number.isInteger(exitCode)) return exitCode === 0;
  }
  return !/(?:script failed|timed out|exit code:\s*[1-9]\d*|"isError"\s*:\s*true|\b[1-9]\d*\s+(?:tests?\s+)?failed\b)/i.test(text(response));
};
const designEvidenceValid = (message) => DESIGN_SECTIONS.every((heading) => new RegExp("(?:^|\\n)#{0,3}\\s*" + heading.replace(" ", "\\s+") + "\\b", "i").test(message));
const productOwnerDecision = (message) => message.match(/(?:^|\n)\s*(?:\*\*)?Decision(?:\*\*)?\s*:\s*(approved|blocked)\s*$/i)?.[1]?.toLowerCase() ?? null;
const reviewerVerdict = (message) => message.match(/(?:^|\n)\s*(?:\*\*)?Verdict(?:\*\*)?\s*:\s*(pass|revise|blocked)\s*$/i)?.[1]?.toLowerCase() ?? null;
const commandValue = (input) => String(input.tool_input?.command ?? "");
const safeHookId = (value) => String(value ?? "unknown").replace(/[^a-z0-9._-]+/gi, "-").slice(0, 96) || "unknown";
export const dashboardProjectId = (workspace, cwd, environment) => {
  if (environment.DASHBOARD_PROJECT_ID) return deriveDashboardProjectId(environment.DASHBOARD_PROJECT_ID);
  const relative = path.relative(path.join(workspace, "workspace"), path.resolve(cwd ?? workspace));
  const projectId = relative.split(path.sep)[0];
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? deriveDashboardProjectId(projectId) : "workspace";
};
const documentedInvocationIdentity = (input) => {
  if (typeof input.agent_id !== "string" || !input.agent_id.trim() || typeof input.session_id !== "string" || !input.session_id.trim()) return null;
  const invocationId = safeHookId(input.agent_id);
  return { invocationId, parentInvocationId: null, rootInvocationId: invocationId, parentAgentId: "codex-session-" + safeHookId(input.session_id), childAgentId: "codex-agent-" + invocationId };
};
const isMutationCommand = (command) => /(?:\b(?:set-content|add-content|out-file|new-item|remove-item|move-item|copy-item)\b|\bnpm\s+(?:install|ci)\b|\bgit\s+(?:add|commit|apply|cherry-pick|rebase)\b|(?:^|[;&|]\s*)(?:rm|mv|cp|touch|mkdir)\s)/i.test(command);
const isDriftCommand = (command) => /manual-drift-check|hermes:drift/i.test(command);
const isVerificationCommand = (command) => /(?:npm\s+(?:run\s+)?(?:test|lint|build|type-check|harness:test|test:[\w:-]+)|npx\s+(?:playwright|vitest)|node\s+--test|git\s+diff\s+--check|harness-audit|hermes:audit)/i.test(command);
const commandId = (command) => {
  if (isDriftCommand(command)) return "manual-drift";
  const npm = command.match(/npm\s+run\s+([\w:-]+)/i); if (npm) return "npm:" + npm[1].toLowerCase();
  if (/playwright/i.test(command)) return "playwright";
  if (/vitest/i.test(command)) return "vitest";
  if (/node\s+--test/i.test(command)) return "node-test";
  if (/git\s+diff\s+--check/i.test(command)) return "diff-check";
  if (/harness-audit|hermes:audit/i.test(command)) return "hermes-audit";
  return "deterministic-check";
};

const FINGERPRINT_FORMAT = "hermes-workspace-fingerprint-v2";
const GIT_TIMEOUT_MS = 15_000;
const GIT_MAX_BUFFER = 16 * 1024 * 1024;
const UNTRACKED_CONTENT_LIMIT = 2 * 1024 * 1024;
const FILE_HASH_BUFFER_SIZE = 64 * 1024;
const DEFAULT_FILE_SYSTEM = { closeSync, lstatSync, openSync, readlinkSync, readSync };
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;

const runFingerprintGit = (root, args) => {
  const result = spawnSync("git", args, { cwd: root, timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER });
  if (result.error || result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    throw new Error("Workspace fingerprint Git snapshot is unavailable; evidence gates fail closed.");
  }
  return result.stdout;
};

const parsePorcelainStatus = (statusOutput) => {
  const records = statusOutput.toString("utf8").split("\0");
  const entries = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record === "") continue;
    if (record.length < 4 || record[2] !== " ") {
      throw new Error("Workspace fingerprint received malformed Git status; evidence gates fail closed.");
    }

    const code = record.slice(0, 2);
    const relative = record.slice(3);
    if (relative === "") {
      throw new Error("Workspace fingerprint received an empty Git path; evidence gates fail closed.");
    }

    let original = null;
    if (/[RC]/.test(code)) {
      original = records[index + 1];
      if (!original) {
        throw new Error("Workspace fingerprint received a malformed rename; evidence gates fail closed.");
      }
      index += 1;
    }

    entries.push(Object.freeze({ code, relative, original, untracked: code === "??" }));
  }

  return entries.sort((left, right) => compareText(
    `${left.relative}\0${left.code}\0${left.original ?? ""}`,
    `${right.relative}\0${right.code}\0${right.original ?? ""}`
  ));
};

export const resolveWorkspaceEntryPath = (workspace, relative) => {
  const root = path.resolve(workspace);
  const target = path.resolve(root, relative);
  const safeRelative = path.relative(root, target);
  if (safeRelative === "" || safeRelative === ".." || safeRelative.startsWith(`..${path.sep}`) || path.isAbsolute(safeRelative)) {
    throw new Error("Workspace fingerprint path escapes the repository; evidence gates fail closed.");
  }
  return target;
};

const metadataSnapshot = (metadata) => ({
  mode: String(metadata.mode),
  size: String(metadata.size),
  mtimeNs: String(metadata.mtimeNs),
});

const metadataMatches = (left, right) => (
  left.mode === right.mode && left.size === right.size && left.mtimeNs === right.mtimeNs
);

const readMetadata = (fileSystem, target, expectedMissing) => {
  try {
    return fileSystem.lstatSync(target, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT" && expectedMissing) return null;
    throw new Error("A workspace entry cannot be inspected; evidence gates fail closed.");
  }
};

const hashRegularFile = (hash, fileSystem, target, before) => {
  const descriptor = fileSystem.openSync(target, "r");
  const buffer = Buffer.allocUnsafe(FILE_HASH_BUFFER_SIZE);
  try {
    for (;;) {
      const bytesRead = fileSystem.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } catch {
    throw new Error("A workspace file cannot be read; evidence gates fail closed.");
  } finally {
    fileSystem.closeSync(descriptor);
  }

  const after = readMetadata(fileSystem, target, false);
  if (!metadataMatches(metadataSnapshot(before), metadataSnapshot(after))) {
    throw new Error("A workspace file changed while fingerprinting; evidence gates fail closed.");
  }
};

const hashWorkspaceEntry = (hash, root, entry, fileSystem) => {
  const target = resolveWorkspaceEntryPath(root, entry.relative);
  const expectedMissing = entry.code.includes("D");
  const metadata = readMetadata(fileSystem, target, expectedMissing);

  hash.update(entry.code).update("\0").update(entry.relative).update("\0");
  if (entry.original !== null) hash.update(entry.original).update("\0");
  if (metadata === null) {
    hash.update("missing\0");
    return;
  }

  const snapshot = metadataSnapshot(metadata);
  hash.update(snapshot.mode).update("\0").update(snapshot.size).update("\0");
  if (entry.untracked) hash.update(snapshot.mtimeNs).update("\0");

  if (metadata.isSymbolicLink()) {
    let linkTarget;
    try {
      linkTarget = fileSystem.readlinkSync(target);
    } catch {
      throw new Error("A workspace symlink cannot be read; evidence gates fail closed.");
    }
    const after = readMetadata(fileSystem, target, false);
    if (!metadataMatches(snapshot, metadataSnapshot(after))) {
      throw new Error("A workspace symlink changed while fingerprinting; evidence gates fail closed.");
    }
    hash.update("symlink\0").update(linkTarget).update("\0");
    return;
  }

  if (!metadata.isFile()) {
    throw new Error("Workspace fingerprint encountered an unsupported file type; evidence gates fail closed.");
  }

  hash.update("file\0");
  if (entry.untracked && metadata.size > BigInt(UNTRACKED_CONTENT_LIMIT)) {
    const after = readMetadata(fileSystem, target, false);
    if (!metadataMatches(snapshot, metadataSnapshot(after))) {
      throw new Error("A workspace file changed while fingerprinting; evidence gates fail closed.");
    }
    hash.update("bounded-untracked\0");
    return;
  }
  hashRegularFile(hash, fileSystem, target, metadata);
};

export const workspaceFingerprint = (workspace, options = {}) => {
  const root = path.resolve(workspace);
  const git = options.git ?? runFingerprintGit;
  const fileSystem = options.fileSystem ?? DEFAULT_FILE_SYSTEM;
  const head = git(root, ["rev-parse", "--verify", "HEAD"]);
  const status = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"]);
  const entries = parsePorcelainStatus(status);
  const hash = createHash("sha256").update(FINGERPRINT_FORMAT).update("\0").update(head).update("\0").update(status).update("\0");
  for (const entry of entries) hashWorkspaceEntry(hash, root, entry, fileSystem);
  return hash.digest("hex");
};

export const resolveWorkspace = (cwd) => {
  const candidate = path.resolve(cwd);
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: candidate, encoding: "utf8", timeout: 5_000 });
  return !result.error && result.status === 0 && result.stdout.trim() ? path.resolve(result.stdout.trim()) : candidate;
};

const reasonFor = (gate) => ({
  design: "Hermes design gate: run the product_owner and capture all five required design sections before editing.",
  implementation: "Hermes implementation gate: implement the approved slice in the main thread.",
  verification: "Hermes verification gate: run a deterministic test, build, lint, type-check, or diff-check after the latest edit.",
  review: "Hermes review gate: ask the read-only reviewer for a structured Verdict: pass|revise|blocked against the current fingerprint.",
  drift: "Hermes finalization gate: run node plugins/hermes-ssot/scripts/manual-drift-check.mjs after reviewer pass.",
}[gate] ?? "Hermes gate is incomplete.");

export const processHook = (input, options = {}) => {
  const environment = options.environment ?? process.env;
  const workspace = options.workspace ? path.resolve(options.workspace) : resolveWorkspace(input.cwd ?? process.cwd());
  const sessionId = input.session_id ?? options.sessionId ?? "manual";
  const activity = options.activityObserver ?? new DashboardAgentActivityObserver({ workspace, now: () => options.now ?? new Date(), projectId: dashboardProjectId(workspace, input.cwd, environment) });
  const observer = options.observer ?? new CompositeStatusObserver([new DashboardStatusObserver(activity)]);
  const store = new JsonlHarnessStore({ workspace, sessionId, environment });
  const event = input.hook_event_name;
  const commit = (previous, next, meta) => { const record = store.commit(previous, next, meta); observer.onStatus(record); return next; };
  const apply = (state, action, meta) => commit(state, transition(state, action, options.now ?? new Date()), { ...meta, event: action.type, operationId: input.tool_use_id ?? input.turn_id ?? state.runId });
  let state = store.load();
  let fingerprint;
  const currentFingerprint = () => {
    if (fingerprint === undefined) fingerprint = options.fingerprint ? options.fingerprint(workspace) : workspaceFingerprint(workspace);
    if (!fingerprint) throw new Error("Workspace fingerprint is empty; evidence gates fail closed.");
    return fingerprint;
  };

  try {
    if (event === "SessionStart") {
      return hookContext(event, "Hermes is an enabled, trust-reviewed guardrail. For non-trivial changes follow $delivery-runbook: product-owner design, main-thread implementation, deterministic verification, read-only reviewer, then manual drift finalization. Do not bypass normal approvals.");
    }
    if (event === "UserPromptSubmit") {
      const mode = classifyPrompt(input.prompt);
      if ((mode === "delivery" || mode === "design") && (!state || state.terminal)) {
        const fresh = createRun({ sessionId, turnId: input.turn_id, mode, now: options.now ?? new Date() });
        fresh.version = (state?.version ?? 0) + 1;
        state = commit(state, fresh, { event: "run.started", gateId: "design", message: mode + " harness run started", operationId: input.turn_id ?? fresh.runId });
      }
      activity.prompt("ultron", state?.runId ?? input.turn_id ?? sessionId, input.prompt);
      if (state && !state.terminal) {
        activity.heartbeat("ultron", state.runId, "Hermes " + state.state);
        const gateFingerprint = state.design.approved && state.mode !== "design" ? currentFingerprint() : null;
        return hookContext(event, "Active Hermes run " + state.runId + " is in " + state.state + ". Next gate: " + reasonFor(pendingGate(state, gateFingerprint)) + " Use $delivery-runbook.");
      }
      return {};
    }
    if (!state || state.terminal) return {};
    if (event === "SubagentStart") {
      const role = String(input.agent_type ?? "");
      const identity = documentedInvocationIdentity(input);
      if (identity) {
        activity.heartbeat(identity.parentAgentId, state.runId, "Codex parent session");
        activity.heartbeat(identity.childAgentId, state.runId, "Codex subagent " + role);
        activity.invocation(identity.parentAgentId, identity.childAgentId, state.runId, { ...identity, stage: "called", direction: "call", sequence: 1, reference: "codex-hook:SubagentStart" });
      }
      if (/product.?owner/i.test(role)) {
        if (identity) activity.communication(identity.parentAgentId, identity.childAgentId, "delegation", state.runId, "Hermes product-owner design gate requested", state.correlationId);
        return hookContext(event, "Return the exact sections Goal, Scope boundaries, Acceptance criteria, Required manuals, and Verification plan, followed by Decision: approved|blocked.");
      }
      if (/reviewer/i.test(role)) {
        if (identity) activity.communication(identity.parentAgentId, identity.childAgentId, "delegation", state.runId, "Hermes independent review gate requested", state.correlationId);
        return hookContext(event, "End with an exact line: Verdict: pass, Verdict: revise, or Verdict: blocked. Review the current deterministic evidence and workspace fingerprint.");
      }
      return {};
    }
    if (event === "SubagentStop") {
      const role = String(input.agent_type ?? ""), message = String(input.last_assistant_message ?? "");
      const identity = documentedInvocationIdentity(input);
      const telemetryChild = identity?.childAgentId ?? role, telemetryParent = identity?.parentAgentId ?? "ultron";
      if (identity) {
        activity.heartbeat(identity.parentAgentId, state.runId, "Codex parent session");
        activity.heartbeat(identity.childAgentId, state.runId, "Codex subagent " + role);
        activity.invocation(identity.parentAgentId, identity.childAgentId, state.runId, { ...identity, stage: "stopped", direction: "return", sequence: 2, reference: "codex-hook:SubagentStop" });
      }
      if (/product.?owner/i.test(role)) {
        const decision = productOwnerDecision(message);
        activity.heartbeat(telemetryChild, state.runId);
        if (!designEvidenceValid(message) || !decision) {
          activity.communication(telemetryChild, telemetryParent, "message", state.runId, "Product-owner evidence rejected by Hermes contract", state.correlationId);
          return { decision: "block", reason: "Product-owner evidence requires the five sections plus a final Decision: approved|blocked line." };
        }
        if (decision === "blocked") {
          activity.communication(telemetryChild, telemetryParent, "message", state.runId, "Product owner blocked the design", state.correlationId);
          activity.lifecycle(telemetryChild, "blocked", state.runId, "Design conflict requires resolution");
          return { decision: "block", reason: "Product owner blocked the design. Resolve the stated conflict before implementation." };
        }
        apply(state, { type: "design-approved", evidenceValid: true, evidenceRef: "subagent:" + (input.agent_id ?? "product-owner") }, { gateId: "design", artifactRefs: ["product-owner"], message: "Product-owner design approved" });
        activity.communication(telemetryChild, telemetryParent, "message", state.runId, "Product-owner design evidence approved", state.correlationId);
        activity.lifecycle(telemetryChild, "complete", state.runId, "Product-owner gate complete");
        return {};
      }
      if (/reviewer/i.test(role)) {
        const verdict = reviewerVerdict(message);
        activity.heartbeat(telemetryChild, state.runId);
        if (!verdict) {
          activity.communication(telemetryChild, telemetryParent, "message", state.runId, "Reviewer evidence rejected by Hermes contract", state.correlationId);
          return { decision: "block", reason: "Reviewer output must end with Verdict: pass|revise|blocked." };
        }
        apply(state, { type: "review-recorded", verdict, fingerprint: currentFingerprint(), evidenceRef: "subagent:" + (input.agent_id ?? "reviewer") }, { gateId: "review", artifactRefs: ["reviewer"], outcome: verdict, message: "Reviewer verdict " + verdict });
        activity.communication(telemetryChild, telemetryParent, "message", state.runId, "Reviewer verdict " + verdict, state.correlationId);
        activity.lifecycle(telemetryChild, verdict === "blocked" ? "blocked" : verdict === "pass" ? "complete" : "active", state.runId, "Reviewer gate " + verdict);
        return {};
      }
      return {};
    }
    if (event === "PreToolUse") {
      const editAttempt = ["apply_patch", "Edit", "Write"].includes(input.tool_name) || (input.tool_name === "Bash" && isMutationCommand(commandValue(input)));
      if (editAttempt && state.mode === "delivery" && !state.design.approved) return denyTool(reasonFor("design"));
      if (editAttempt && state.mode === "delivery") currentFingerprint();
      return {};
    }
    if (event === "PostToolUse") {
      const succeeded = responseSucceeded(input.tool_response);
      if (["apply_patch", "Edit", "Write"].includes(input.tool_name) && succeeded && state.mode === "delivery") {
        apply(state, { type: "implementation-changed", fingerprint: currentFingerprint() }, { gateId: "implementation", outcome: "changed", message: "Workspace edit observed" });
        return {};
      }
      if (input.tool_name === "Bash") {
        const command = commandValue(input);
        if (isDriftCommand(command)) {
          apply(state, { type: "drift-recorded", passed: succeeded, fingerprint: currentFingerprint() }, { gateId: "drift", commandId: commandId(command), exitCode: succeeded ? 0 : 1, outcome: succeeded ? "pass" : "fail", message: "Manual drift check " + (succeeded ? "passed" : "failed") });
        } else if (isVerificationCommand(command)) {
          apply(state, { type: "verification-recorded", passed: succeeded, fingerprint: currentFingerprint(), commandId: commandId(command) }, { gateId: "verification", commandId: commandId(command), exitCode: succeeded ? 0 : 1, outcome: succeeded ? "pass" : "fail", message: "Deterministic check " + (succeeded ? "passed" : "failed") });
        }
      }
      return {};
    }
    if (event === "Stop") {
      if (state.mode === "design" && state.design.approved) {
        apply(state, { type: "complete-design" }, { gateId: "terminal", outcome: "completed", message: "Design-only harness completed" });
        return {};
      }
      const completionFingerprint = currentFingerprint();
      const gate = pendingGate(state, completionFingerprint);
      if (gate) return continueTurn(reasonFor(gate), Boolean(input.stop_hook_active));
      apply(state, { type: "complete", fingerprint: completionFingerprint }, { gateId: "terminal", outcome: "completed", message: "Hermes delivery completed" });
      return {};
    }
    return {};
  } catch (error) {
    const reason = "Hermes " + event + " gate failed: " + error.message;
    if (event === "PreToolUse") return denyTool(reason);
    if (event === "SubagentStop") return { decision: "block", reason };
    if (event === "Stop") return continueTurn(reason, Boolean(input.stop_hook_active));
    return { systemMessage: reason };
  }
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const input = JSON.parse(readFileSync(0, "utf8") || "{}");
    process.stdout.write(JSON.stringify(processHook(input)) + "\n");
  } catch (error) {
    process.stdout.write(JSON.stringify({ systemMessage: "Hermes hook error: " + error.message }) + "\n");
    process.exitCode = 1;
  }
}
