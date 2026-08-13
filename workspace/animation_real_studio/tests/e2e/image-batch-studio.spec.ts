import { expect, test } from "@playwright/test";

const brief = { subjectKind: "human", subjectDetail: "fictional_adult", ethnicity: "east_asian", country: "south_korea", era: "contemporary", weather: "rain", environment: "city", cameraAngle: "three_quarter", lighting: "neon_night", mood: "dramatic", perspective: "third_person", wardrobe: "casual", profession: "office_worker", story: "A fictional adult makes a calm decision in an original rainy city scene." };
const asset = (id: string) => ({ id, dataUri: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="9" height="16"><rect width="9" height="16" fill="#345"/></svg>`)}`, mimeType: "image/svg+xml", width: 9, height: 16 });
const variant = (index: number, status: "in_progress" | "completed" | "failed") => ({ id: `batch-0001-variant-${index + 1}`, index, treatment: `Treatment ${index + 1}`, projectId: `photo-${index + 1}`, status, progress: status === "completed" ? 100 : status === "failed" ? 45 : 30, phase: status, delivery: status === "completed" ? { asset: asset(`asset-${index + 1}`) } : null, error: status === "failed" ? { code: "provider_failed", message: "Safe variant failure" } : null });
const activeBatch = { id: "batch-0001", protocolVersion: "image-batch.v1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: "in_progress", brief, variantCount: 3, variants: [variant(0, "in_progress"), variant(1, "in_progress"), variant(2, "in_progress")], selection: null };
const partialBatch = { ...activeBatch, status: "partial", variants: [variant(0, "completed"), variant(1, "failed"), variant(2, "completed")] };
const activeBatchAt = (progress: number) => ({ ...activeBatch, variants: activeBatch.variants.map((item) => ({ ...item, progress })) });

test("generation workspace exposes one unified settings workflow", async ({ page }) => {
  await page.goto("/real");
  await expect(page.getByRole("radio", { name: /후보 비교/ })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /단일 이미지 · 2D · GIF/ })).toHaveCount(0);
  await expect(page.locator("form.photo-studio")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "3개 후보 생성" })).toHaveCount(1);
});

test("batch studio exposes the structured direction contract and submits three variants", async ({ page }) => {
  let submitted: Record<string, unknown> | null = null;
  await page.route("**/api/image-batches", async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: { ...partialBatch, status: "failed", variants: [variant(0, "failed"), variant(1, "failed"), variant(2, "failed")] } }) });
  });
  await page.goto("/real");
  await expect(page.getByRole("heading", { name: /세 후보를 비교하세요/ })).toBeVisible();
  for (const label of ["등장 주체", "인종·민족 표현", "국가·문화권", "시대", "날씨", "환경", "카메라 각도", "조도", "분위기", "시점", "복장", "인물 직업·유형"]) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  await page.getByLabel("복장").selectOption("school_inspired");
  await expect(page.getByLabel("인물 직업·유형", { exact: true })).toHaveValue("adult_university_student");
  await expect(page.locator(".image-batch-rule").filter({ hasText: "성인 대학생(20세 이상)" })).toBeVisible();
  await page.getByLabel("시점").selectOption("first_person");
  await page.locator(".image-batch-consent input").check();
  await page.getByRole("button", { name: "3개 후보 생성" }).click();
  await expect.poll(() => submitted).not.toBeNull();
  expect(submitted?.protocolVersion).toBe("image-batch.v1");
  expect(submitted?.variantCount).toBe(3);
  expect((submitted?.brief as typeof brief).profession).toBe("adult_university_student");
  expect((submitted?.brief as typeof brief).perspective).toBe("first_person");
  expect((submitted?.brief as typeof brief).ethnicity).toBe("east_asian");
  expect((submitted?.brief as typeof brief).country).toBe("south_korea");
  await expect(page.locator(".retouch-roadmap")).toContainText("아직 제공하지 않습니다");
  await expect(page.locator(".retouch-roadmap button")).toHaveCount(0);
});

test("batch studio submits the one-variant boundary", async ({ page }) => {
  let submittedCount: number | null = null;
  const oneBatch = { ...partialBatch, status: "failed", variantCount: 1, variants: [variant(0, "failed")] };
  await page.route("**/api/image-batches", async (route) => {
    submittedCount = route.request().postDataJSON().variantCount;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: oneBatch }) });
  });
  await page.goto("/real");
  await page.getByRole("button", { name: "1장" }).click();
  await page.locator(".image-batch-consent input").check();
  await page.getByRole("button", { name: "1개 후보 생성" }).click();
  await expect.poll(() => submittedCount).toBe(1);
  await expect(page.locator(".image-batch-results .image-variant-card")).toHaveCount(1);
});

test("fictional Korean archetypes and adult swimwear remain independently selectable", async ({ page }) => {
  let submitted: Record<string, unknown> | null = null;
  await page.route("**/api/image-batches", async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: { ...partialBatch, status: "failed", variants: [variant(0, "failed"), variant(1, "failed"), variant(2, "failed")] } }) });
  });
  await page.goto("/real");
  const ethnicity = page.getByLabel("인종·민족 표현", { exact: true });
  const country = page.getByLabel("국가·문화권", { exact: true });
  const profession = page.getByLabel("인물 직업·유형", { exact: true });
  await expect(ethnicity).toHaveValue("east_asian");
  await expect(country).toHaveValue("south_korea");
  await ethnicity.selectOption("multiracial");
  await country.selectOption("brazil");
  for (const archetype of ["kpop_idol", "fashion_model", "announcer"]) {
    await profession.selectOption(archetype);
    await expect(ethnicity).toHaveValue("multiracial");
    await expect(country).toHaveValue("brazil");
  }
  await page.getByLabel("복장", { exact: true }).selectOption("micro_bikini");
  await page.locator(".image-batch-consent input").check();
  await page.getByRole("button", { name: "3개 후보 생성" }).click();
  await expect.poll(() => submitted).not.toBeNull();
  const submittedBrief = submitted?.brief as typeof brief;
  expect(submittedBrief.ethnicity).toBe("multiracial");
  expect(submittedBrief.country).toBe("brazil");
  expect(submittedBrief.profession).toBe("announcer");
  expect(submittedBrief.wardrobe).toBe("micro_bikini");
});

test("batch studio preserves partial success and selects a completed candidate", async ({ page }) => {
  let selectionRequest: { variantId: string } | null = null;
  await page.route("**/api/image-batches", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: activeBatch }) }));
  await page.route("**/api/image-batches/batch-0001", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: partialBatch }) }));
  await page.route("**/api/image-batches/batch-0001/selection", async (route) => {
    selectionRequest = route.request().postDataJSON() as { variantId: string };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: { ...partialBatch, selection: { variantId: selectionRequest.variantId, revision: 1, selectedAt: new Date().toISOString() } } }) });
  });
  await page.goto("/real");
  await page.locator(".image-batch-consent input").check();
  await page.getByRole("button", { name: "3개 후보 생성" }).click();
  const results = page.locator(".image-batch-results");
  await expect(results).toContainText("일부 후보가 완성되었습니다", { timeout: 3000 });
  await expect(results.locator(".image-variant-card")).toHaveCount(3);
  await expect(results.locator(".image-variant-error")).toContainText("provider_failed");
  const selectButtons = results.getByRole("button", { name: "이 이미지 선택" });
  await expect(selectButtons).toHaveCount(2);
  await selectButtons.first().click();
  await expect.poll(() => selectionRequest?.variantId).toBe("batch-0001-variant-1");
  await expect(results.getByRole("button", { name: /선택됨 · revision 1/ })).toHaveAttribute("aria-pressed", "true");
});

test("stale 38 percent is identified as the last estimate and can be cleared without losing settings", async ({ page }) => {
  await page.route("**/api/image-batches", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: activeBatchAt(38) }) }));
  await page.route("**/api/image-batches/batch-0001", async (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "local API unavailable" }) }));
  await page.goto("/real");
  await page.getByLabel("날씨").selectOption("snow");
  await page.locator(".image-batch-consent input").check();
  await page.getByRole("button", { name: "3개 후보 생성" }).click();

  const results = page.locator(".image-batch-results");
  await expect(results.getByText("예상 38%", { exact: true }).first()).toBeVisible();
  await expect(results).toContainText("마지막으로 확인된 예상 진행률", { timeout: 3_000 });
  await expect(results.getByText("마지막 확인 38%", { exact: true }).first()).toBeVisible();
  await expect(results.getByRole("alert")).toContainText("작업 상태 연결이 끊겼습니다", { timeout: 5_000 });
  await expect(results.getByRole("alert")).toContainText("메모리에만 있던 기존 작업은 복구할 수 없을 수 있습니다");

  await results.getByRole("button", { name: "새 생성 시작" }).click();
  await expect(results).toHaveCount(0);
  await expect(page.getByLabel("날씨")).toHaveValue("snow");
  await expect(page.locator(".image-batch-consent input")).toBeChecked();
  await expect(page.getByRole("button", { name: "3개 후보 생성" })).toBeEnabled();
});

test("polling recovery clears the stale warning and resumes estimated progress", async ({ page }) => {
  let reads = 0;
  await page.route("**/api/image-batches", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: activeBatchAt(38) }) }));
  await page.route("**/api/image-batches/batch-0001", async (route) => {
    reads += 1;
    if (reads === 1) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "temporary outage" }) });
    else await route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: activeBatchAt(63) }) });
  });
  await page.goto("/real");
  await page.locator(".image-batch-consent input").check();
  await page.getByRole("button", { name: "3개 후보 생성" }).click();

  const results = page.locator(".image-batch-results");
  await expect(results.getByText("마지막 확인 38%", { exact: true }).first()).toBeVisible({ timeout: 3_000 });
  await expect(results.getByText("예상 63%", { exact: true }).first()).toBeVisible({ timeout: 3_000 });
  await expect(results.locator(".image-batch-connection")).toHaveCount(0);
});

test("non-human subjects remove human profession and wardrobe controls", async ({ page }) => {
  await page.goto("/real");
  await page.getByLabel("등장 주체").selectOption("bird");
  await expect(page.getByLabel("세부 주체")).toHaveValue("songbird");
  await expect(page.getByLabel("복장")).toHaveCount(0);
  await expect(page.getByLabel("인물 직업·유형", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("인종·민족 표현", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("국가·문화권", { exact: true })).toHaveCount(0);
  await expect(page.getByText("동물과 새에는 사람의 나이·성별 표현·직업·복장을 적용하지 않습니다.")).toBeVisible();
  await page.getByLabel("장면과 행동").fill("A bird poses sensually and provocatively over an original forest.");
  await page.locator(".image-batch-consent input").check();
  await expect(page.getByRole("alert")).toContainText("관능적·에로틱 연출은 가상 성인 사람");
  await expect(page.getByRole("button", { name: "3개 후보 생성" })).toBeDisabled();
  await page.getByLabel("등장 주체").selectOption("human");
  await expect(page.getByLabel("인종·민족 표현", { exact: true })).toHaveValue("east_asian");
  await expect(page.getByLabel("국가·문화권", { exact: true })).toHaveValue("south_korea");
  await expect(page.getByLabel("인물 직업·유형", { exact: true })).toHaveValue("office_worker");
});

test("adult non-graphic sensual styling can be submitted with lingerie", async ({ page }) => {
  let submitted: { brief: typeof brief } | null = null;
  await page.route("**/api/image-batches", async (route) => {
    submitted = route.request().postDataJSON() as { brief: typeof brief };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: { ...partialBatch, status: "failed", variants: [variant(0, "failed"), variant(1, "failed"), variant(2, "failed")] } }) });
  });
  await page.goto("/real");
  await page.getByLabel("복장").selectOption("lingerie");
  await page.getByLabel("장면과 행동").fill("A fictional adult age 20+ uses sensual and erotic non-graphic lingerie styling.");
  await page.locator(".image-batch-consent input").check();
  await expect(page.getByRole("button", { name: "3개 후보 생성" })).toBeEnabled();
  await page.getByRole("button", { name: "3개 후보 생성" }).click();
  await expect.poll(() => submitted?.brief.wardrobe).toBe("lingerie");
});

test("erotic school-inspired styling is disabled with an actionable message", async ({ page }) => {
  await page.goto("/real");
  await page.getByLabel("복장").selectOption("school_inspired");
  await page.getByLabel("장면과 행동").fill("A fictional adult age 20+ poses sensually in school-inspired fashion.");
  await page.locator(".image-batch-consent input").check();
  await expect(page.getByRole("alert")).toContainText("교복풍 의상은 관능적·에로틱 연출과 함께 사용할 수 없습니다");
  await expect(page.getByRole("button", { name: "3개 후보 생성" })).toBeDisabled();
});
