import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyPrompt, createRun, pendingGate, transition } from "../lib/harness-engine.mjs";
import { CompositeStatusObserver, DashboardAgentActivityObserver, DashboardStatusObserver, JsonlHarnessStore, NullAgentActivityObserver } from "../lib/harness-store.mjs";

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

export const workspaceFingerprint = (workspace) => {
  const root = path.resolve(workspace);
  const status = spawnSync("git", ["status", "--porcelain=v1", "-uall"], { cwd: root, encoding: "utf8", timeout: 5_000 });
  const diff = spawnSync("git", ["diff", "--no-ext-diff", "--binary", "HEAD", "--", "."], { cwd: root, encoding: "utf8", timeout: 10_000, maxBuffer: 8 * 1024 * 1024 });
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8", timeout: 5_000, maxBuffer: 4 * 1024 * 1024 });
  if (status.error || diff.error || untracked.error || status.status !== 0 || diff.status !== 0 || untracked.status !== 0) throw new Error("Workspace fingerprint is unavailable; evidence gates fail closed.");
  const hash = createHash("sha256").update(status.stdout).update("\0").update(diff.stdout).update("\0");
  for (const relative of untracked.stdout.split("\0").filter(Boolean).sort()) {
    const target = path.resolve(root, relative);
    const safeRelative = path.relative(root, target);
    if (safeRelative.startsWith("..") || path.isAbsolute(safeRelative)) continue;
    try {
      const metadata = lstatSync(target);
      hash.update(relative).update("\0").update(String(metadata.size)).update("\0").update(String(metadata.mtimeMs)).update("\0");
      if (metadata.isSymbolicLink()) hash.update(readlinkSync(target));
      else if (metadata.isFile() && metadata.size <= 2 * 1024 * 1024) hash.update(readFileSync(target));
    } catch { throw new Error("An untracked workspace entry cannot be fingerprinted; evidence gates fail closed."); }
  }
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
  const activity = options.activityObserver ?? new DashboardAgentActivityObserver({ workspace, now: () => options.now ?? new Date() });
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
      if (/product.?owner/i.test(role)) {
        activity.heartbeat("ultron", state.runId);
        activity.heartbeat(role, state.runId);
        activity.communication("ultron", role, "delegation", state.runId, "Hermes product-owner design gate requested", state.correlationId);
        return hookContext(event, "Return the exact sections Goal, Scope boundaries, Acceptance criteria, Required manuals, and Verification plan, followed by Decision: approved|blocked.");
      }
      if (/reviewer/i.test(role)) {
        activity.heartbeat("ultron", state.runId);
        activity.heartbeat(role, state.runId);
        activity.communication("ultron", role, "delegation", state.runId, "Hermes independent review gate requested", state.correlationId);
        return hookContext(event, "End with an exact line: Verdict: pass, Verdict: revise, or Verdict: blocked. Review the current deterministic evidence and workspace fingerprint.");
      }
      return {};
    }
    if (event === "SubagentStop") {
      const role = String(input.agent_type ?? ""), message = String(input.last_assistant_message ?? "");
      if (/product.?owner/i.test(role)) {
        const decision = productOwnerDecision(message);
        activity.heartbeat(role, state.runId);
        if (!designEvidenceValid(message) || !decision) {
          activity.communication(role, "ultron", "message", state.runId, "Product-owner evidence rejected by Hermes contract", state.correlationId);
          return { decision: "block", reason: "Product-owner evidence requires the five sections plus a final Decision: approved|blocked line." };
        }
        if (decision === "blocked") {
          activity.communication(role, "ultron", "message", state.runId, "Product owner blocked the design", state.correlationId);
          activity.lifecycle(role, "blocked", state.runId, "Design conflict requires resolution");
          return { decision: "block", reason: "Product owner blocked the design. Resolve the stated conflict before implementation." };
        }
        apply(state, { type: "design-approved", evidenceValid: true, evidenceRef: "subagent:" + (input.agent_id ?? "product-owner") }, { gateId: "design", artifactRefs: ["product-owner"], message: "Product-owner design approved" });
        activity.communication(role, "ultron", "message", state.runId, "Product-owner design evidence approved", state.correlationId);
        activity.lifecycle(role, "complete", state.runId, "Product-owner gate complete");
        return {};
      }
      if (/reviewer/i.test(role)) {
        const verdict = reviewerVerdict(message);
        activity.heartbeat(role, state.runId);
        if (!verdict) {
          activity.communication(role, "ultron", "message", state.runId, "Reviewer evidence rejected by Hermes contract", state.correlationId);
          return { decision: "block", reason: "Reviewer output must end with Verdict: pass|revise|blocked." };
        }
        apply(state, { type: "review-recorded", verdict, fingerprint: currentFingerprint(), evidenceRef: "subagent:" + (input.agent_id ?? "reviewer") }, { gateId: "review", artifactRefs: ["reviewer"], outcome: verdict, message: "Reviewer verdict " + verdict });
        activity.communication(role, "ultron", "message", state.runId, "Reviewer verdict " + verdict, state.correlationId);
        activity.lifecycle(role, verdict === "blocked" ? "blocked" : verdict === "pass" ? "complete" : "active", state.runId, "Reviewer gate " + verdict);
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
