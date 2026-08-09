import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createBoundedPromptPreview, hasSensitiveContent } from "../plugins/hermes-ssot/lib/safe-preview.mjs";

export const SNAPSHOT_SCHEMA_VERSION = "4.0.0";
export const DEFAULT_HEARTBEAT_TTL_MS = 120_000;
export const MAX_FUTURE_SKEW_MS = 60_000;
const states = new Set(["active", "idle", "blocked", "complete", "failed"]);
const types = new Set(["heartbeat", "lifecycle", "task", "metric", "trace", "context", "handoff", "message", "delegation", "prompt", "invocation"]);
const communicationKinds = new Set(["handoff", "message", "delegation"]);
const providers = new Set(["langgraph", "langsmith", "openviking", "paperclip"]);
const usageSources = new Set(["langgraph", "langsmith", "paperclip", "runtime"]);
const invocationStages = new Set(["created", "called", "responded", "failed", "cancelled", "stopped"]);
const invocationTerminalStages = new Set(["responded", "failed", "cancelled", "stopped"]);
const promptRedactionStates = new Set(["clean", "redacted", "suppressed"]);
const tokenMetricKeys = ["tokens.input", "tokens.output", "tokens.total"];
const communicationLiveTtlMs = 15_000;
const agentLiveTtlMs = 30_000;
const agentPattern = /^[a-z0-9][a-z0-9._:-]{0,63}$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const short = (value, maximum) => typeof value === "string" && value.length <= maximum;
const safeText = (value, maximum) => short(value, maximum) && !hasSensitiveContent(value);
const safeCodePoints = (value, maximum) => typeof value === "string" && [...value].length <= maximum && !hasSensitiveContent(value);
export const createPromptPreview = createBoundedPromptPreview;
const join = (root, ...parts) => path.join(root, ...parts);
const source = (root, target, observedAt = stamp(target)) => ({ path: path.relative(root, target).replace(/\\/g, "/"), observedAt });
export const defaultEventPath = (root = process.cwd()) => join(root, "dashboard", "runtime", "agent-events.jsonl");

export const validateAgentEvent = (input, now = new Date()) => {
  if (!object(input)) throw new Error("Event body must be a JSON object.");
  const agentId = String(input.agentId ?? "").trim();
  if (!agentPattern.test(agentId)) throw new Error("agentId must contain 1-64 safe identifier characters.");
  const id = input.id === undefined ? randomUUID() : String(input.id).trim();
  if (!uuidPattern.test(id)) throw new Error("id must be a safe UUID v4.");
  const timestamp = String(input.timestamp ?? "").trim();
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error("timestamp must be a valid ISO-8601 date.");
  if (Date.parse(timestamp) > now.getTime() + MAX_FUTURE_SKEW_MS) throw new Error("timestamp may not be more than 60 seconds in the future.");
  const state = String(input.state ?? "").trim();
  if (!states.has(state)) throw new Error("state must be active, idle, blocked, complete, or failed.");
  const eventType = String(input.eventType ?? "").trim();
  if (!types.has(eventType)) throw new Error("eventType is not supported.");
  const taskId = input.taskId === undefined ? undefined : String(input.taskId).trim();
  if (taskId !== undefined && !safeText(taskId, 128)) throw new Error("taskId must be a non-sensitive string of 128 characters or fewer.");
  const message = input.message === undefined ? undefined : String(input.message).trim();
  if (message !== undefined && !safeText(message, 500)) throw new Error("message must be a non-sensitive string of 500 characters or fewer.");
  const metrics = input.metrics;
  if (metrics !== undefined && (!object(metrics) || Object.keys(metrics).length > 20 || Object.values(metrics).some((value) => typeof value !== "number" || !Number.isFinite(value)))) throw new Error("metrics must be an object with at most 20 finite numeric entries.");
  const hasTokenUsage = tokenMetricKeys.some((key) => Object.hasOwn(metrics ?? {}, key));
  const usageId = input.usageId === undefined ? undefined : String(input.usageId).trim();
  const usageSource = input.usageSource === undefined ? undefined : String(input.usageSource).trim();
  const usageScope = input.usageScope === undefined ? undefined : String(input.usageScope).trim();
  const metricMode = input.metricMode === undefined ? undefined : String(input.metricMode).trim();
  const linkedInvocationId = input.invocationId === undefined ? undefined : String(input.invocationId).trim();
  const linkedInvocationProvider = linkedInvocationId === undefined ? undefined : String(input.invocationProvider ?? (hasTokenUsage ? usageSource : "")).trim();
  if (hasTokenUsage) {
    if (eventType !== "metric") throw new Error("token usage must be recorded as a metric event.");
    if (!safeText(usageId, 240) || !usageId || !usageSources.has(usageSource) || usageScope !== "exclusive" || metricMode !== "delta") throw new Error("token usage requires a safe usageId, supported usageSource, exclusive scope, and delta mode.");
    if (tokenMetricKeys.some((key) => Object.hasOwn(metrics, key) && (!Number.isSafeInteger(metrics[key]) || metrics[key] < 0))) throw new Error("token usage values must be non-negative safe integers.");
    if (tokenMetricKeys.every((key) => Object.hasOwn(metrics, key)) && metrics["tokens.total"] !== metrics["tokens.input"] + metrics["tokens.output"]) throw new Error("tokens.total must equal tokens.input plus tokens.output when all three are present.");
  } else if (usageId !== undefined || usageSource !== undefined || usageScope !== undefined || metricMode !== undefined) throw new Error("usage metadata requires at least one token metric.");
  if (linkedInvocationId !== undefined && (!safeText(linkedInvocationId, 128) || !linkedInvocationId || !usageSources.has(linkedInvocationProvider))) throw new Error("invocationId links require a safe ID and supported invocationProvider.");
  if (linkedInvocationId === undefined && input.invocationProvider !== undefined) throw new Error("invocationProvider requires invocationId.");
  const eventProviders = input.providers;
  if (eventProviders !== undefined && (!object(eventProviders) || Object.entries(eventProviders).some(([provider, reference]) => !providers.has(provider) || !safeText(reference, 500)))) throw new Error("providers may only contain safe supported references.");
  if (hasTokenUsage && linkedInvocationId && linkedInvocationProvider !== usageSource) throw new Error("Token invocationProvider must match usageSource.");
  if (linkedInvocationProvider && linkedInvocationProvider !== "runtime" && !hasTokenUsage && !eventProviders?.[linkedInvocationProvider]) throw new Error("Non-runtime invocation links require a matching provider reference.");
  const inputPrompt = input.prompt;
  if (inputPrompt !== undefined && !object(inputPrompt)) throw new Error("prompt must be an object.");
  let prompt;
  if (inputPrompt !== undefined) {
    const preview = String(inputPrompt.preview ?? "");
    const originalLength = inputPrompt.originalLength;
    const capturedLength = inputPrompt.capturedLength;
    const lengthUnit = String(inputPrompt.lengthUnit ?? "");
    const truncated = inputPrompt.truncated;
    const redactionStatus = String(inputPrompt.redactionStatus ?? "");
    if (eventType !== "prompt") throw new Error("prompt metadata must use the prompt event type.");
    if (!safeCodePoints(preview, 160)) throw new Error("prompt preview must be non-sensitive and at most 160 Unicode code points.");
    if (![originalLength, capturedLength].every((value) => Number.isSafeInteger(value) && value >= 0) || capturedLength !== [...preview].length) throw new Error("prompt lengths must be non-negative code-point counts and capturedLength must match preview.");
    if (lengthUnit !== "unicode-code-points" || typeof truncated !== "boolean" || !promptRedactionStates.has(redactionStatus)) throw new Error("prompt metadata requires a supported length unit, truncation flag, and redaction status.");
    prompt = { preview, originalLength, capturedLength, lengthUnit, truncated, redactionStatus };
  } else if (eventType === "prompt") throw new Error("prompt events require bounded prompt metadata.");
  const inputInvocation = input.invocation;
  if (inputInvocation !== undefined && !object(inputInvocation)) throw new Error("invocation must be an object.");
  let invocation;
  if (inputInvocation !== undefined) {
    const invocationId = String(inputInvocation.invocationId ?? "").trim();
    const parentInvocationId = inputInvocation.parentInvocationId === null || inputInvocation.parentInvocationId === undefined ? null : String(inputInvocation.parentInvocationId).trim();
    const rootInvocationId = String(inputInvocation.rootInvocationId ?? invocationId).trim();
    const parentAgentId = String(inputInvocation.parentAgentId ?? "").trim();
    const childAgentId = String(inputInvocation.childAgentId ?? "").trim();
    const stage = String(inputInvocation.stage ?? "").trim();
    const direction = String(inputInvocation.direction ?? "").trim();
    const sequence = inputInvocation.sequence;
    const provenance = inputInvocation.provenance;
    if (eventType !== "invocation") throw new Error("invocation metadata must use the invocation event type.");
    if (![invocationId, rootInvocationId].every((value) => safeText(value, 128) && value) || (parentInvocationId !== null && (!safeText(parentInvocationId, 128) || !parentInvocationId))) throw new Error("invocation IDs must be safe strings of 128 characters or fewer.");
    if (![parentAgentId, childAgentId].every((value) => agentPattern.test(value)) || parentAgentId === childAgentId) throw new Error("invocation requires distinct safe parentAgentId and childAgentId.");
    if (!invocationStages.has(stage) || !["call", "return"].includes(direction)) throw new Error("invocation stage or direction is unsupported.");
    if ((invocationTerminalStages.has(stage) ? "return" : "call") !== direction) throw new Error("invocation direction does not match its stage.");
    if (agentId !== (direction === "call" ? parentAgentId : childAgentId)) throw new Error("invocation agentId must match the direction sender.");
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("invocation sequence must be a positive safe integer.");
    if (!object(provenance) || !usageSources.has(provenance.provider) || !safeText(provenance.reference, 240) || !provenance.reference) throw new Error("invocation provenance requires a runtime or provider reference.");
    invocation = { invocationId, parentInvocationId, rootInvocationId, parentAgentId, childAgentId, stage, direction, sequence, provenance: { provider: provenance.provider, reference: provenance.reference } };
  } else if (eventType === "invocation") throw new Error("invocation events require invocation metadata.");
  const inputOrganization = input.organization;
  if (inputOrganization !== undefined && !object(inputOrganization)) throw new Error("organization must be an object.");
  let organization;
  if (inputOrganization !== undefined) {
    const fields = Object.fromEntries(["entityId", "parentEntityId", "organizationId", "team", "role", "activity", "reference"].map((key) => [key, inputOrganization[key] === null || inputOrganization[key] === undefined ? null : String(inputOrganization[key]).trim()]));
    if (inputOrganization.provider !== "paperclip" || !fields.entityId || !fields.organizationId || !fields.reference || Object.values(fields).filter((value) => value !== null).some((value) => !safeText(value, 128))) throw new Error("organization requires safe Paperclip-owned identifiers and reference.");
    if (!eventProviders?.paperclip) throw new Error("Paperclip organization values require providers.paperclip provenance.");
    organization = { provider: "paperclip", ...fields };
  }
  const inputCommunication = input.communication;
  if (inputCommunication !== undefined && !object(inputCommunication)) throw new Error("communication must be an object.");
  let communication;
  if (inputCommunication !== undefined) {
    const fromAgentId = String(inputCommunication.fromAgentId ?? agentId).trim();
    const toAgentId = String(inputCommunication.toAgentId ?? "").trim();
    const kind = String(inputCommunication.kind ?? eventType).trim();
    const summary = String(inputCommunication.summary ?? message ?? "").trim();
    const correlationId = inputCommunication.correlationId === undefined ? undefined : String(inputCommunication.correlationId).trim();
    if (!agentPattern.test(fromAgentId) || !agentPattern.test(toAgentId) || fromAgentId === toAgentId) throw new Error("communication requires distinct safe fromAgentId and toAgentId.");
    if (fromAgentId !== agentId) throw new Error("communication.fromAgentId must match event agentId.");
    if (!communicationKinds.has(eventType) || !communicationKinds.has(kind) || kind !== eventType || !safeText(summary, 280) || summary.length === 0) throw new Error("communication requires a matching handoff, message, or delegation event type and non-sensitive summary.");
    if (correlationId !== undefined && (!safeText(correlationId, 128) || !correlationId)) throw new Error("correlationId must be a non-sensitive string of 128 characters or fewer.");
    communication = { fromAgentId, toAgentId, kind, summary, ...(correlationId ? { correlationId } : {}) };
  }
  return { id, agentId, timestamp: new Date(timestamp).toISOString(), state, eventType, ...(taskId ? { taskId } : {}), ...(message ? { message } : {}), ...(metrics ? { metrics } : {}), ...(hasTokenUsage ? { usageId, usageSource, usageScope, metricMode } : {}), ...(linkedInvocationId ? { invocationId: linkedInvocationId, invocationProvider: linkedInvocationProvider } : {}), ...(eventProviders ? { providers: eventProviders } : {}), ...(prompt ? { prompt } : {}), ...(invocation ? { invocation } : {}), ...(organization ? { organization } : {}), ...(communication ? { communication } : {}), ingestedAt: input.ingestedAt && Number.isFinite(Date.parse(input.ingestedAt)) ? new Date(input.ingestedAt).toISOString() : now.toISOString() };
};

export const appendAgentEvent = (input, options = {}) => { const eventPath = options.eventPath ?? defaultEventPath(options.root); const event = validateAgentEvent(input, options.now ?? new Date()); mkdirSync(path.dirname(eventPath), { recursive: true }); appendFileSync(eventPath, JSON.stringify(event) + "\n", "utf8"); return event; };
export const readAgentEvents = (eventPath, now = new Date()) => {
  if (!existsSync(eventPath)) return { events: [], errors: [] };
  const events = []; const errors = [];
  readFileSync(eventPath, "utf8").split(/\r?\n/).forEach((line, index) => { if (!line.trim()) return; try { events.push(validateAgentEvent(JSON.parse(line), now)); } catch (error) { errors.push({ line: index + 1, message: error.message }); } });
  return { events: events.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)), errors };
};

const registry = (root) => {
  const agents = new Map([["vision", { agentId: "vision", source: "AGENTS.md", configured: true }], ["ultron", { agentId: "ultron", source: "AGENTS.md", configured: true }]]);
  for (const [directory, extension] of [[join(root, ".claude", "agents"), ".md"], [join(root, ".codex", "agents"), ".toml"]]) if (existsSync(directory)) for (const name of readdirSync(directory)) if (name.endsWith(extension)) { const agentId = path.basename(name, extension); agents.set(agentId, { agentId, source: path.relative(root, join(directory, name)).replace(/\\/g, "/"), configured: true }); }
  return agents;
};
export const operationalState = (event, nowMs, ttlMs = DEFAULT_HEARTBEAT_TTL_MS) => !event ? "unknown" : Date.parse(event.timestamp) > nowMs ? "unknown" : nowMs - Date.parse(event.timestamp) > ttlMs ? "stale" : event.state === "complete" ? "idle" : event.state;
const latestBy = (items, property) => { const latest = new Map(); for (const item of items) { const key = item[property]; if (key && (!latest.has(key) || Date.parse(latest.get(key).timestamp) < Date.parse(item.timestamp))) latest.set(key, item); } return latest; };
const stamp = (target) => { try { return statSync(target).mtime.toISOString(); } catch { return null; } };
const text = (target) => existsSync(target) ? readFileSync(target, "utf8") : "";
const json = (target) => { try { return JSON.parse(text(target)); } catch { return null; } };

const tableValue = (report, key) => report.split(/\r?\n/).find((line) => line.trim().startsWith("| " + key + " |"))?.split("|").map((item) => item.trim()).filter(Boolean)[1] ?? "";
const section = (report, heading) => { const lines = report.split(/\r?\n/); const index = lines.findIndex((line) => line.trim() === "## " + heading); if (index < 0) return ""; return lines.slice(index + 1).takeWhile ? lines.slice(index + 1).takeWhile((line) => !line.startsWith("## ")).join("\n") : lines.slice(index + 1).filter((line, position, list) => !list.slice(0, position).some((prior) => prior.startsWith("## "))).join("\n"); };
const metadataValue = (report, key) => report.match(new RegExp("^-\\s+(?:\\*\\*)?" + key.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&") + "(?:\\*\\*)?:\\s*(.+)$", "im"))?.[1]?.trim() ?? "";
const plain = (value) => String(value ?? "").replace(/[\x60*_]/g, "").trim();
const tableRows = (report, heading) => {
  const lines = section(report, heading).split(/\r?\n/).filter((line) => line.trim().startsWith("|")); if (lines.length < 2) return [];
  const cells = (line) => line.split("|").slice(1, -1).map((value) => plain(value)); const headers = cells(lines[0]);
  return lines.slice(2).map(cells).filter((row) => row.length === headers.length).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
};
const phaseId = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const reportTasks = (report, reportSource) => {
  const lines = section(report, "Immediate Next Tasks").split(/\r?\n/); const start = lines.findIndex((line) => line.includes("| Priority |")); if (start < 0) return [];
  return lines.slice(start + 2).filter((line) => line.trim().startsWith("|")).map((line) => line.split("|").map((value) => value.trim()).filter(Boolean)).filter((cells) => cells.length >= 5).map((cells) => ({ taskId: cells[1], title: cells[2], owner: cells[3] || "unknown", state: "decision", updatedAt: reportSource.observedAt, source: reportSource }));
};
export const deriveProject = (root, report, projectCollector) => {
  const reportPath = join(root, "work", "2D-FPS-game", "docs", "reports", "project-status.md"); const reportSource = source(root, reportPath); const collectorValue = projectCollector?.value ?? {};
  const phase = tableValue(report, "Active milestone") || report.match(/\*\*Phase:\*\*\s*([^\r\n]+)/)?.[1]?.trim() || "unknown";
  const verification = tableValue(report, "Verification") || collectorValue.status || "unknown";
  const statusLine = tableValue(report, "Development status") || collectorValue.readiness || "";
  const range = statusLine.match(/T(\d+)\s*-\s*T(\d+)\s+(?:are|is) complete/i);
  const phaseNumber = phase.match(/Phase\s+(\d+)/i)?.[1]; const taskPath = phaseNumber ? join(root, "work", "2D-FPS-game", "docs", "planning", "phase" + phaseNumber + "-tasks.json") : ""; const taskSource = taskPath ? source(root, taskPath) : null; const taskPlan = taskPath ? json(taskPath) : null;
  const tasks = (taskPlan?.tasks ?? []).map((task) => ({ taskId: task.id, title: task.subject, owner: task.assignee || "unknown", state: /complete/i.test(task.status) ? "complete" : /active|progress/i.test(task.status) ? "active" : /block|fail/i.test(task.status) ? "blocked" : "decision", description: task.description || "", dependencies: task.depends ?? [], acceptance: (task.acceptance ?? []).map((id) => ({ id, text: taskPlan.acceptanceMap?.[id] ?? id })), files: task.files ?? [], updatedAt: taskPlan.created ? new Date(taskPlan.created + "T00:00:00Z").toISOString() : taskSource?.observedAt, source: taskSource, durable: true }));
  const completeTaskCount = tasks.filter((task) => task.state === "complete").length; const progress = tasks.length ? { status: "known", done: completeTaskCount, total: tasks.length, percentage: Math.round(completeTaskCount / tasks.length * 100), source: taskSource } : range ? { status: "known", done: Number(range[2]) - Number(range[1]) + 1, total: Number(range[2]) - Number(range[1]) + 1, percentage: 100, source: reportSource } : { status: "unknown", done: null, total: null, percentage: null, source: reportSource };
  const completePhases = [...section(report, "Completed Work").matchAll(/^###\s+(Phase\s+\d+[^\r\n]*)/gim)].map((match) => match[1].trim());
  const reportLead = report.split(/\r?\n/).slice(0, 12).join(" "), currentComplete = /(?:implemented|complete|closed|fully verified)/i.test(reportLead) ? phase : null;
  const currentPhaseState = currentComplete ? "complete" : /(?:\bactive\b|in progress|underway)/i.test(reportLead + " " + statusLine) ? "active" : "unknown";
  if (currentComplete && !completePhases.some((entry) => entry.toLowerCase() === currentComplete.toLowerCase())) completePhases.push(currentComplete);
  const milestones = completePhases.map((title) => ({ id: phaseId(title), title, state: "complete", source: reportSource }));
  const executionPath = join(root, "docs", "handoffs", "current-execution-report.md"); const executionSource = source(root, executionPath); const executionReport = text(executionPath); const gates = tableRows(executionReport, "Verification").map((row) => ({ gate: row.Gate || "unknown", status: (row.Result || "unknown").toLowerCase(), notes: row.Notes || "", source: executionSource }));
  const fullUnit = executionReport.match(/(\d+)-file\/(\d+)-test unit suite/i); const e2eCandidates = gates.map((gate) => ({ gate, match: gate.notes.match(/(\d+)\s*\/\s*(\d+).*(?:Playwright|E2E)/i) })).filter((item) => item.match).sort((left, right) => Number(right.match[2]) - Number(left.match[2])); const loc = executionReport.match(/MainScene\.ts line count\s+(\d+)\/(\d+)/i); const build = executionReport.match(/Largest emitted chunk observed:[^0-9]*([\d.]+)\s*kB,\s*gzip\s*([\d.]+)\s*kB/i);
  const metric = (value, status, metricSource) => ({ value: value ?? null, status: value === null || value === undefined ? "unknown" : status, source: metricSource });
  const quality = { unit: metric(fullUnit ? { files: Number(fullUnit[1]), tests: Number(fullUnit[2]) } : null, gates.every((gate) => gate.status === "pass") ? "pass" : "reported", executionSource), e2e: metric(e2eCandidates[0] ? { passed: Number(e2eCandidates[0].match[1]), total: Number(e2eCandidates[0].match[2]) } : null, e2eCandidates[0]?.gate.status ?? "unknown", executionSource), build: metric(build ? { chunkKb: Number(build[1]), gzipKb: Number(build[2]) } : null, gates.find((gate) => /build/i.test(gate.gate))?.status ?? "unknown", executionSource), loc: metric(loc ? { value: Number(loc[1]), limit: Number(loc[2]) } : null, gates.find((gate) => /mainscene|loc/i.test(gate.gate))?.status ?? "unknown", executionSource), gates, source: executionSource };
  const risks = tableRows(report, "Risks").map((row) => ({ risk: row.Risk || "unknown", impact: row.Impact || "unknown", status: row.Status || "unknown", source: reportSource }));
  const next = reportTasks(report, reportSource); const blockedCount = /## Blocking Issues\s*\r?\n\s*None\.?/i.test(report) ? 0 : null; const summary = section(report, "Summary").split(/\r?\n\r?\n/).map((value) => plain(value)).find(Boolean) ?? statusLine;
  return { phase: { title: phase, state: currentPhaseState, source: reportSource }, verification: { state: verification.toLowerCase(), source: reportSource }, progress, summary, status: metadataValue(report, "Status") || statusLine || "unknown", reportDate: metadataValue(report, "Date") || null, milestones, tasks, next, quality, risks, blockedCount, observedAt: reportSource.observedAt, source: reportSource, sources: { report: reportSource, tasks: taskSource, execution: executionSource } };
};

export const runCollector = (root, script, optional = false) => { const absolute = join(root, script); if (!existsSync(absolute)) return { ok: false, status: optional ? "unavailable" : "failed", source: script, observedAt: null, error: optional ? "Optional collector is not installed in this workspace." : "Collector script is missing." }; const result = spawnSync(process.execPath, [absolute], { cwd: root, encoding: "utf8", timeout: 8_000 }); if (result.error) return { ok: false, status: "failed", source: script, observedAt: new Date().toISOString(), error: result.error.message }; if (result.status !== 0) return { ok: false, status: "failed", source: script, observedAt: new Date().toISOString(), error: (result.stderr || result.stdout || "Collector failed.").trim() }; try { return { ok: true, status: "available", source: script, observedAt: new Date().toISOString(), value: JSON.parse(result.stdout) }; } catch { return { ok: false, status: "failed", source: script, observedAt: new Date().toISOString(), error: "Collector did not return JSON." }; } };
const gitMetric = (root) => { const result = spawnSync("git", ["status", "--porcelain=v1"], { cwd: root, encoding: "utf8", timeout: 5_000 }); return result.error || result.status !== 0 ? { value: null, status: "unknown", error: (result.error?.message ?? result.stderr ?? "git status failed").trim() } : { value: result.stdout.split(/\r?\n/).filter(Boolean).length, status: "known" }; };
const integration = (environment, variable, eventMapping, referenceField) => ({ mode: environment[variable] ? "configured" : "contract-ready", configurationDetected: Boolean(environment[variable]), remoteCallsEnabled: false, eventMapping, referenceField });

const createKanban = (project, events, root, nowMs, ttlMs) => {
  const taskEvents = latestBy(events.filter((event) => (event.eventType === "task" || event.eventType === "lifecycle") && Date.parse(event.timestamp) <= nowMs), "taskId"); const cards = new Map();
  const durableCards = project.tasks.length ? project.tasks : project.milestones.map((milestone) => ({ taskId: milestone.id, title: milestone.title, owner: "report", state: "complete", updatedAt: milestone.source.observedAt, source: milestone.source, durable: true })); durableCards.forEach((card) => cards.set(card.taskId, card));
  project.next.forEach((task) => cards.set(task.taskId, task));
  taskEvents.forEach((event) => { const existing = cards.get(event.taskId); if (existing?.durable && existing.state === "complete" && event.state !== "complete") return; const state = event.state === "active" && Math.max(0, nowMs - Date.parse(event.timestamp)) > ttlMs ? "stale" : event.state; cards.set(event.taskId, { ...existing, taskId: event.taskId, title: event.message || existing?.title || event.taskId, owner: event.agentId, state, updatedAt: event.timestamp, source: { path: source(root, defaultEventPath(root)).path, observedAt: event.ingestedAt }, eventId: event.id }); });
  const columns = { complete: [], active: [], stale: [], blocked: [], decision: [] };
  cards.forEach((card) => { const column = card.state === "complete" || card.state === "idle" ? "complete" : card.state === "active" ? "active" : card.state === "stale" ? "stale" : card.state === "blocked" || card.state === "failed" ? "blocked" : "decision"; columns[column].push(card); });
  Object.values(columns).forEach((cardsInColumn) => cardsInColumn.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt))));
  return { columns, observedAt: project.observedAt, source: project.source };
};
const hasTokenMetrics = (event) => tokenMetricKeys.some((key) => Object.hasOwn(event.metrics ?? {}, key));
const safeSum = (values) => { let total = 0; for (const value of values) { total += value; if (!Number.isSafeInteger(total)) return null; } return total; };
const tokenSummary = (records) => {
  const field = (key) => { const available = records.filter((record) => Number.isSafeInteger(record.metrics[key])), value = available.length ? safeSum(available.map((record) => record.metrics[key])) : null; return { value, status: !available.length ? "unknown" : value === null ? "overflow" : available.length === records.length ? "exact" : "partial", observedEventCount: available.length }; };
  const input = field("tokens.input"), output = field("tokens.output");
  const totals = records.map((record) => { if (Number.isSafeInteger(record.metrics["tokens.total"])) return { value: record.metrics["tokens.total"], derived: false }; if (Number.isSafeInteger(record.metrics["tokens.input"]) && Number.isSafeInteger(record.metrics["tokens.output"])) return { value: record.metrics["tokens.input"] + record.metrics["tokens.output"], derived: true }; return null; }).filter(Boolean), totalValue = totals.length ? safeSum(totals.map((item) => item.value)) : null;
  return { input, output, total: { value: totalValue, status: !totals.length ? "unknown" : totalValue === null ? "overflow" : totals.length !== records.length ? "partial" : totals.some((item) => item.derived) ? "derived" : "exact", observedEventCount: totals.length, derivedEventCount: totals.filter((item) => item.derived).length } };
};
const tokenUsage = (events, root, eventPath) => {
  const observed = events.filter(hasTokenMetrics), accepted = [], seen = new Map(), integrityErrors = []; let duplicateReplayCount = 0;
  observed.forEach((event) => { const fingerprint = JSON.stringify({ agentId: event.agentId, taskId: event.taskId ?? null, invocationId: event.invocationId ?? null, invocationProvider: event.invocationProvider ?? null, usageSource: event.usageSource, usageScope: event.usageScope, metricMode: event.metricMode, metrics: Object.fromEntries(tokenMetricKeys.filter((key) => Object.hasOwn(event.metrics, key)).map((key) => [key, event.metrics[key]])) }); const previous = seen.get(event.usageId); if (previous) { if (previous.fingerprint === fingerprint) { duplicateReplayCount += 1; return; } integrityErrors.push({ usageId: event.usageId, eventId: event.id, message: "Conflicting usageId payload was excluded." }); return; } seen.set(event.usageId, { fingerprint, event }); if (event.usageScope === "exclusive" && event.metricMode === "delta") accepted.push(event); });
  const dimensions = (selector) => Object.fromEntries([...new Set(accepted.map(selector))].sort().map((key) => [key, tokenSummary(accepted.filter((event) => selector(event) === key))]));
  const summary = tokenSummary(accepted);
  const invocationDimension = (event) => event.invocationId ? event.invocationProvider + ":" + event.invocationId : "unassigned";
  return { status: integrityErrors.length ? "conflicted" : accepted.length ? "known" : "unknown", ...summary, source: source(root, eventPath), providers: [...new Set(accepted.map((event) => event.usageSource))].sort(), coverage: { observedUsageEvents: observed.length, acceptedUniqueUsageDeltas: accepted.length, duplicateReplayCount, conflictingUsageIdCount: integrityErrors.length, untokenizedMetricEventCount: events.filter((event) => event.metrics && !hasTokenMetrics(event)).length }, byAgent: dimensions((event) => event.agentId), byTask: dimensions((event) => event.taskId ?? "unassigned"), byInvocation: dimensions(invocationDimension), byProvider: dimensions((event) => event.usageSource), deltas: accepted.map((event) => ({ eventId: event.id, usageId: event.usageId, usageSource: event.usageSource, agentId: event.agentId, taskId: event.taskId ?? null, invocationId: event.invocationId ?? null, invocationProvider: event.invocationProvider ?? null, invocationKey: event.invocationId ? invocationDimension(event) : null, timestamp: event.timestamp, inputTokens: event.metrics["tokens.input"] ?? null, outputTokens: event.metrics["tokens.output"] ?? null, totalTokens: event.metrics["tokens.total"] ?? (Number.isSafeInteger(event.metrics["tokens.input"]) && Number.isSafeInteger(event.metrics["tokens.output"]) ? event.metrics["tokens.input"] + event.metrics["tokens.output"] : null), totalStatus: Number.isSafeInteger(event.metrics["tokens.total"]) ? "exact" : Number.isSafeInteger(event.metrics["tokens.input"]) && Number.isSafeInteger(event.metrics["tokens.output"]) ? "derived" : "unknown" })) , integrityErrors };
};

const planProgress = (plan) => {
  const tasks = Array.isArray(plan?.tasks) ? plan.tasks : [];
  const done = tasks.filter((task) => /complete/i.test(String(task.status))).length;
  return { done, total: tasks.length, percentage: tasks.length ? Math.round(done / tasks.length * 100) : null };
};

export const deriveRoadmap = (root, project) => {
  const directory = join(root, "work", "2D-FPS-game", "docs", "planning");
  const entries = existsSync(directory) ? readdirSync(directory).flatMap((name) => {
    const match = name.match(/^phase(\d+)(?:-sprint(\d+))?-tasks\.json$/i);
    if (!match) return [];
    const target = join(directory, name), plan = json(target);
    if (!plan) return [];
    const progress = planProgress(plan);
    return [{ id: String(plan.phase ?? path.basename(name, ".json")), phaseNumber: Number(match[1]), sprintNumber: match[2] === undefined ? null : Number(match[2]), title: String(plan.name ?? (match[2] === undefined ? "Phase " + match[1] : "Sprint " + match[2])), state: /complete/i.test(String(plan.status)) || (progress.total > 0 && progress.done === progress.total) ? "complete" : /active|progress/i.test(String(plan.status)) ? "active" : "planned", progress, source: source(root, target) }];
  }) : [];
  const currentPhaseNumber = Number(project.phase.title.match(/Phase\s+(\d+)/i)?.[1] ?? 0);
  const phases = [...new Set(entries.map((entry) => entry.phaseNumber))].sort((left, right) => left - right).map((phaseNumber) => {
    const matching = entries.filter((entry) => entry.phaseNumber === phaseNumber);
    const canonical = matching.find((entry) => entry.sprintNumber === null);
    const sprints = matching.filter((entry) => entry.sprintNumber !== null).sort((left, right) => left.sprintNumber - right.sprintNumber);
    const aggregate = canonical ?? { progress: { done: sprints.reduce((sum, item) => sum + item.progress.done, 0), total: sprints.reduce((sum, item) => sum + item.progress.total, 0), percentage: null }, source: sprints.at(-1)?.source ?? project.source, title: "Phase " + phaseNumber, state: sprints.length && sprints.every((item) => item.state === "complete") ? "complete" : sprints.some((item) => item.state === "active") ? "active" : "planned" };
    if (aggregate.progress.total && aggregate.progress.percentage === null) aggregate.progress.percentage = Math.round(aggregate.progress.done / aggregate.progress.total * 100);
    const state = phaseNumber === currentPhaseNumber ? project.phase.state : aggregate.state;
    return { id: "phase-" + phaseNumber, phaseNumber, title: canonical?.title ?? aggregate.title, state, progress: aggregate.progress, sprints, source: aggregate.source };
  });
  const decision = project.next[0] ?? null;
  const decisionPhase = Number((decision?.taskId + " " + decision?.title).match(/Phase\s*(\d+)/i)?.[1] ?? 0);
  if (decisionPhase && !phases.some((phase) => phase.phaseNumber === decisionPhase)) phases.push({ id: "phase-" + decisionPhase, phaseNumber: decisionPhase, title: "Phase " + decisionPhase, state: "decision", progress: { done: 0, total: 0, percentage: null }, sprints: [], source: decision.source });
  phases.sort((left, right) => left.phaseNumber - right.phaseNumber);
  const current = phases.find((phase) => phase.phaseNumber === currentPhaseNumber) ?? null;
  const activeSprint = current?.sprints.find((sprint) => sprint.state === "active") ?? null;
  return { phases, currentPhaseNumber: currentPhaseNumber || null, activeSprint, sprintStatus: activeSprint ? "active" : "none", nextDecision: decision, observedAt: project.observedAt, source: project.source };
};

const qualifiedAgentId = (provider, value) => provider === "runtime" ? value : provider + ":" + value;
const invocationKey = (invocation) => invocation.provenance.provider + ":" + invocation.invocationId;
const invocationFingerprint = (invocation) => JSON.stringify(invocation);

export const reduceInvocations = (events) => {
  const states = new Map(), accepted = [], errors = [], duplicates = [];
  events.filter((event) => event.invocation).sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp) || left.invocation.sequence - right.invocation.sequence || left.id.localeCompare(right.id)).forEach((event) => {
    const value = event.invocation, key = invocationKey(value), current = states.get(key);
    if (current?.sequences.has(value.sequence)) {
      if (current.sequences.get(value.sequence) === invocationFingerprint(value)) duplicates.push(event.id);
      else errors.push({ eventId: event.id, invocationId: value.invocationId, message: "Conflicting invocation sequence was excluded." });
      return;
    }
    const expectedStage = !current ? "initial" : current.stage === "created" ? "called" : current.stage === "called" ? "terminal" : "closed";
    const stageValid = expectedStage === "initial" ? ["created", "called"].includes(value.stage) : expectedStage === value.stage || (expectedStage === "terminal" && invocationTerminalStages.has(value.stage));
    const sequenceValid = value.sequence === (current?.sequence ?? 0) + 1;
    const identityValid = !current || ["parentInvocationId", "rootInvocationId", "parentAgentId", "childAgentId"].every((field) => current[field] === value[field]);
    const rootValid = value.parentInvocationId === null ? value.rootInvocationId === value.invocationId : (() => {
      const parent = states.get(value.provenance.provider + ":" + value.parentInvocationId);
      return parent && !invocationTerminalStages.has(parent.stage) && parent.childAgentId === value.parentAgentId && parent.rootInvocationId === value.rootInvocationId;
    })();
    if (!stageValid || !sequenceValid || !identityValid || !rootValid) {
      errors.push({ eventId: event.id, invocationId: value.invocationId, message: !sequenceValid ? "Out-of-order invocation sequence was excluded." : !stageValid ? "Invalid invocation lifecycle transition was excluded." : !identityValid ? "Invocation identity changed during its lifecycle." : "Invocation parent or root evidence is invalid." });
      return;
    }
    const next = { ...value, key, sequence: value.sequence, stage: value.stage, latestAt: event.timestamp, createdAt: current?.createdAt ?? event.timestamp, sourceEventIds: [...(current?.sourceEventIds ?? []), event.id], events: [...(current?.events ?? []), event], sequences: new Map(current?.sequences ?? []) };
    next.sequences.set(value.sequence, invocationFingerprint(value));
    states.set(key, next);
    accepted.push({ ...value, key, timestamp: event.timestamp, eventId: event.id, taskId: event.taskId ?? null, source: event.source });
  });
  const invocations = [...states.values()].map(({ sequences, events: invocationEvents, ...value }) => ({ ...value, eventCount: invocationEvents.length }));
  return { invocations, activities: accepted, errors, duplicateEventIds: duplicates };
};

const promptUsage = (events, root, eventPath) => {
  const observed = events.filter((event) => event.prompt).map((event) => ({ ...event.prompt, agentId: event.agentId, taskId: event.taskId ?? null, invocationId: event.invocationId ?? null, invocationProvider: event.invocationProvider ?? null, invocationKey: event.invocationId ? event.invocationProvider + ":" + event.invocationId : null, timestamp: event.timestamp, eventId: event.id }));
  const linked = observed.filter((item) => item.invocationKey);
  return { status: observed.length ? "known" : "unknown", count: observed.length, latest: observed.at(-1) ?? null, byAgent: Object.fromEntries([...new Set(observed.map((item) => item.agentId))].sort().map((agentId) => [agentId, observed.filter((item) => item.agentId === agentId).at(-1)])), byInvocation: Object.fromEntries([...new Set(linked.map((item) => item.invocationKey))].sort().map((key) => [key, linked.filter((item) => item.invocationKey === key).at(-1)])), source: source(root, eventPath) };
};
export const collectDashboardSnapshot = (options = {}) => {
  const root = options.root ?? process.cwd();
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now()), nowMs = now.getTime();
  const heartbeatTtlMs = options.heartbeatTtlMs ?? DEFAULT_HEARTBEAT_TTL_MS, eventPath = options.eventPath ?? defaultEventPath(root);
  const journal = readAgentEvents(eventPath, now), collectorRunner = options.collectorRunner ?? runCollector, repositoryMetric = options.repositoryMetric ?? gitMetric;
  const collectors = options.collectors ?? (options.runCollectors === false ? {} : { workspace: collectorRunner(root, "scripts/workspace-status.mjs"), project: collectorRunner(root, "scripts/project-status.mjs"), harness: collectorRunner(root, "scripts/harness-audit.mjs", true), hermes: collectorRunner(root, "plugins/hermes-ssot/scripts/harness-audit.mjs") });
  const projectReportPath = join(root, "work", "2D-FPS-game", "docs", "reports", "project-status.md");
  const project = deriveProject(root, text(projectReportPath), collectors.project), roadmap = deriveRoadmap(root, project);
  const eventSource = source(root, eventPath), freshAt = (timestamp, ttlMs) => { const age = nowMs - Date.parse(timestamp); return age >= 0 && age <= ttlMs; };
  const agentsById = new Map(), latestAgentEvents = new Map(), organizations = new Map(), identityProviders = new Map();
  const registerIdentity = (provider, rawId) => {
    const id = qualifiedAgentId(provider, rawId), known = identityProviders.get(rawId) ?? new Set();
    known.add(provider); identityProviders.set(rawId, known);
    if (!agentsById.has(id)) agentsById.set(id, { agentId: id, displayAgentId: rawId, provider, source: "event-journal", configured: false });
    return id;
  };
  const touch = (id, event) => {
    const previous = latestAgentEvents.get(id);
    if (!previous || Date.parse(previous.timestamp) <= Date.parse(event.timestamp)) latestAgentEvents.set(id, event);
  };
  registry(root).forEach((agent, rawId) => { identityProviders.set(rawId, new Set(["runtime"])); agentsById.set(rawId, { ...agent, displayAgentId: rawId, provider: "runtime" }); });
  journal.events.forEach((event) => {
    const provider = event.invocation?.provenance.provider ?? event.organization?.provider ?? event.invocationProvider ?? (event.providers?.paperclip ? "paperclip" : "runtime");
    const sender = registerIdentity(provider, event.organization?.entityId ?? event.agentId); touch(sender, event);
    if (event.communication) [event.communication.fromAgentId, event.communication.toAgentId].forEach((rawId) => registerIdentity(provider, rawId));
    if (event.invocation) [event.invocation.parentAgentId, event.invocation.childAgentId].forEach((rawId) => registerIdentity(provider, rawId));
    if (event.organization) {
      const id = registerIdentity("paperclip", event.organization.entityId); touch(id, event);
      const previous = organizations.get(id);
      if (!previous || Date.parse(previous.timestamp) <= Date.parse(event.timestamp)) organizations.set(id, { ...event.organization, timestamp: event.timestamp, eventId: event.id });
      if (event.organization.parentEntityId) registerIdentity("paperclip", event.organization.parentEntityId);
    }
  });
  organizations.forEach((organization, id) => { agentsById.set(id, { ...agentsById.get(id), organization, source: organization.reference }); });
  const agents = [...agentsById.values()].map((agent) => {
    const lastEvent = latestAgentEvents.get(agent.agentId) ?? null;
    return { ...agent, operationalState: operationalState(lastEvent, nowMs, heartbeatTtlMs), lastEvent, lastSeenAt: lastEvent?.timestamp ?? null };
  }).sort((left, right) => left.agentId.localeCompare(right.agentId));
  const agentCounts = { active: 0, idle: 0, blocked: 0, failed: 0, stale: 0, unknown: 0 };
  agents.forEach((agent) => { agentCounts[agent.operationalState] += 1; });
  const heartbeats = new Map();
  journal.events.filter((event) => event.eventType === "heartbeat").forEach((event) => {
    const provider = event.organization?.provider ?? (event.providers?.paperclip ? "paperclip" : "runtime"), id = qualifiedAgentId(provider, event.organization?.entityId ?? event.agentId), previous = heartbeats.get(id);
    if (!previous || Date.parse(previous.timestamp) <= Date.parse(event.timestamp)) heartbeats.set(id, event);
  });
  const communications = journal.events.filter((event) => event.communication).map((event) => {
    const provider = event.providers?.paperclip ? "paperclip" : "runtime";
    return { ...event.communication, fromAgentId: qualifiedAgentId(provider, event.communication.fromAgentId), toAgentId: qualifiedAgentId(provider, event.communication.toAgentId), provider, timestamp: event.timestamp, taskId: event.taskId ?? null, eventId: event.id, source: { path: eventSource.path, observedAt: event.ingestedAt } };
  }).reverse();
  const edgeMap = new Map();
  communications.forEach((communication) => {
    const key = "comm:" + communication.fromAgentId + "→" + communication.toAgentId;
    const edge = edgeMap.get(key) ?? { id: key, edgeType: "communication", fromAgentId: communication.fromAgentId, toAgentId: communication.toAgentId, eventCount: 0, latestAt: communication.timestamp, latestKind: communication.kind, latestStage: communication.kind, direction: "message", provider: communication.provider, sourceEventIds: [], communications: [] };
    edge.eventCount += 1;
    if (edge.latestAt <= communication.timestamp) { edge.latestAt = communication.timestamp; edge.latestKind = communication.kind; edge.latestStage = communication.kind; }
    edge.sourceEventIds.push(communication.eventId); edge.communications.push(communication); edgeMap.set(key, edge);
  });
  const invocationProjection = reduceInvocations(journal.events);
  invocationProjection.activities.forEach((activity) => {
    const provider = activity.provenance.provider, fromRaw = activity.direction === "call" ? activity.parentAgentId : activity.childAgentId, toRaw = activity.direction === "call" ? activity.childAgentId : activity.parentAgentId;
    const fromAgentId = qualifiedAgentId(provider, fromRaw), toAgentId = qualifiedAgentId(provider, toRaw), key = "inv:" + activity.key + ":" + activity.direction;
    const edge = edgeMap.get(key) ?? { id: key, edgeType: "invocation", invocationId: activity.invocationId, invocationKey: activity.key, fromAgentId, toAgentId, eventCount: 0, latestAt: activity.timestamp, latestKind: activity.direction, latestStage: activity.stage, direction: activity.direction, provider, sourceEventIds: [], communications: [] };
    edge.eventCount += 1;
    if (edge.latestAt <= activity.timestamp) { edge.latestAt = activity.timestamp; edge.latestStage = activity.stage; }
    edge.sourceEventIds.push(activity.eventId); edge.communications.push(activity); edgeMap.set(key, edge);
  });
  const parentByAgent = {};
  invocationProjection.invocations.forEach((invocation) => { parentByAgent[qualifiedAgentId(invocation.provenance.provider, invocation.childAgentId)] = qualifiedAgentId(invocation.provenance.provider, invocation.parentAgentId); });
  organizations.forEach((organization, id) => {
    if (!organization.parentEntityId || parentByAgent[id]) return;
    const parent = qualifiedAgentId("paperclip", organization.parentEntityId); parentByAgent[id] = parent;
    edgeMap.set("org:" + parent + "→" + id, { id: "org:" + parent + "→" + id, edgeType: "organization", fromAgentId: parent, toAgentId: id, eventCount: 1, latestAt: organization.timestamp, latestKind: "organization", latestStage: organization.activity ?? "member", direction: "structure", provider: "paperclip", state: "structural", sourceEventIds: [organization.eventId], communications: [] });
  });
  [...edgeMap.values()].forEach((edge) => {
    if (edge.edgeType === "organization") return;
    const endpointsFresh = [heartbeats.get(edge.fromAgentId), heartbeats.get(edge.toAgentId)].every((event) => event && freshAt(event.timestamp, agentLiveTtlMs));
    edge.state = freshAt(edge.latestAt, communicationLiveTtlMs) && endpointsFresh ? "live" : "historical";
    edge.sourceEventIds = [...new Set(edge.sourceEventIds)];
  });
  const allAgentIds = new Set(agents.map((agent) => agent.agentId)), roots = [...allAgentIds].filter((id) => !parentByAgent[id]).sort();
  const depthOf = (id, visited = new Set()) => !parentByAgent[id] || visited.has(id) ? 0 : 1 + depthOf(parentByAgent[id], new Set([...visited, id]));
  const hierarchy = { roots, parentByAgent, maxDepth: Math.max(0, ...[...allAgentIds].map((id) => depthOf(id))), ordering: "createdAt-then-provider-qualified-id" };
  const identityErrors = [...identityProviders.entries()].filter(([, providerSet]) => providerSet.size > 1).map(([agentId, providerSet]) => ({ agentId, providers: [...providerSet].sort(), message: "Provider-qualified identities were separated." }));
  const kanban = createKanban(project, journal.events, root, nowMs, heartbeatTtlMs), environment = options.environment ?? process.env;
  const fiveMinutes = journal.events.filter((event) => Date.parse(event.timestamp) >= nowMs - 300_000 && Date.parse(event.timestamp) <= nowMs);
  const tokens = tokenUsage(journal.events, root, eventPath), prompts = promptUsage(journal.events, root, eventPath);
  const repository = options.repository ?? (options.runCollectors === false ? { value: null, status: "unknown", skipped: true } : repositoryMetric(root));
  const latestEventAt = journal.events.at(-1)?.timestamp ?? null, latestEventAgeMs = latestEventAt ? Math.max(0, nowMs - Date.parse(latestEventAt)) : null;
  const producer = { status: latestEventAgeMs === null ? "unavailable" : latestEventAgeMs <= heartbeatTtlMs ? "live" : "stale", latestAt: latestEventAt, ageMs: latestEventAgeMs };
  const edges = [...edgeMap.values()], paperclipObserved = organizations.size + invocationProjection.invocations.filter((item) => item.provenance.provider === "paperclip").length;
  const paperclip = { ...integration(environment, "PAPERCLIP_URL", ["heartbeat", "task", "metric", "invocation", "organization"], "providers.paperclip"), observedValueCount: paperclipObserved, observedState: paperclipObserved ? "observed" : environment.PAPERCLIP_URL ? "configured-no-values" : "unobserved" };
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION, generatedAt: now.toISOString(), refreshAfterMs: 2_000, heartbeatTtlMs,
    sources: { eventJournal: { ...eventSource, invalidLineCount: journal.errors.length }, projectReport: source(root, projectReportPath), repository: { path: ".", observedAt: stamp(root) } },
    project, roadmap, kanban, agents,
    topology: { nodes: agents, edges, hierarchy, invocations: invocationProjection.invocations, liveEdgeCount: edges.filter((edge) => edge.state === "live").length, observedAt: now.toISOString(), source: eventSource, liveCriteria: { communicationTtlMs: communicationLiveTtlMs, heartbeatTtlMs: agentLiveTtlMs } },
    communications, invocationActivities: [...invocationProjection.activities].reverse().map((activity) => ({ ...activity, source: { path: eventSource.path, observedAt: activity.timestamp } })),
    metrics: { project: { phase: project.phase.title, phaseState: project.phase.state, progress: project.progress, verification: project.verification.state, blocked: { value: project.blockedCount, status: project.blockedCount === null ? "unknown" : "known" } }, agents: { total: agents.length, ...agentCounts }, tasks: { total: Object.values(kanban.columns).flat().length, active: kanban.columns.active.length, blocked: kanban.columns.blocked.length, decision: kanban.columns.decision.length, stale: kanban.columns.stale.length, complete: kanban.columns.complete.length }, events: { total: journal.events.length, lastFiveMinutes: fiveMinutes.length, handoffsLastFiveMinutes: fiveMinutes.filter((event) => event.communication?.kind === "handoff" || event.communication?.kind === "delegation").length, latestAt: latestEventAt, producer }, tokens, prompts, repository },
    collectors,
    integrations: { langgraph: integration(environment, "LANGGRAPH_URL", ["updates", "tasks", "custom"], "providers.langgraph"), langsmith: integration(environment, "LANGSMITH_API_KEY", ["trace", "run"], "providers.langsmith"), openviking: integration(environment, "OPENVIKING_URL", ["context", "retrieval"], "providers.openviking"), paperclip },
    errors: { journal: journal.errors, tokenUsage: tokens.integrityErrors, invocations: invocationProjection.errors, identities: identityErrors },
  };
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.stdout.write(JSON.stringify(collectDashboardSnapshot(), null, 2) + "\n");
