import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const SNAPSHOT_SCHEMA_VERSION = "2.1.0";
export const DEFAULT_HEARTBEAT_TTL_MS = 120_000;
export const MAX_FUTURE_SKEW_MS = 60_000;
const states = new Set(["active", "idle", "blocked", "complete", "failed"]);
const types = new Set(["heartbeat", "lifecycle", "task", "metric", "trace", "context", "handoff", "message", "delegation"]);
const communicationKinds = new Set(["handoff", "message", "delegation"]);
const providers = new Set(["langgraph", "langsmith", "openviking", "paperclip"]);
const usageSources = new Set(["langgraph", "langsmith", "paperclip", "runtime"]);
const tokenMetricKeys = ["tokens.input", "tokens.output", "tokens.total"];
const communicationLiveTtlMs = 15_000;
const agentLiveTtlMs = 30_000;
const agentPattern = /^[a-z0-9][a-z0-9._:-]{0,63}$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const short = (value, maximum) => typeof value === "string" && value.length <= maximum;
const sensitiveValue = (value) => /(?:\b(?:api[_-]?key|token|secret|password|authorization|bearer)\b\s*[:=]\s*|\bsk-[a-z0-9_-]{8,}|\b(?:lsv2|ghp|github_pat)_[a-z0-9_-]{8,}|:\/\/[^\s/:]+:[^\s@]+@)/i.test(value);
const safeText = (value, maximum) => short(value, maximum) && !sensitiveValue(value);
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
  if (hasTokenUsage) {
    if (eventType !== "metric") throw new Error("token usage must be recorded as a metric event.");
    if (!safeText(usageId, 240) || !usageId || !usageSources.has(usageSource) || usageScope !== "exclusive" || metricMode !== "delta") throw new Error("token usage requires a safe usageId, supported usageSource, exclusive scope, and delta mode.");
    if (tokenMetricKeys.some((key) => Object.hasOwn(metrics, key) && (!Number.isSafeInteger(metrics[key]) || metrics[key] < 0))) throw new Error("token usage values must be non-negative safe integers.");
    if (tokenMetricKeys.every((key) => Object.hasOwn(metrics, key)) && metrics["tokens.total"] !== metrics["tokens.input"] + metrics["tokens.output"]) throw new Error("tokens.total must equal tokens.input plus tokens.output when all three are present.");
  } else if (usageId !== undefined || usageSource !== undefined || usageScope !== undefined || metricMode !== undefined) throw new Error("usage metadata requires at least one token metric.");
  const eventProviders = input.providers;
  if (eventProviders !== undefined && (!object(eventProviders) || Object.entries(eventProviders).some(([provider, reference]) => !providers.has(provider) || !safeText(reference, 500)))) throw new Error("providers may only contain safe supported references.");
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
  return { id, agentId, timestamp: new Date(timestamp).toISOString(), state, eventType, ...(taskId ? { taskId } : {}), ...(message ? { message } : {}), ...(metrics ? { metrics } : {}), ...(hasTokenUsage ? { usageId, usageSource, usageScope, metricMode } : {}), ...(eventProviders ? { providers: eventProviders } : {}), ...(communication ? { communication } : {}), ingestedAt: input.ingestedAt && Number.isFinite(Date.parse(input.ingestedAt)) ? new Date(input.ingestedAt).toISOString() : now.toISOString() };
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

const tableValue = (report, key) => report.split(/\r?\n/).find((line) => line.trim().startsWith("| " + key + " |"))?.split("|").map((item) => item.trim()).filter(Boolean)[1] ?? "";
const section = (report, heading) => { const lines = report.split(/\r?\n/); const index = lines.findIndex((line) => line.trim() === "## " + heading); if (index < 0) return ""; return lines.slice(index + 1).takeWhile ? lines.slice(index + 1).takeWhile((line) => !line.startsWith("## ")).join("\n") : lines.slice(index + 1).filter((line, position, list) => !list.slice(0, position).some((prior) => prior.startsWith("## "))).join("\n"); };
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
  const progress = range ? { status: "known", done: Number(range[2]) - Number(range[1]) + 1, total: Number(range[2]) - Number(range[1]) + 1, percentage: 100, source: reportSource } : { status: "unknown", done: null, total: null, percentage: null, source: reportSource };
  const completePhases = [...section(report, "Completed Work").matchAll(/^###\s+(Phase\s+\d+[^\r\n]*)/gim)].map((match) => match[1].trim());
  const currentComplete = /(?:implemented|complete|closed|fully verified)/i.test(report.split(/\r?\n/).slice(0, 12).join(" ")) ? phase : null;
  if (currentComplete && !completePhases.some((entry) => entry.toLowerCase() === currentComplete.toLowerCase())) completePhases.push(currentComplete);
  const milestones = completePhases.map((title) => ({ id: phaseId(title), title, state: "complete", source: reportSource }));
  const next = reportTasks(report, reportSource); const blockedCount = /## Blocking Issues\s*\r?\n\s*None\.?/i.test(report) ? 0 : null;
  return { phase: { title: phase, state: currentComplete ? "complete" : "unknown", source: reportSource }, verification: { state: verification.toLowerCase(), source: reportSource }, progress, milestones, next, blockedCount, observedAt: reportSource.observedAt, source: reportSource };
};

export const runCollector = (root, script, optional = false) => { const absolute = join(root, script); if (!existsSync(absolute)) return { ok: false, status: optional ? "unavailable" : "failed", source: script, observedAt: null, error: optional ? "Optional collector is not installed in this workspace." : "Collector script is missing." }; const result = spawnSync(process.execPath, [absolute], { cwd: root, encoding: "utf8", timeout: 8_000 }); if (result.error) return { ok: false, status: "failed", source: script, observedAt: new Date().toISOString(), error: result.error.message }; if (result.status !== 0) return { ok: false, status: "failed", source: script, observedAt: new Date().toISOString(), error: (result.stderr || result.stdout || "Collector failed.").trim() }; try { return { ok: true, status: "available", source: script, observedAt: new Date().toISOString(), value: JSON.parse(result.stdout) }; } catch { return { ok: false, status: "failed", source: script, observedAt: new Date().toISOString(), error: "Collector did not return JSON." }; } };
const gitMetric = (root) => { const result = spawnSync("git", ["status", "--porcelain=v1"], { cwd: root, encoding: "utf8", timeout: 5_000 }); return result.error || result.status !== 0 ? { value: null, status: "unknown", error: (result.error?.message ?? result.stderr ?? "git status failed").trim() } : { value: result.stdout.split(/\r?\n/).filter(Boolean).length, status: "known" }; };
const integration = (environment, variable, eventMapping, referenceField) => ({ mode: environment[variable] ? "configured" : "contract-ready", configurationDetected: Boolean(environment[variable]), remoteCallsEnabled: false, eventMapping, referenceField });

const createKanban = (project, events, root, nowMs, ttlMs) => {
  const taskEvents = latestBy(events.filter((event) => Date.parse(event.timestamp) <= nowMs), "taskId"); const cards = new Map();
  project.milestones.forEach((milestone) => cards.set(milestone.id, { taskId: milestone.id, title: milestone.title, owner: "report", state: "complete", updatedAt: milestone.source.observedAt, source: milestone.source }));
  project.next.forEach((task) => cards.set(task.taskId, task));
  taskEvents.forEach((event) => { const state = event.state === "active" && Math.max(0, nowMs - Date.parse(event.timestamp)) > ttlMs ? "stale" : event.state; cards.set(event.taskId, { taskId: event.taskId, title: event.message || event.taskId, owner: event.agentId, state, updatedAt: event.timestamp, source: { path: source(root, defaultEventPath(root)).path, observedAt: event.ingestedAt }, eventId: event.id }); });
  const columns = { complete: [], active: [], stale: [], blocked: [], decision: [] };
  cards.forEach((card) => { const column = card.state === "complete" || card.state === "idle" ? "complete" : card.state === "active" ? "active" : card.state === "stale" ? "stale" : card.state === "blocked" || card.state === "failed" ? "blocked" : "decision"; columns[column].push(card); });
  Object.values(columns).forEach((cardsInColumn) => cardsInColumn.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt))));
  return { columns, observedAt: project.observedAt, source: project.source };
};
const hasTokenMetrics = (event) => tokenMetricKeys.some((key) => Object.hasOwn(event.metrics ?? {}, key));
const safeSum = (values) => { let total = 0; for (const value of values) { total += value; if (!Number.isSafeInteger(total)) return null; } return total; };
const tokenSummary = (records) => {
  const field = (key) => { const available = records.filter((record) => Number.isSafeInteger(record.metrics[key])), value = available.length ? safeSum(available.map((record) => record.metrics[key])) : null; return { value, status: !available.length ? "unknown" : value === null ? "overflow" : available.length === records.length ? "known" : "partial", observedEventCount: available.length }; };
  const input = field("tokens.input"), output = field("tokens.output");
  const totals = records.map((record) => { if (Number.isSafeInteger(record.metrics["tokens.total"])) return { value: record.metrics["tokens.total"], derived: false }; if (Number.isSafeInteger(record.metrics["tokens.input"]) && Number.isSafeInteger(record.metrics["tokens.output"])) return { value: record.metrics["tokens.input"] + record.metrics["tokens.output"], derived: true }; return null; }).filter(Boolean), totalValue = totals.length ? safeSum(totals.map((item) => item.value)) : null;
  return { input, output, total: { value: totalValue, status: !totals.length ? "unknown" : totalValue === null ? "overflow" : totals.length !== records.length ? "partial" : totals.some((item) => item.derived) ? "derived" : "known", observedEventCount: totals.length, derivedEventCount: totals.filter((item) => item.derived).length } };
};
const tokenUsage = (events, root, eventPath) => {
  const observed = events.filter(hasTokenMetrics), accepted = [], seen = new Map(), integrityErrors = []; let duplicateReplayCount = 0;
  observed.forEach((event) => { const fingerprint = JSON.stringify({ agentId: event.agentId, taskId: event.taskId ?? null, usageSource: event.usageSource, usageScope: event.usageScope, metricMode: event.metricMode, metrics: Object.fromEntries(tokenMetricKeys.filter((key) => Object.hasOwn(event.metrics, key)).map((key) => [key, event.metrics[key]])) }); const previous = seen.get(event.usageId); if (previous) { if (previous.fingerprint === fingerprint) { duplicateReplayCount += 1; return; } integrityErrors.push({ usageId: event.usageId, eventId: event.id, message: "Conflicting usageId payload was excluded." }); return; } seen.set(event.usageId, { fingerprint, event }); if (event.usageScope === "exclusive" && event.metricMode === "delta") accepted.push(event); });
  const dimensions = (selector) => Object.fromEntries([...new Set(accepted.map(selector))].sort().map((key) => [key, tokenSummary(accepted.filter((event) => selector(event) === key))]));
  const summary = tokenSummary(accepted);
  return { status: integrityErrors.length ? "conflicted" : accepted.length ? "known" : "unknown", ...summary, source: source(root, eventPath), providers: [...new Set(accepted.map((event) => event.usageSource))].sort(), coverage: { observedUsageEvents: observed.length, acceptedUniqueUsageDeltas: accepted.length, duplicateReplayCount, conflictingUsageIdCount: integrityErrors.length, untokenizedMetricEventCount: events.filter((event) => event.metrics && !hasTokenMetrics(event)).length }, byAgent: dimensions((event) => event.agentId), byTask: dimensions((event) => event.taskId ?? "unassigned"), byProvider: dimensions((event) => event.usageSource), deltas: accepted.map((event) => ({ eventId: event.id, usageId: event.usageId, usageSource: event.usageSource, agentId: event.agentId, taskId: event.taskId ?? null, timestamp: event.timestamp, inputTokens: event.metrics["tokens.input"] ?? null, outputTokens: event.metrics["tokens.output"] ?? null, totalTokens: event.metrics["tokens.total"] ?? (Number.isSafeInteger(event.metrics["tokens.input"]) && Number.isSafeInteger(event.metrics["tokens.output"]) ? event.metrics["tokens.input"] + event.metrics["tokens.output"] : null), totalStatus: Number.isSafeInteger(event.metrics["tokens.total"]) ? "known" : Number.isSafeInteger(event.metrics["tokens.input"]) && Number.isSafeInteger(event.metrics["tokens.output"]) ? "derived" : "unknown" })) , integrityErrors };
};
export const collectDashboardSnapshot = (options = {}) => {
  const root = options.root ?? process.cwd(); const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now()); const nowMs = now.getTime(); const heartbeatTtlMs = options.heartbeatTtlMs ?? DEFAULT_HEARTBEAT_TTL_MS; const eventPath = options.eventPath ?? defaultEventPath(root); const journal = readAgentEvents(eventPath, now); const collectorRunner = options.collectorRunner ?? runCollector; const repositoryMetric = options.repositoryMetric ?? gitMetric; const collectors = options.runCollectors === false ? {} : { workspace: collectorRunner(root, "scripts/workspace-status.mjs"), project: collectorRunner(root, "scripts/project-status.mjs"), harness: collectorRunner(root, "scripts/harness-audit.mjs", true) };
  const projectReportPath = join(root, "work", "2D-FPS-game", "docs", "reports", "project-status.md"); const project = deriveProject(root, text(projectReportPath), collectors.project);
  const agentsById = registry(root); journal.events.forEach((event) => { if (!agentsById.has(event.agentId)) agentsById.set(event.agentId, { agentId: event.agentId, source: "event-journal", configured: false }); if (event.communication && !agentsById.has(event.communication.toAgentId)) agentsById.set(event.communication.toAgentId, { agentId: event.communication.toAgentId, source: "event-journal", configured: false }); });
  const latestAgents = latestBy(journal.events, "agentId"); const agents = [...agentsById.values()].map((agent) => { const lastEvent = latestAgents.get(agent.agentId) ?? null; return { ...agent, operationalState: operationalState(lastEvent, nowMs, heartbeatTtlMs), lastEvent, lastSeenAt: lastEvent?.timestamp ?? null }; }).sort((left, right) => left.agentId.localeCompare(right.agentId));
  const agentCounts = { active: 0, idle: 0, blocked: 0, failed: 0, stale: 0, unknown: 0 }; agents.forEach((agent) => { agentCounts[agent.operationalState] += 1; });
  const communications = journal.events.filter((event) => event.communication).map((event) => ({ ...event.communication, timestamp: event.timestamp, taskId: event.taskId ?? null, eventId: event.id, source: { path: source(root, eventPath).path, observedAt: event.ingestedAt } })).reverse();
  const heartbeats = latestBy(journal.events.filter((event) => event.eventType === "heartbeat"), "agentId");
  const edgeMap = new Map(); communications.forEach((communication) => { const key = communication.fromAgentId + "→" + communication.toAgentId; const edge = edgeMap.get(key) ?? { id: key, fromAgentId: communication.fromAgentId, toAgentId: communication.toAgentId, eventCount: 0, latestAt: communication.timestamp, latestKind: communication.kind, sourceEventIds: [], communications: [] }; edge.eventCount += 1; if (edge.latestAt < communication.timestamp) { edge.latestAt = communication.timestamp; edge.latestKind = communication.kind; } edge.sourceEventIds.push(communication.eventId); edge.communications.push(communication); edgeMap.set(key, edge); });
  [...edgeMap.values()].forEach((edge) => { const freshAt = (timestamp, ttlMs) => { const age = nowMs - Date.parse(timestamp); return age >= 0 && age <= ttlMs; }; const communicationFresh = freshAt(edge.latestAt, communicationLiveTtlMs); const fromHeartbeat = heartbeats.get(edge.fromAgentId), toHeartbeat = heartbeats.get(edge.toAgentId); const endpointsFresh = [fromHeartbeat, toHeartbeat].every((event) => event && freshAt(event.timestamp, agentLiveTtlMs)); edge.state = communicationFresh && endpointsFresh ? "live" : "historical"; edge.sourceEventIds = [...new Set(edge.sourceEventIds)]; });
  const kanban = createKanban(project, journal.events, root, nowMs, heartbeatTtlMs); const environment = options.environment ?? process.env; const fiveMinutes = journal.events.filter((event) => Date.parse(event.timestamp) >= nowMs - 300_000 && Date.parse(event.timestamp) <= nowMs); const tokens = tokenUsage(journal.events, root, eventPath);
  return { schemaVersion: SNAPSHOT_SCHEMA_VERSION, generatedAt: now.toISOString(), refreshAfterMs: 2_000, heartbeatTtlMs, sources: { eventJournal: { ...source(root, eventPath), invalidLineCount: journal.errors.length }, projectReport: source(root, projectReportPath), repository: { path: ".", observedAt: stamp(root) } }, project, kanban, agents, topology: { nodes: agents, edges: [...edgeMap.values()], liveEdgeCount: [...edgeMap.values()].filter((edge) => edge.state === "live").length, observedAt: now.toISOString(), source: source(root, eventPath), liveCriteria: { communicationTtlMs: communicationLiveTtlMs, heartbeatTtlMs: agentLiveTtlMs } }, communications, metrics: { project: { phase: project.phase.title, phaseState: project.phase.state, progress: project.progress, verification: project.verification.state, blocked: { value: project.blockedCount, status: project.blockedCount === null ? "unknown" : "known" } }, agents: { total: agents.length, ...agentCounts }, tasks: { total: Object.values(kanban.columns).flat().length, active: kanban.columns.active.length, blocked: kanban.columns.blocked.length, decision: kanban.columns.decision.length, stale: kanban.columns.stale.length, complete: kanban.columns.complete.length }, events: { total: journal.events.length, lastFiveMinutes: fiveMinutes.length, handoffsLastFiveMinutes: fiveMinutes.filter((event) => event.communication?.kind === "handoff" || event.communication?.kind === "delegation").length, latestAt: journal.events.at(-1)?.timestamp ?? null }, tokens, repository: repositoryMetric(root) }, collectors, integrations: { langgraph: integration(environment, "LANGGRAPH_URL", ["updates", "tasks", "custom"], "providers.langgraph"), langsmith: integration(environment, "LANGSMITH_API_KEY", ["trace", "run"], "providers.langsmith"), openviking: integration(environment, "OPENVIKING_URL", ["context", "retrieval"], "providers.openviking"), paperclip: integration(environment, "PAPERCLIP_URL", ["heartbeat", "task", "metric"], "providers.paperclip") }, errors: { journal: journal.errors, tokenUsage: tokens.integrityErrors } };
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.stdout.write(JSON.stringify(collectDashboardSnapshot(), null, 2) + "\n");