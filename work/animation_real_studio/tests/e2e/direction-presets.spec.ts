import { expect, test } from "@playwright/test";

test("home shows a non-interactive pending image-generation status", async ({ page }, testInfo) => {
  await page.goto("/");
  const panel = page.getByLabel("실사 이미지 생성 준비 상태");

  await expect(panel.getByRole("heading", { name: /실사 이미지\s*생성 준비 중/ })).toBeVisible();
  await expect(panel).toContainText("현재는 로컬 2D 프리뷰만 가능합니다.");
  await expect(panel).toContainText("EXTERNAL API OFFLINE");
  await expect(panel.locator(".reel-figure, img, button, a, input, [role=button], [tabindex]")).toHaveCount(0);
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