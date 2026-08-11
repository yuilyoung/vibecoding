import { expect, test } from "@playwright/test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDashboardServer } from "./dashboard-server.mjs";
import { appendAgentEvent as appendEvent, defaultEventPath } from "./dashboard-observability.mjs";

const appendAgentEvent = (event, options) => appendEvent({ projectId: "2D-FPS-game", cycleId: "cycle-dashboard-ui", ...event }, options);

test("v5 switches project detail and renders live invocation and orchestration graphs", async ({ page }) => {
  const root = mkdtempSync(path.join(tmpdir(), "dashboard-ui-v5-"));
  const dashboardPath = fileURLToPath(new URL("../dashboard/index.html", import.meta.url));
  const eventPath = defaultEventPath(root);
  const now = new Date();
  const staleAt = new Date(now.getTime() - 130_000);
  mkdirSync(path.join(root, "dashboard"), { recursive: true });
  mkdirSync(path.join(root, "work", "2D-FPS-game", "docs", "reports"), { recursive: true });
  mkdirSync(path.join(root, "work", "2D-FPS-game", "docs", "planning"), { recursive: true });
  mkdirSync(path.join(root, "work", "animation_real_studio", "tasks"), { recursive: true });
  mkdirSync(path.join(root, "docs", "handoffs"), { recursive: true });
  copyFileSync(dashboardPath, path.join(root, "dashboard", "index.html"));
  writeFileSync(path.join(root, "work", "2D-FPS-game", "docs", "reports", "project-status.md"), [
    "# 2D-FPS-game Project Status Report",
    "",
    "- **Phase:** Phase 9 - Dashboard Operations (active)",
    "- **Status:** Dashboard operations slice is active",
    "- **Date:** 2026-08-06",
    "",
    "| Key | Value |",
    "| --- | --- |",
    "| Active milestone | Phase 9 - Dashboard Operations |",
    "| Development status | Dashboard operations are active. |",
    "| Verification | pass |",
    "",
    "## Summary",
    "",
    "Project and agent operations share one command surface.",
    "",
    "## Completed Work",
    "",
    "### Phase 8 - Environment Audio Polish",
    "",
    "## Risks",
    "",
    "| Risk | Impact | Status |",
    "| --- | --- | --- |",
    "| Runtime producer can disconnect. | low | Exposed through freshness status |",
    "",
    "## Blocking Issues",
    "",
    "None.",
    "",
    "## Immediate Next Tasks",
    "",
    "| Priority | ID | Task | Owner | Estimate |",
    "| --- | --- | --- | --- | --- |",
    "| 1 | decision-slice | Pick the next visible product slice. | vision | decision |",
  ].join("\n"));
  writeFileSync(path.join(root, "work", "2D-FPS-game", "docs", "planning", "phase9-tasks.json"), JSON.stringify({
    created: "2026-08-06",
    acceptanceMap: { A1: "The command surface is planned.", A2: "The command surface is verified." },
    tasks: [
      { id: "T0", subject: "Plan command surface", assignee: "ultron", status: "completed", depends: [], acceptance: ["A1"], files: ["dashboard/index.html"] },
      { id: "T1", subject: "Verify command surface", assignee: "reviewer", status: "active", depends: ["T0"], acceptance: ["A2"], files: ["scripts/dashboard-ui.spec.mjs"] },
    ],
  }));
  writeFileSync(path.join(root, "work", "animation_real_studio", "package.json"), JSON.stringify({ name: "Animation Real Studio" }));
  writeFileSync(path.join(root, "work", "animation_real_studio", "tasks", "mvp-readiness.json"), JSON.stringify({
    status: "planned", milestones: [{ id: "M0", name: "Readiness" }], tasks: [
      { id: "ARS-001", title: "Decide safety contract", status: "ready", milestone: "M0" },
      { id: "ARS-002", title: "Research provider", status: "blocked-by-research", milestone: "M0", depends: ["ARS-001"] },
    ],
  }));
  writeFileSync(path.join(root, "docs", "handoffs", "current-execution-report.md"), [
    "# Dashboard Execution",
    "",
    "3-file/12-test unit suite",
    "",
    "## Verification",
    "",
    "| Gate | Result | Notes |",
    "| --- | --- | --- |",
    "| npm run build | pass | Largest emitted chunk observed: dashboard at 80.5 kB, gzip 25.2 kB. |",
    "| npx playwright test | pass | 4 / 4 Playwright E2E passed. |",
    "| node scripts/check-mainscene-loc.mjs | pass | MainScene.ts line count 100/850. |",
  ].join("\n"));

  ["ultron", "reviewer"].forEach((agentId) => appendAgentEvent({ agentId, timestamp: now.toISOString(), state: "active", eventType: "heartbeat", taskId: "dashboard-ui" }, { eventPath, now }));
  appendAgentEvent({ id: "11111111-1111-4111-8111-111111111111", agentId: "ultron", timestamp: now.toISOString(), state: "active", eventType: "delegation", taskId: "dashboard-ui", communication: { toAgentId: "reviewer", kind: "delegation", summary: "Seed UI communication", correlationId: "dashboard-ui-correlation" } }, { eventPath, now });
  const invocation = { invocationId: "inv-dashboard-ui", parentInvocationId: null, rootInvocationId: "inv-dashboard-ui", parentAgentId: "ultron", childAgentId: "reviewer", provenance: { provider: "runtime", reference: "ui:fixture" } };
  appendAgentEvent({ id: "12111111-1111-4111-8111-111111111111", agentId: "ultron", timestamp: now.toISOString(), state: "active", eventType: "invocation", taskId: "dashboard-ui", invocation: { ...invocation, stage: "created", direction: "call", sequence: 1 } }, { eventPath, now });
  appendAgentEvent({ id: "13111111-1111-4111-8111-111111111111", agentId: "ultron", timestamp: now.toISOString(), state: "active", eventType: "invocation", taskId: "dashboard-ui", invocation: { ...invocation, stage: "called", direction: "call", sequence: 2 } }, { eventPath, now });
  const paperclipInvocation = { ...invocation, parentAgentId: "director", childAgentId: "worker", provenance: { provider: "paperclip", reference: "paperclip:inv-dashboard-ui" } };
  appendAgentEvent({ id: "13911111-1111-4111-8111-111111111111", agentId: "director", timestamp: now.toISOString(), state: "active", eventType: "invocation", taskId: "dashboard-ui", invocation: { ...paperclipInvocation, stage: "called", direction: "call", sequence: 1 } }, { eventPath, now });
  appendAgentEvent({ id: "13921111-1111-4111-8111-111111111111", agentId: "director", timestamp: now.toISOString(), state: "active", eventType: "prompt", taskId: "dashboard-ui", invocationId: "inv-dashboard-ui", invocationProvider: "paperclip", providers: { paperclip: "paperclip:inv-dashboard-ui:prompt" }, prompt: { preview: "Paperclip private prompt", originalLength: 24, capturedLength: 24, lengthUnit: "unicode-code-points", truncated: false, redactionStatus: "clean" } }, { eventPath, now });
  appendAgentEvent({ id: "14111111-1111-4111-8111-111111111111", agentId: "ultron", timestamp: now.toISOString(), state: "active", eventType: "prompt", taskId: "dashboard-ui", invocationId: "inv-dashboard-ui", invocationProvider: "runtime", prompt: { preview: "Implement the constellation safely", originalLength: 34, capturedLength: 34, lengthUnit: "unicode-code-points", truncated: false, redactionStatus: "clean" } }, { eventPath, now });
  appendAgentEvent({ id: "22222222-2222-4222-8222-222222222222", agentId: "ultron", timestamp: now.toISOString(), state: "active", eventType: "metric", taskId: "dashboard-ui", invocationId: "inv-dashboard-ui", metrics: { "tokens.input": 120, "tokens.output": 80, "tokens.total": 200 }, usageId: "runtime:dashboard-ui:1", usageSource: "runtime", usageScope: "exclusive", metricMode: "delta" }, { eventPath, now });
  appendAgentEvent({ id: "33333333-3333-4333-8333-333333333333", agentId: "ultron", timestamp: now.toISOString(), state: "active", eventType: "metric", taskId: "dashboard-ui", invocationId: "inv-dashboard-ui", metrics: { "tokens.input": 120, "tokens.output": 80, "tokens.total": 200 }, usageId: "runtime:dashboard-ui:1", usageSource: "runtime", usageScope: "exclusive", metricMode: "delta" }, { eventPath, now });
  appendAgentEvent({ id: "44444444-4444-4444-8444-444444444444", agentId: "ultron", timestamp: now.toISOString(), state: "active", eventType: "metric", taskId: "dashboard-ui", invocationId: "inv-dashboard-ui", metrics: { "tokens.input": 121, "tokens.output": 80, "tokens.total": 201 }, usageId: "runtime:dashboard-ui:1", usageSource: "runtime", usageScope: "exclusive", metricMode: "delta" }, { eventPath, now });
  const organization = (entityId, parentEntityId, role) => ({ provider: "paperclip", entityId, parentEntityId, organizationId: "fps-metaverse", team: "agent-squad", role, activity: "active", reference: "paperclip:" + entityId });
  appendAgentEvent({ agentId: "director", timestamp: now.toISOString(), state: "active", eventType: "heartbeat", providers: { paperclip: "paperclip:director" }, organization: organization("director", null, "lead") }, { eventPath, now });
  appendAgentEvent({ agentId: "worker", timestamp: now.toISOString(), state: "active", eventType: "heartbeat", providers: { paperclip: "paperclip:worker" }, organization: organization("worker", "director", "reviewer") }, { eventPath, now });
  appendAgentEvent({ agentId: "ultron", timestamp: now.toISOString(), state: "active", eventType: "task", taskId: "task-active", message: "Active implementation" }, { eventPath, now });
  appendAgentEvent({ agentId: "ultron", timestamp: now.toISOString(), state: "failed", eventType: "task", taskId: "task-blocked", message: "Blocked rendering" }, { eventPath, now });
  appendAgentEvent({ agentId: "reviewer", timestamp: staleAt.toISOString(), state: "active", eventType: "task", taskId: "task-stale", message: "Stale review evidence" }, { eventPath, now });
  const cycleStages = ["analysis", "design", "design_verification", "implementation", "implementation_verification", "feedback"];
  cycleStages.forEach((stage, index) => appendAgentEvent({ agentId: index % 2 ? "reviewer" : "ultron", timestamp: now.toISOString(), state: index === cycleStages.length - 1 ? "active" : "complete", eventType: "cycle", taskId: "dashboard-ui", cycle: { cycleId: "cycle-dashboard-ui", stepId: "step-" + (index + 1), predecessorStepId: index ? "step-" + index : null, stage, sequence: index + 1, state: index === cycleStages.length - 1 ? "active" : "complete", summary: stage + " fixture evidence" } }, { eventPath, now }));
  const legacyInvocation = { invocationId: "legacy-inv-dashboard-ui", parentInvocationId: null, rootInvocationId: "legacy-inv-dashboard-ui", parentAgentId: "legacy-parent", childAgentId: "legacy-child", provenance: { provider: "runtime", reference: "ui:legacy-unassigned" } };
  appendEvent({ id: "71111111-1111-4111-8111-111111111111", agentId: "legacy-parent", timestamp: now.toISOString(), state: "active", eventType: "invocation", taskId: "legacy-ui", invocation: { ...legacyInvocation, stage: "created", direction: "call", sequence: 1 } }, { eventPath, now });
  appendEvent({ id: "72111111-1111-4111-8111-111111111111", agentId: "legacy-parent", timestamp: now.toISOString(), state: "active", eventType: "invocation", taskId: "legacy-ui", invocation: { ...legacyInvocation, stage: "called", direction: "call", sequence: 2 } }, { eventPath, now });
  appendEvent({ id: "73111111-1111-4111-8111-111111111111", agentId: "legacy-child", timestamp: now.toISOString(), state: "active", eventType: "invocation", taskId: "legacy-ui", invocation: { ...legacyInvocation, stage: "stopped", direction: "return", sequence: 3 } }, { eventPath, now });

  const collectorRunner = (_root, script, optional) => optional
    ? { ok: false, status: "unavailable", source: script, observedAt: null, error: "Optional collector is not installed in this workspace." }
    : { ok: true, status: "available", source: script, observedAt: now.toISOString(), value: { status: "pass" } };
  const server = createDashboardServer({ root, eventPath, snapshotOptions: { collectorRunner, repositoryMetric: () => ({ value: null, status: "unknown", error: "Not collected in UI fixture." }) } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".project-card")).toHaveCount(2);
    await expect(page.locator('.project-card[data-project-id="2D-FPS-game"]')).toHaveClass(/selected/);
    await expect(page.locator('.project-card[data-project-id="2D-FPS-game"] .baseline-badge')).toHaveText("실행 기준");
    await expect(page.locator("#portfolio-total")).toHaveText("2");
    await page.locator('.project-card[data-project-id="animation_real_studio"]').click();
    await expect(page.locator("#phase-title")).toContainText("M0");
    await expect(page.locator("#project-progress")).toHaveText("0 / 2");
    await expect(page.locator("#portfolio-detail")).toContainText("ARS-001");
    await expect(page.locator("#token-total")).toHaveText("—");
    await expect(page.locator("#cycle-empty")).toBeVisible();
    await page.locator('.project-card[data-project-id="2D-FPS-game"]').click();
    await expect(page.locator("#phase-title")).toContainText("Phase 9");
    await expect(page.locator("#project-progress")).toHaveText("1 / 2");
    await expect(page.locator("#unit-tests")).toHaveText("12");
    await expect(page.locator("#e2e-tests")).toHaveText("4 / 4");
    await expect(page.locator("#loc-budget")).toHaveText("100 / 850");
    await expect(page.locator("#live-agents")).toHaveText("3 / 4");
    await expect(page.locator("#live-links")).toHaveText("3 / 3");
    await expect(page.locator("#live-links-note")).toContainText("22 events");
    await expect(page.locator("#token-total")).toHaveText("200");
    await expect(page.locator("#token-total-note")).toContainText("exact");
    await expect(page.locator("#token-input")).toHaveText("120");
    await expect(page.locator("#token-output")).toHaveText("80");
    await expect(page.locator("#prompt-preview")).toHaveText("Implement the constellation safely");
    await expect(page.locator("#prompt-preview-note")).toContainText("34 chars");
    await expect(page.locator("#sprint-status")).toContainText("활성 스프린트 없음");
    await expect(page.locator(".roadmap-phase.active")).toHaveCount(1);
    await expect(page.locator(".node")).toHaveCount(4);
    await expect(page.locator(".node.provider-paperclip")).toHaveCount(2);
    await expect(page.locator(".edge")).toHaveCount(3);
    await expect(page.locator(".edge.live")).toHaveCount(3);
    await expect(page.locator("#topology-status")).toContainText("unassigned hidden 2");
    await expect(page.locator("#communication-stream")).not.toContainText("Subagent stopped; outcome unknown");
    await page.locator("#unassigned-toggle").click();
    await expect(page.locator(".edge")).toHaveCount(5);
    await expect(page.locator("#topology-status")).toContainText("unassigned shown 2");
    await expect(page.locator("#communication-stream")).toContainText("Subagent stopped; outcome unknown");
    await expect(page.locator("#communication-stream")).toContainText("stopped");
    await page.locator("#unassigned-toggle").click();
    await expect(page.locator(".edge")).toHaveCount(3);
    await expect(page.locator('.edge.invocation[data-direction="call"]')).toHaveCount(2);
    await expect(page.locator(".edge-packet.call")).toHaveCount(2);
    await expect(page.locator(".edge-text.call").first()).toContainText("CALL 호출");
    await expect(page.locator("#paperclip-status")).toContainText("observed");
    await expect(page.locator("#invocation-metrics")).toContainText("inv-dashboard-ui");
    await expect(page.locator("#invocation-metrics")).toContainText("INPUT");
    await expect(page.locator(".cycle-stage-band")).toHaveCount(7);
    await expect(page.locator(".cycle-agent-label")).toHaveCount(2);
    await expect(page.locator(".cycle-step")).toHaveCount(6);
    await expect(page.locator(".cycle-edge")).toHaveCount(5);
    await expect(page.locator('.cycle-step.active[data-stage="feedback"]')).toHaveCount(1);
    await expect(page.locator(".cycle-edge.live")).toHaveCount(1);
    await expect(page.locator("#cycle-inspector")).toContainText("피드백");
    await page.locator('.edge-hit[data-edge-control="inv:paperclip:inv-dashboard-ui:call"]').evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await expect(page.locator("#invocation-metrics")).toContainText("Paperclip private prompt");
    await page.locator('.edge-hit[data-edge-control="inv:runtime:inv-dashboard-ui:call"]').evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await expect(page.locator("#invocation-metrics")).toContainText("Implement the constellation safely");
    await expect(page.locator("#invocation-metrics")).not.toContainText("Paperclip private prompt");
    await page.locator('.node[data-agent-id="ultron"]').evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await expect(page.locator("#communication-stream")).toContainText("dashboard-ui-correlation");
    await expect(page.locator("#communication-stream")).toContainText("↓ CALL");
    await expect(page.locator("#communication-stream")).toContainText("event 11111111");
    await expect(page.locator("#attention-list")).toContainText("Blocked rendering");
    await expect(page.locator("#attention-list")).toContainText("토큰 무결성 충돌");
    await expect(page.locator("#attention-list")).toContainText("harness collector");
    const desktop = await page.evaluate(() => ({ portfolioBottom: document.querySelector("#portfolio-panel").getBoundingClientRect().bottom, boardTop: document.querySelector(".board").getBoundingClientRect().top, graphTop: document.querySelector(".agent-panel").getBoundingClientRect().top, scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(desktop.boardTop).toBeGreaterThan(desktop.portfolioBottom);
    expect(Math.abs(desktop.boardTop-desktop.graphTop)).toBeLessThan(2);
    expect(desktop.scrollWidth).toBe(desktop.viewport);

    await page.locator('#kanban-board [data-task-id="task-blocked"]').click();
    await expect(page.locator("#task-drawer")).toHaveClass(/open/);
    await expect(page.locator("#drawer-title")).toHaveText("task-blocked · Blocked rendering");
    await expect(page.locator('#agent-graph [data-agent-id="ultron"]')).toHaveClass(/selected/);
    await page.locator("#drawer-close").click();
    await expect(page.locator("#task-drawer")).not.toHaveClass(/open/);

    appendAgentEvent({ agentId: "vision", timestamp: now.toISOString(), state: "active", eventType: "heartbeat", taskId: "dashboard-ui" }, { eventPath, now });
    appendAgentEvent({ agentId: "reviewer", timestamp: now.toISOString(), state: "active", eventType: "message", taskId: "dashboard-ui", communication: { toAgentId: "vision", kind: "message", summary: "Stream node update", correlationId: "dashboard-ui-stream" } }, { eventPath, now });
    appendAgentEvent({ agentId: "reviewer", timestamp: now.toISOString(), state: "active", eventType: "invocation", taskId: "dashboard-ui", invocation: { ...invocation, stage: "responded", direction: "return", sequence: 3 } }, { eventPath, now });
    appendAgentEvent({ agentId: "ultron", timestamp: now.toISOString(), state: "active", eventType: "cycle", taskId: "dashboard-ui", cycle: { cycleId: "cycle-dashboard-ui", stepId: "step-7", predecessorStepId: "step-6", stage: "revision", sequence: 7, state: "active", summary: "Revision after reviewer feedback" } }, { eventPath, now });
    await expect(page.locator(".node")).toHaveCount(5, { timeout: 4_000 });
    await expect(page.locator(".edge")).toHaveCount(5, { timeout: 4_000 });
    await expect(page.locator('.edge.invocation[data-direction="return"]')).toHaveCount(1);
    await expect(page.locator(".edge-packet.return")).toHaveCount(1);
    await expect(page.locator("#communication-stream")).toContainText("↑ RETURN");
    await expect(page.locator(".cycle-step")).toHaveCount(7, { timeout: 4_000 });
    await expect(page.locator('.cycle-step.active[data-stage="revision"]')).toHaveCount(1);
    await expect(page.locator('.cycle-edge.live[data-cycle-edge-id*="step-6->step-7"]')).toHaveCount(1);
    await expect(page.locator("#cycle-inspector")).toContainText("Revision after reviewer feedback");
    await page.locator(".edge-hit").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#agent-inspector")).toContainText("방향");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".edge-packet")).toHaveCount(0);
    await page.setViewportSize({ width: 820, height: 1180 });
    const tablet = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(tablet.scrollWidth).toBe(tablet.viewport);
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(mobile.scrollWidth).toBe(mobile.viewport);
    expect(errors).toEqual([]);
  } finally {
    await page.close().catch(() => undefined);
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  }
});
