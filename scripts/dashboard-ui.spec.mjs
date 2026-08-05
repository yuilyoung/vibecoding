import { expect, test } from "@playwright/test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDashboardServer } from "./dashboard-server.mjs";
import { appendAgentEvent, defaultEventPath } from "./dashboard-observability.mjs";

test("operations view filters source-backed work and opens its task evidence", async ({ page }) => {
  const root = mkdtempSync(path.join(tmpdir(), "dashboard-ui-"));
  const dashboardPath = fileURLToPath(new URL("../dashboard/index.html", import.meta.url));
  const eventPath = defaultEventPath(root);
  const now = new Date();
  const staleAt = new Date(now.getTime() - 130_000);
  mkdirSync(path.join(root, "dashboard"), { recursive: true });
  mkdirSync(path.join(root, "work", "2D-FPS-game", "docs", "reports"), { recursive: true });
  copyFileSync(dashboardPath, path.join(root, "dashboard", "index.html"));
  writeFileSync(path.join(root, "work", "2D-FPS-game", "docs", "reports", "project-status.md"), [
    "# 2D-FPS-game Project Status Report",
    "",
    "- **Phase:** Phase 9 - Dashboard Operations (active)",
    "",
    "| Key | Value |",
    "| --- | --- |",
    "| Active milestone | Phase 9 - Dashboard Operations |",
    "| Development status | Phase 9 T0-T3 are complete: visible operations UI ready. |",
    "| Verification | pass |",
    "",
    "## Completed Work",
    "",
    "### Phase 8 - Environment Audio Polish",
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
  ["ultron", "reviewer"].forEach((agentId) => appendAgentEvent({ agentId, timestamp: now.toISOString(), state: "active", eventType: "heartbeat", taskId: "dashboard-ui" }, { eventPath, now }));
  appendAgentEvent({ agentId: "ultron", timestamp: now.toISOString(), state: "active", eventType: "delegation", taskId: "dashboard-ui", communication: { toAgentId: "reviewer", kind: "delegation", summary: "Seed UI communication" } }, { eventPath, now });
  appendAgentEvent({ agentId: "ultron", timestamp: now.toISOString(), state: "active", eventType: "task", taskId: "task-active", message: "Active implementation" }, { eventPath, now });
  appendAgentEvent({ agentId: "ultron", timestamp: now.toISOString(), state: "failed", eventType: "task", taskId: "task-blocked", message: "Blocked rendering" }, { eventPath, now });
  appendAgentEvent({ agentId: "reviewer", timestamp: staleAt.toISOString(), state: "active", eventType: "task", taskId: "task-stale", message: "Stale review evidence" }, { eventPath, now });
  const collectorRunner = (_root, script, optional) => optional
    ? { ok: false, status: "unavailable", source: script, observedAt: null, error: "Optional collector is not installed in this workspace." }
    : { ok: true, status: "available", source: script, observedAt: now.toISOString(), value: { status: "pass" } };
  const server = createDashboardServer({ root, eventPath, snapshotOptions: { collectorRunner, repositoryMetric: () => ({ value: null, status: "unknown", error: "Not collected in UI fixture." }) } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#phase-title")).toContainText("Phase 9");
    await expect(page.locator("#attention-queue")).toContainText("Blocked rendering");
    await expect(page.locator("#attention-queue")).toContainText("unavailable");
    await page.locator('button[data-filter="attention"]').click();
    await expect(page.locator("#work-board")).toContainText("Blocked rendering");
    await expect(page.locator("#work-board")).not.toContainText("Pick the next visible product slice");
    await page.locator('#work-board [data-task-id="task-blocked"]').click();
    await expect(page.locator("#task-drawer")).toHaveClass(/open/);
    await expect(page.locator("#drawer-title")).toHaveText("Blocked rendering");
    await expect(page.locator('#graph [data-agent-id="ultron"]')).toHaveClass(/selected/);
    await page.locator("#drawer-close").click();
    await expect(page.locator("#task-drawer")).not.toHaveClass(/open/);
    expect(errors).toEqual([]);
  } finally {
    await page.close().catch(() => undefined);
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  }
});
