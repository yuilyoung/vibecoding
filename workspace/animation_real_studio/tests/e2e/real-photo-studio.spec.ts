import { expect, test } from "@playwright/test";

const brief = { subjectKind: "human", subjectDetail: "fictional_adult", age: "adult_30s", presentation: "unspecified", ethnicity: "east_asian", country: "south_korea", peopleCount: "one", era: "contemporary", weather: "rain", environment: "city", cameraAngle: "three_quarter", framing: "upper_body", lighting: "neon_night", mood: "dramatic", perspective: "third_person", wardrobe: "casual", profession: "office_worker", story: "A fictional adult makes a calm decision in an original rainy city scene." };
const failedBatch = (variantCount = 3) => ({ id: "batch-integrated", protocolVersion: "image-batch.v1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: "failed", brief, outputPlan: { kind: "still", frameCount: 1 }, variantCount, variants: Array.from({ length: variantCount }, (_, index) => ({ id: `variant-${index}`, index, treatment: `Treatment ${index + 1}`, projectId: `photo-${index}`, status: "failed", progress: 0, phase: "failed", delivery: null, error: { code: "test_terminal", message: "test terminal" } })), selection: null });

test("one Business default profile drives the unified form and its initial payload", async ({ page }) => {
  let batchRequest: Record<string, any> | null = null;
  await page.route("**/api/image-batches", async (route) => {
    batchRequest = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: failedBatch(3) }) });
  });
  await page.goto("/real");
  await expect(page.getByRole("radio", { name: /텍스트.*실사/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: /실사 PNG/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "3장" })).toHaveAttribute("aria-pressed", "true");
  const expected = { "등장 주체": "human", "세부 주체": "fictional_adult", "나이": "adult_30s", "성별 표현": "unspecified", "인종·민족 표현": "east_asian", "국가·문화권": "south_korea", "사람 수": "one", "시대": "contemporary", "날씨": "rain", "환경": "city", "카메라 각도": "three_quarter", "프레이밍": "upper_body", "조도": "neon_night", "분위기": "dramatic", "시점": "third_person", "복장": "casual", "인물 직업·유형": "office_worker" };
  for (const [label, value] of Object.entries(expected)) await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  await page.locator(".image-batch-consent input").check();
  await page.getByRole("button", { name: "3개 후보 생성" }).click();
  await expect.poll(() => batchRequest).not.toBeNull();
  expect(batchRequest?.variantCount).toBe(3);
  expect(batchRequest?.outputPlan).toEqual({ kind: "still", frameCount: 1 });
  expect(batchRequest?.brief).toEqual({ ...brief, story: "A fictional adult makes a calm decision in an original rainy city scene with cinematic light." });
  expect(batchRequest).not.toHaveProperty("sourceInput");
});

test("one integrated form owns every image setting and submits a 2D GIF batch only once", async ({ page }) => {
  let batchRequest: Record<string, any> | null = null;
  let legacyPhotoRequests = 0;
  await page.route("**/api/photorealistic-projects", async (route) => { legacyPhotoRequests += 1; await route.abort(); });
  await page.route("**/api/image-batches", async (route) => {
    batchRequest = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: failedBatch(2) }) });
  });
  await page.goto("/real");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator("form.photo-studio")).toHaveCount(1);
  for (const label of ["등장 주체", "세부 주체", "나이", "성별 표현", "인종·민족 표현", "국가·문화권", "사람 수", "시대", "날씨", "환경", "카메라 각도", "프레이밍", "조도", "분위기", "시점", "복장", "인물 직업·유형", "장면과 행동"]) await expect(page.getByLabel(label, { exact: true })).toHaveCount(1);

  await page.getByRole("radio", { name: /2D 애니메이션/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "owned-2d.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71]) });
  await page.getByRole("button", { name: /배경 배치·조명/ }).click();
  await page.getByRole("radio", { name: /모션 GIF/ }).click();
  await page.getByLabel("GIF 프레임 수").fill("30");
  await page.getByRole("button", { name: "2장" }).click();
  await page.getByLabel("나이").selectOption("adult_40s");
  await page.getByLabel("프레이밍").selectOption("full_body");
  await page.locator(".image-batch-consent input").check();
  await page.getByRole("button", { name: "2개 후보 생성" }).click();

  await expect.poll(() => batchRequest).not.toBeNull();
  expect(batchRequest?.variantCount).toBe(2);
  expect(batchRequest?.outputPlan).toEqual({ kind: "motion_gif", frameCount: 30 });
  expect(batchRequest?.brief.age).toBe("adult_40s");
  expect(batchRequest?.brief.framing).toBe("full_body");
  expect(batchRequest?.sourceInput.kind).toBe("attested_original_2d");
  expect(batchRequest?.sourceInput.referenceFocus.preserveBackgroundLayout).toBe(false);
  expect(legacyPhotoRequests).toBe(0);
});

test("switching back to text mode removes reference bytes from the single batch request", async ({ page }) => {
  let batchRequest: Record<string, any> | null = null;
  await page.route("**/api/image-batches", async (route) => {
    batchRequest = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: failedBatch(1) }) });
  });
  await page.goto("/real");
  await page.getByRole("radio", { name: /2D 애니메이션/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "owned-2d.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71]) });
  await page.getByRole("radio", { name: /텍스트 → 실사/ }).click();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByRole("button", { name: "1장" }).click();
  await page.locator(".image-batch-consent input").check();
  await page.getByRole("button", { name: "1개 후보 생성" }).click();
  await expect.poll(() => batchRequest).not.toBeNull();
  expect(batchRequest).not.toHaveProperty("sourceInput");
});

test("2D input reports unsupported and oversized files without retaining them", async ({ page }) => {
  await page.goto("/real");
  await page.getByRole("radio", { name: /2D 애니메이션/ }).click();
  const source = page.locator('input[type="file"]');
  const unsupported = { name: "not-an-image.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") };

  await source.setInputFiles(unsupported);
  await expect(page.getByRole("alert")).toContainText("PNG, JPEG 또는 WebP");
  await expect(source).toHaveValue("");
  await expect(page.getByRole("button", { name: "3개 후보 생성" })).toBeDisabled();
  await source.setInputFiles(unsupported);
  await expect(page.getByRole("alert")).toContainText("PNG, JPEG 또는 WebP");
  await expect(source).toHaveValue("");

  await source.setInputFiles({ name: "too-large.png", mimeType: "image/png", buffer: Buffer.alloc(6 * 1024 * 1024 + 1) });
  await expect(page.getByRole("alert")).toContainText("6 MB 이하");
  await expect(source).toHaveValue("");
  await expect(page.getByRole("button", { name: "3개 후보 생성" })).toBeDisabled();
});

test("integrated settings reflow without horizontal overflow", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/real");
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    await expect(page.getByLabel("등장 주체")).toBeVisible();
    await expect(page.getByRole("button", { name: "3개 후보 생성" })).toBeVisible();
  }
});
