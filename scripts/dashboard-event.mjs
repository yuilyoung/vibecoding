import { appendAgentEvent, createPromptPreview } from "./dashboard-observability.mjs";

const options = {}, positional = [];
for (let index = 2; index < process.argv.length; index += 1) {
  const raw = process.argv[index];
  if (!raw.startsWith("--")) { positional.push(raw); continue; }
  const [key, inlineValue] = raw.slice(2).split(/=(.*)/s), value = inlineValue ?? process.argv[index + 1];
  if (key && value !== undefined && !String(value).startsWith("--")) {
    options[key] = value;
    if (inlineValue === undefined) index += 1;
  }
}

if (!Object.keys(options).length && positional.length) {
  const [agent, state, type, task, ...rest] = positional;
  Object.assign(options, { agent, state, type, task });
  const keys = type === "metric"
    ? ["input-tokens", "output-tokens", "total-tokens", "usage-id", "usage-source", "usage-scope", "metric-mode", "invocation-id", "invocation-provider"]
    : ["message"];
  keys.forEach((key, index) => { if (rest[index] !== undefined) options[key] = rest[index]; });
}

const numeric = (key) => options[key] === undefined ? undefined : Number(options[key]);
const optional = (value) => value === undefined || value === "" ? undefined : value;

try {
  const metrics = Object.fromEntries([
    ["tokens.input", numeric("input-tokens")],
    ["tokens.output", numeric("output-tokens")],
    ["tokens.total", numeric("total-tokens")],
  ].filter(([, value]) => value !== undefined));
  const communication = options.to ? {
    toAgentId: options.to,
    kind: options.kind ?? options.type,
    summary: options.summary ?? options.message,
    correlationId: optional(options.correlation),
  } : undefined;
  const invocation = options["invocation-id"] && options["parent-agent"] && options["child-agent"] && options.stage ? {
    invocationId: options["invocation-id"],
    parentInvocationId: optional(options["parent-invocation-id"]) ?? null,
    rootInvocationId: options["root-invocation-id"] ?? options["invocation-id"],
    parentAgentId: options["parent-agent"],
    childAgentId: options["child-agent"],
    stage: options.stage,
    direction: options.direction ?? (["responded", "failed", "cancelled", "stopped"].includes(options.stage) ? "return" : "call"),
    sequence: numeric("sequence"),
    provenance: { provider: options.provider ?? "runtime", reference: options["provider-ref"] ?? "dashboard-event-cli" },
  } : undefined;
  const cycle = options["cycle-id"] && options["step-id"] && options["pipeline-stage"] ? {
    cycleId: options["cycle-id"],
    stepId: options["step-id"],
    predecessorStepId: optional(options["predecessor-step-id"]) ?? null,
    stage: options["pipeline-stage"],
    sequence: numeric("cycle-sequence"),
    state: options["cycle-state"] ?? options.state,
    ...(options["invocation-id"] ? { invocationId: options["invocation-id"], invocationProvider: options["invocation-provider"] ?? options.provider ?? "runtime" } : {}),
    ...(options.summary || options.message ? { summary: options.summary ?? options.message } : {}),
  } : undefined;
  const prompt = options.prompt === undefined ? undefined : createPromptPreview(options.prompt);
  const organization = options["organization-id"] && options["entity-id"] ? {
    provider: "paperclip",
    entityId: options["entity-id"],
    parentEntityId: optional(options["parent-entity-id"]) ?? null,
    organizationId: options["organization-id"],
    team: optional(options.team) ?? null,
    role: optional(options.role) ?? null,
    activity: optional(options.activity) ?? null,
    reference: options["paperclip-ref"] ?? options["provider-ref"] ?? "paperclip:dashboard-event-cli",
  } : undefined;
  const providerReferences = {
    ...((options["paperclip-ref"] || organization) ? { paperclip: options["paperclip-ref"] ?? organization.reference } : {}),
  };
  const event = appendAgentEvent({
    agentId: options.agent,
    timestamp: options.timestamp ?? new Date().toISOString(),
    state: options.state,
    eventType: options.type,
    taskId: optional(options.task),
    projectId: optional(options.project),
    cycleId: optional(options["cycle-id"]),
    message: optional(options["event-message"] ?? options.message),
    ...(Object.keys(metrics).length ? { metrics, usageId: options["usage-id"], usageSource: options["usage-source"], usageScope: options["usage-scope"], metricMode: options["metric-mode"] } : {}),
    ...(["metric", "prompt"].includes(options.type) && options["invocation-id"] ? { invocationId: options["invocation-id"], invocationProvider: options["invocation-provider"] ?? (options.type === "metric" ? options["usage-source"] : undefined) } : {}),
    ...(Object.keys(providerReferences).length ? { providers: providerReferences } : {}),
    ...(communication ? { communication } : {}),
    ...(invocation ? { invocation } : {}),
    ...(cycle ? { cycle } : {}),
    ...(prompt ? { prompt } : {}),
    ...(organization ? { organization } : {}),
  });
  process.stdout.write(JSON.stringify(event, null, 2) + "\n");
} catch (error) {
  process.stderr.write("dashboard:event failed: " + error.message + "\n");
  process.exitCode = 1;
}
