import { expect, test } from "@playwright/test";

const conditions = { subject: "fictional_adult", age: "adult_30s", era: "contemporary", setting: "city_night", presentation: "unspecified", framing: "upper_body", cameraAngle: "three_quarter", clothing: "casual", peopleCount: "one" };
const activeProject = { id: "photo-0001", status: "in_progress", mode: "text_to_photo", conditions, detailPrompt: "An original adult-safe rainy city scene with natural cinematic light.", composedPrompt: "server composed", output: { kind: "still", frameCount: 1, fps: null }, source: null, job: { id: "photo-job-photo-0001", provider: "codex-headless-imagegen", mode: "text_to_photo", outputKind: "still", requestedFrameCount: 1, encodedFrameCount: 0, fps: null, status: "in_progress", phase: "provider_started", progress: 55, observedProgress: 55, forecastHighWater: 0, progressBasis: "server_lifecycle_and_duration_forecast", startedAt: new Date(Date.now() - 20_000).toISOString(), phaseStartedAt: new Date(Date.now() - 20_000).toISOString(), completedAt: null, estimatedDurationSeconds: 315, elapsedSeconds: 20, estimatedRemainingSeconds: 295, etaState: "bootstrap", etaSource: "bucket_bootstrap", durationSampleCount: 0 }, delivery: null, error: null };
const completedProject = { ...activeProject, status: "completed", job: { ...activeProject.job, status: "completed", phase: "completed", progress: 100, completedAt: new Date().toISOString(), estimatedRemainingSeconds: 0, etaState: "terminal", etaSource: null }, delivery: { mode: "text_to_photo", output: { kind: "still", frameCount: 1, fps: null }, notice: "done", asset: { id: "result", kind: "user_photorealistic_still", origin: "codex_headless_imagegen", generatedByAi: true, mimeType: "image/png", width: 9, height: 16, aspectRatio: "9:16", frameCount: 1, fps: null, durationSeconds: null, byteLength: 2, dataUri: "data:image/png;base64,AA==", notice: "local result", cleanupWarning: { code: "cleanup_warning", osCode: "EBUSY" } } } };
const forecastProject = { ...activeProject, job: { ...activeProject.job, progress: 80, observedProgress: 55, forecastHighWater: 80, progressBasis: "server_lifecycle_and_duration_forecast", estimatedDurationSeconds: 75, elapsedSeconds: 60, estimatedRemainingSeconds: 15, etaState: "sampled", etaSource: "bucket_median", durationSampleCount: 3 } };

async function submitStill(page: import("@playwright/test").Page) {
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "실사 이미지 생성" }).click();
}

test("real photo studio exposes condition controls, GIF output selection, and an editable default prompt", async ({ page }) => {
  await page.goto("/real");
  await expect(page.getByRole("heading", { name: /실사 이미지/ })).toBeVisible();
  await expect(page.locator(".condition-grid fieldset")).toHaveCount(9);
  await page.getByRole("radio", { name: /2D 애니메이션/ }).click();
  await expect(page.locator(".photo-reference-disclosure")).toContainText("Codex에 전달됩니다");
  await expect(page.locator('input[type="checkbox"]')).toHaveAttribute("aria-describedby", "photo-reference-egress");
  const prompt = page.locator(".photo-prompt textarea");
  const defaultText = await prompt.inputValue();
  await prompt.fill("사용자가 입력한 오리지널 성인 장면을 더 구체적으로 설명합니다.");
  await page.getByRole("button", { name: "선택 조건으로 기본 문구 다시 만들기" }).click();
  await expect(prompt).toHaveValue(defaultText);
  await page.getByRole("radio", { name: /모션 GIF/ }).click();
  const frames = page.getByRole("slider", { name: "GIF 프레임 수" });
  await expect(frames).toHaveValue("12");
  await frames.fill("30");
  await expect(page.getByText(/10fps · 약 3.0초/)).toBeVisible();
  await expect(page.getByText(/AI 비디오가 아닙니다/)).toBeVisible();
});

test("real photo studio displays server-calculated duration forecast progress and only displays 100 after a completed result", async ({ page }) => {
  let reads = 0;
  await page.route("**/api/photorealistic-projects", async (route) => {
    const request = route.request().postDataJSON();
    expect(request.outputKind).toBe("still");
    expect(request.frameCount).toBe(1);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ project: activeProject }) });
  });
  await page.route("**/api/photorealistic-projects/photo-0001", async (route) => {
    reads += 1;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ project: reads > 1 ? completedProject : forecastProject }) });
  });
  await page.goto("/real");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await submitStill(page);
  const job = page.locator(".photo-job");
  const bar = job.getByRole("progressbar", { name: "\uC11C\uBC84 \uCD08\uAE30 \uC644\uB8CC \uC608\uC0C1 \uC9C4\uD589\uB960" });
  await expect(bar).toBeVisible();
  const initialProgress = Number(await bar.getAttribute("aria-valuenow"));
  expect(initialProgress).toBeGreaterThan(20);
  expect(initialProgress).toBeLessThan(100);
  await expect(job).toHaveClass(/is-active/);
  await expect(job).toContainText("\uCD08\uAE30 \uCD94\uC815");
  await expect(job.locator(".photo-live-indicator")).toHaveAttribute("aria-hidden", "true");
  await expect(bar).toHaveAttribute("aria-valuetext", /\uCD08\uAE30 \uCD94\uC815/);
  expect(await job.locator(".photo-live-indicator i").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  const forecastBar = job.getByRole("progressbar", { name: "\uC11C\uBC84 \uC644\uB8CC \uD45C\uBCF8 \uAE30\uBC18 \uC608\uC0C1 \uC9C4\uD589\uB960" });
  await expect(forecastBar).toHaveAttribute("aria-valuenow", "80");
  await expect(job).toContainText("\uC644\uB8CC \uD45C\uBCF8 3\uAC1C \uAE30\uBC18 \uCD94\uC815");
  await expect(job.locator(".photo-timing div").nth(1)).toContainText("15");
  await expect(job.locator(".photo-result")).toBeVisible({ timeout: 3500 });
  await expect(job.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  await expect(job.locator(".photo-live-indicator")).toHaveCount(0);
  await expect(job).toContainText("PHOTOREALISTIC STILL / 9:16");
  await expect(job.locator(".photo-cleanup-warning")).toContainText("cleanup_warning");
});

test("real photo studio posts no retained 2D reference after switching back to text mode", async ({ page }) => {
  let submitted: { referenceImage?: unknown } | null = null;
  await page.route("**/api/photorealistic-projects", async (route) => {
    submitted = route.request().postDataJSON() as { referenceImage?: unknown };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ project: activeProject }) });
  });
  await page.goto("/real");
  await page.locator(".mode-grid button").nth(1).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "owned-2d.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71]) });
  await page.locator(".mode-grid button").nth(0).click();
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "실사 이미지 생성" }).click();
  await expect.poll(() => submitted).not.toBeNull();
  expect(submitted?.referenceImage).toBeUndefined();
});

test("real photo studio submits 2 and 30 frame GIF boundaries and renders observed GIF encoding", async ({ page }) => {
  const gifActive = { ...activeProject, output: { kind: "motion_gif", frameCount: 30, fps: 10 }, job: { ...activeProject.job, outputKind: "motion_gif", requestedFrameCount: 30, encodedFrameCount: 15, fps: 10, phase: "gif_encoding", progress: 90 } };
  const gifCompleted = { ...gifActive, status: "completed", job: { ...gifActive.job, status: "completed", phase: "completed", progress: 100, encodedFrameCount: 30, completedAt: new Date().toISOString(), estimatedRemainingSeconds: 0, etaState: "terminal", etaSource: null }, delivery: { mode: "text_to_photo", output: { kind: "motion_gif", frameCount: 30, fps: 10 }, notice: "motion done", asset: { id: "gif", kind: "user_motion_gif", origin: "local_motion_gif_from_generated_still", generatedByAi: true, mimeType: "image/gif", width: 432, height: 768, aspectRatio: "9:16", frameCount: 30, fps: 10, durationSeconds: 3, byteLength: 1024, dataUri: "data:image/gif;base64,R0lGODlh", notice: "motion gif" } } };
  let reads = 0;
  await page.route("**/api/photorealistic-projects", async (route) => {
    const request = route.request().postDataJSON();
    expect(request.outputKind).toBe("motion_gif");
    expect(request.frameCount).toBe(30);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ project: gifActive }) });
  });
  await page.route("**/api/photorealistic-projects/photo-0001", async (route) => {
    reads += 1;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ project: reads > 1 ? gifCompleted : gifActive }) });
  });
  await page.goto("/real");
  await page.getByRole("radio", { name: /모션 GIF/ }).click();
  const frames = page.getByRole("slider", { name: "GIF 프레임 수" });
  await frames.fill("2");
  await expect(frames).toHaveValue("2");
  await frames.fill("30");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "모션 GIF 생성" }).click();
  const job = page.locator(".photo-job");
  await expect(job).toContainText("모션 GIF 프레임 15/30");
  await expect(job).toContainText("GIF 프레임");
  await expect(job.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "90");
  await expect(job.locator(".photo-result")).toBeVisible({ timeout: 3500 });
  await expect(job).toContainText("MOTION GIF / 9:16");
  await expect(job).toContainText(/30프레임 · 10fps · 3.0초/);
});

test("real photo studio keeps an exceeded estimate below 100 and renders an asynchronous provider failure", async ({ page }) => {
  const overdueProject = { ...activeProject, job: { ...activeProject.job, progress: 95, observedProgress: 55, forecastHighWater: 95, progressBasis: "server_lifecycle_and_duration_forecast", startedAt: new Date(Date.now() - 100_000).toISOString(), elapsedSeconds: 100, estimatedRemainingSeconds: null, etaState: "estimate_exceeded", durationSampleCount: 3 } };
  const failedProject = { ...overdueProject, status: "failed", job: { ...overdueProject.job, status: "failed", phase: "failed", progress: 95, completedAt: new Date().toISOString(), estimatedRemainingSeconds: 0, etaState: "terminal", etaSource: null }, error: { code: "provider_failed", message: "The local provider stopped after starting." } };
  await page.route("**/api/photorealistic-projects", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ project: overdueProject }) }));
  await page.route("**/api/photorealistic-projects/photo-0001", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ project: failedProject }) }));
  await page.goto("/real");
  await submitStill(page);
  const job = page.locator(".photo-job");
  await expect(job.locator(".photo-timing div").nth(1)).toContainText("예상 시간을 넘겼습니다");
  await expect(job.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "95");
  await expect(job).toContainText("provider_failed", { timeout: 3500 });
  await expect(job).toContainText("생성 작업이 실패했습니다");
});