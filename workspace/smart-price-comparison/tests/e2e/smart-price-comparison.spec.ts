import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("calculates the complete sample menu profit", async ({ page }) => {
  await page.getByRole("button", { name: "메뉴 수익 계산" }).first().click();
  await expect(page.getByTestId("menu-total-cost")).toContainText("5,730");
  await expect(page.getByTestId("menu-profit")).toContainText("6,770");

  await page.getByLabel("실제 메뉴가격").fill("5000");
  await expect(page.getByTestId("menu-profit")).toContainText("-₩730");
  await expect(page.getByText("예상 손실")).toBeVisible();
});

test("supports a manual product-code fallback and unit comparison", async ({ page }) => {
  await page.getByRole("button", { name: "상품 가격 비교" }).first().click();
  await page.getByPlaceholder("QR URL 또는 바코드 번호").fill("8801111000900");
  await page.getByRole("button", { name: "코드 확인" }).click();

  await expect(page.getByText("대용량 오트밀", { exact: true })).toBeVisible();
  await expect(page.getByText("현재 최저가", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "10ml당" }).click();
  await expect(page.getByText("비교 단위 다름").first()).toBeVisible();
});

test("manual product entry never treats a blank discount as free", async ({ page }) => {
  await page.getByRole("button", { name: "상품 가격 비교" }).first().click();
  await page.getByRole("button", { name: "상품 직접 추가" }).click();
  await page.getByLabel("상품명").fill("수동 등록 쌀");
  await page.getByLabel("매장명").fill("우리동네마트");
  await page.getByLabel("정상가").fill("12000");
  await page.getByLabel("포장량").fill("1000");
  await page.getByRole("button", { name: "비교 목록에 추가" }).click();

  const card = page.getByTestId("product-card").filter({ hasText: "수동 등록 쌀" });
  await expect(card).toContainText("₩12,000");
  await expect(card).not.toContainText("100%");
});

test("keeps core actions usable on a mobile viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "mobile-only assertion");
  await expect(page.getByText("반갑습니다. 무엇을 비교할까요?")).toBeVisible();
  await page.getByRole("navigation", { name: "모바일 메뉴" }).getByRole("button", { name: "상품 가격 비교" }).click();
  await expect(page.getByRole("button", { name: "카메라로 스캔" })).toBeVisible();
  await expect(page.getByPlaceholder("QR URL 또는 바코드 번호")).toBeVisible();
});
