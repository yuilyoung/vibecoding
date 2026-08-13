import { expect, test } from "@playwright/test";

test("home presents the opt-in real-image experiment without starting a job", async ({ page }, testInfo) => {
  await page.goto("/");
  const panel = page.locator(".hero-reel-pending");
  await expect(panel).toContainText("TRUSTED LOCAL IMAGE GENERATION");
  await expect(panel).toContainText("STUDIO_HEADLESS_IMAGEGEN=1");
  await expect(panel.locator("button, a, input, [role=button], [tabindex]")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("home-generation-status.png"), fullPage: true });
});
test("direction presets are explicit controls and do not start generation", async ({ page }) => {
  let generationRequests = 0;
  page.on("request", (request) => {
    if (/\/api\/projects|\/images\/(generations|edits)/.test(new URL(request.url()).pathname)) generationRequests += 1;
  });

  await page.goto("/create");
  await page.getByLabel("장면 설명").fill("비 오는 밤, 막차가 떠나기 전 두 친구가 플랫폼에서 조용히 화해하는 오리지널 장면입니다.");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: /내 오리지널 이야기/ }).click();
  await page.getByRole("button", { name: "다음" }).click();

  const group = page.getByRole("group", { name: "로컬 프리뷰 연출 프리셋" });
  const rain = page.getByRole("button", { name: "색감·조명·구도 프리셋: 비 내린 플랫폼" });
  const warm = page.getByRole("button", { name: "색감·조명·구도 프리셋: 늦은 밤의 방" });
  const set = page.getByRole("button", { name: "색감·조명·구도 프리셋: 가상의 촬영 현장" });

  await expect(page.locator("#direction-help")).toContainText("업로드나 실제 AI 이미지 생성을 시작하지 않습니다.");
  await expect(rain).toContainText("청색 색감 · 젖은 금속 반사광 · 인물 근경");
  await expect(warm).toContainText("호박색 색감 · 스탠드 조명 · 정적인 중경");
  await expect(set).toContainText("대비 색감 · 세트 라이트 · 와이드 구도");
  await expect(rain).toHaveAttribute("aria-pressed", "true");
  await expect(warm).toHaveAttribute("aria-pressed", "false");
  await expect(group.locator("input[type=file], img")).toHaveCount(0);

  await warm.click();
  await expect(warm).toHaveAttribute("aria-pressed", "true");
  await expect(warm).toContainText("선택됨");
  await expect(rain).toHaveAttribute("aria-pressed", "false");
  expect(generationRequests).toBe(0);
});
test("project probe shows fixed headless generation progress", async ({ page }) => {
  let postRequests = 0;
  await page.route("**/api/headless-image-spike", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ generation: null, capabilityToken: "visual-token" }) });
      return;
    }
    postRequests += 1;
    expect(route.request().headers()["x-studio-local-token"]).toBe("visual-token");
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ generation: { id: "headless-001", status: "in_progress", provider: "codex-headless-imagegen", job: { mode: "developer_image_probe", phase: "generating", progress: 50 }, asset: null, error: null, notice: "fixed probe" }, capabilityToken: "visual-token" }) });
  });
  await page.goto("/projects/demo-001");
  const probe = page.getByLabel("Headless photorealistic image generation probe");
  await expect(probe.getByRole("heading", { name: "Codex headless photorealistic still" })).toBeVisible();
  await expect(probe).toContainText("Generates one more fixed, developer-only test image and consumes one probe allowance. It is not a user request or public delivery.");
  await probe.getByRole("button", { name: /Generate test photorealistic image/ }).click();
  await expect(probe.getByRole("status")).toContainText("50%");
  await expect(probe.getByRole("progressbar", { name: "Developer image probe progress" })).toHaveAttribute("aria-valuenow", "50");
  await expect(probe.locator(".preview-loading")).toHaveCount(0);
  expect(postRequests).toBe(1);
});test("project probe replaces progress with an error after failure", async ({ page }) => {
  await page.route("**/api/headless-image-spike", async (route) => { await route.fulfill({ contentType: "application/json", body: JSON.stringify({ generation: { id: "headless-failed", status: "failed", provider: "codex-headless-imagegen", job: { mode: "developer_image_probe", phase: "failed", progress: 50 }, asset: null, error: { code: "provider_failed", message: "fixed provider failure" }, notice: "fixed probe" }, capabilityToken: "visual-token" }) }); });
  await page.goto("/projects/demo-001");
  const probe = page.getByLabel("Headless photorealistic image generation probe");
  await expect(probe.getByRole("alert")).toContainText("fixed provider failure");
  await expect(probe.locator(".developer-probe-loading")).toHaveCount(0);
  await expect(probe.getByRole("progressbar", { name: "Developer image probe progress" })).toHaveCount(0);
});
test("project probe keeps polling until the completed image arrives", async ({ page }) => {
  let running = false;
  let postRequests = 0;
  await page.route("**/api/headless-image-spike", async (route) => {
    if (route.request().method() === "GET") {
      const generation = running ? { id: "headless-completed", status: "completed", provider: "codex-headless-imagegen", job: { mode: "developer_image_probe", phase: "completed", progress: 100 }, asset: { dataUri: "data:image/png;base64,AA==", width: 9, height: 16, targetAspectRatio: "9:16", returnedAspectRatio: "9:16", notice: "completed fixed asset" }, error: null, notice: "fixed probe" } : null;
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ generation, capabilityToken: "visual-token" }) });
      return;
    }
    postRequests += 1;
    running = true;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ generation: { id: "headless-completed", status: "in_progress", provider: "codex-headless-imagegen", job: { mode: "developer_image_probe", phase: "generating", progress: 50 }, asset: null, error: null, notice: "fixed probe" }, capabilityToken: "visual-token" }) });
  });
  await page.goto("/projects/demo-001");
  const probe = page.getByLabel("Headless photorealistic image generation probe");
  await probe.getByRole("button", { name: /Generate test photorealistic image/ }).click();
  await expect(probe.getByRole("status")).toContainText("50%");
  await expect(probe.getByText("completed fixed asset")).toBeVisible({ timeout: 2500 });
  await expect(probe.getByRole("status")).toHaveCount(0);
  const retryButton = probe.getByRole("button", { name: "Generate another test image" });
  await expect(retryButton).toBeEnabled();
  await retryButton.click();
  expect(postRequests).toBe(2);
});

test("project probe reconciles a stale exhausted allowance after a rejected start", async ({ page }) => {
  let postRequests = 0;
  await page.route("**/api/headless-image-spike", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ generation: null, capabilityToken: "visual-token", remainingAttempts: 1 }) });
      return;
    }
    postRequests += 1;
    await route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "probe_allowance_exhausted", message: "No developer probe allowance remains for this API session.", generation: { id: "headless-prior", status: "completed", provider: "codex-headless-imagegen", job: { mode: "developer_image_probe", phase: "completed", progress: 100 }, asset: null, error: null, notice: "prior fixed probe" }, capabilityToken: "visual-token", remainingAttempts: 0 }) });
  });
  await page.goto("/projects/demo-001");
  const probe = page.getByLabel("Headless photorealistic image generation probe");
  await probe.getByRole("button", { name: "Generate test photorealistic image" }).click();
  await expect(probe.getByText("No developer probe allowance remains for this API session.")).toBeVisible();
  await expect(probe.getByRole("button", { name: "Probe allowance exhausted" })).toBeDisabled();
  expect(postRequests).toBe(1);
});