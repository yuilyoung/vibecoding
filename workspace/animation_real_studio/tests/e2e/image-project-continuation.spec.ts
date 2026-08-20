import { expect, test } from "@playwright/test";

const svgAsset = (id: string) => ({
  id,
  dataUri: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640"><rect width="360" height="640" fill="#1f3858"/><circle cx="180" cy="230" r="90" fill="#d7ff62"/><text x="180" y="500" text-anchor="middle" fill="white">${id}</text></svg>`)}`,
  mimeType: "image/svg+xml",
  width: 360,
  height: 640,
});

const brief = {
  subjectKind: "human", subjectDetail: "fictional_adult", age: "adult_30s", presentation: "feminine", ethnicity: "east_asian", country: "south_korea", peopleCount: "one",
  era: "contemporary", weather: "rain", environment: "city", cameraAngle: "three_quarter", framing: "upper_body", lighting: "neon_night", mood: "dramatic", perspective: "third_person",
  wardrobe: "casual", profession: "kpop_idol", story: "A fictional adult K-Pop performer begins an original rainy city campaign at night.",
};

const completedVariants = [0, 1, 2].map((index) => ({
  id: `batch-0001-variant-${index + 1}`, index, treatment: `Treatment ${index + 1}`, projectId: `photo-${index + 1}`,
  status: "completed", progress: 100, phase: "completed", delivery: { asset: svgAsset(`selected-${index + 1}`) }, error: null,
}));

const batch = (selection: null | { variantId: string; revision: number; selectedAt: string } = null) => ({
  id: "batch-0001", protocolVersion: "image-batch.v1", createdAt: "2026-08-13T00:00:00.000Z", updatedAt: "2026-08-13T00:00:01.000Z",
  status: "completed", brief, outputPlan: { kind: "still", frameCount: 1 }, variantCount: 3, variants: completedVariants, selection,
});

test("three generated candidates continue into a concrete personal project", async ({ page }) => {
  let currentSelection: ReturnType<typeof batch>["selection"] = null;
  await page.route("**/api/image-batches", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: batch() }) }));
  await page.route("**/api/image-batches/batch-0001", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: batch(currentSelection) }) }));
  await page.route("**/api/image-batches/batch-0001/selection", async (route) => {
    const { variantId } = route.request().postDataJSON() as { variantId: string };
    currentSelection = { variantId, revision: 1, selectedAt: "2026-08-13T00:00:02.000Z" };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: batch(currentSelection) }) });
  });

  await page.goto("/real");
  await page.locator(".image-batch-consent input").check();
  await page.locator("form.photo-studio button[type=submit]").click();
  await expect(page.locator(".image-variant-card")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "이 이미지로 프로젝트 시작" })).toHaveCount(0);

  await page.locator(".image-variant-card").nth(1).locator("button").click();
  const continueButton = page.getByRole("button", { name: /이 이미지로 프로젝트 시작/ });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();

  await expect(page).toHaveURL(/\/image-projects\/batch-0001$/);
  await expect(page.getByAltText("프로젝트 기준으로 선택한 이미지")).toBeVisible();
  await expect(page.getByText("SELECTED · REVISION 1")).toBeVisible();
  await page.getByLabel("프로젝트 이름").fill("나의 K-Pop 비주얼 프로젝트");
  await page.getByRole("button", { name: /캠페인 비주얼/ }).click();
  await page.getByLabel("창작 의도").fill("선택한 이미지를 여름 브랜드 캠페인의 대표 비주얼과 파생 숏폼으로 발전시킨다.");
  await page.getByRole("button", { name: "나만의 프로젝트 만들기" }).click();

  await expect(page.getByRole("heading", { name: "나의 K-Pop 비주얼 프로젝트", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "캠페인 비주얼" })).toBeVisible();
  await expect(page.getByText("K-Pop 아이돌", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "핵심 카피 한 줄 확정" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "이제 프로젝트를 실제로 진행하세요." })).toBeVisible();
  await expect(page.locator(".image-project-work-card")).toHaveCount(3);
  await expect(page.getByText("0%", { exact: true })).toBeVisible();
  await expect(page.locator("[data-setting]")).toHaveCount(20);
  for (const setting of ["story", "subjectKind", "subjectDetail", "age", "presentation", "peopleCount", "ethnicity", "country", "profession", "wardrobe", "era", "environment", "weather", "mood", "cameraAngle", "framing", "perspective", "lighting", "outputKind", "frameCount"]) await expect(page.locator(`[data-setting="${setting}"]`)).toBeVisible();
  const firstWork = page.locator(".image-project-work-card").nth(0);
  await firstWork.getByRole("button", { name: "진행 중" }).click();
  await firstWork.getByLabel("핵심 카피 한 줄 확정 작업 메모").fill("첫 문장은 여름밤의 선택을 강조한다.");
  await page.locator(".image-project-work-card").nth(1).getByRole("button", { name: "완료" }).click();
  await page.getByLabel("프로젝트 전체 메모").fill("모든 파생 규격에서 네온 색 대비를 유지한다.");
  await page.getByRole("button", { name: "작업 보드 저장" }).click();
  await expect(page.getByRole("status")).toContainText("브라우저 세션에 저장");
  await expect(page.getByText("33%", { exact: true })).toBeVisible();
  await expect(page.locator(".image-project-next-action")).toContainText("핵심 카피 한 줄 확정");

  await page.reload();
  await expect(page.getByLabel("핵심 카피 한 줄 확정 작업 메모")).toHaveValue("첫 문장은 여름밤의 선택을 강조한다.");
  await expect(page.getByLabel("프로젝트 전체 메모")).toHaveValue("모든 파생 규격에서 네온 색 대비를 유지한다.");
  await expect(page.locator(".image-project-work-card").nth(0).getByRole("button", { name: "진행 중" })).toHaveAttribute("aria-pressed", "true");
  const stored = await page.evaluate(() => sessionStorage.getItem("animation-real-studio.image-project.batch-0001"));
  expect(stored).toContain('"protocolVersion":"image-project.v2"');
  expect(stored).toContain('"selectionRevision":1');
  expect(stored).toContain('"status":"in_progress"');
  expect(stored).not.toContain("data:image");
});

test("project save blocks a stale selection and requires confirmation of the latest image", async ({ page }) => {
  const first = { variantId: "batch-0001-variant-1", revision: 1, selectedAt: "2026-08-13T00:00:02.000Z" };
  const latest = { variantId: "batch-0001-variant-3", revision: 2, selectedAt: "2026-08-13T00:00:03.000Z" };
  let currentSelection = first;
  await page.route("**/api/image-batches/batch-0001", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: batch(currentSelection) }) });
  });
  await page.goto("/image-projects/batch-0001");
  await expect(page.getByLabel("프로젝트 이름")).toBeVisible();
  currentSelection = latest;
  await page.getByLabel("프로젝트 이름").fill("선택 변경 검증 프로젝트");
  await page.getByRole("button", { name: "나만의 프로젝트 만들기" }).click();
  await expect(page.getByRole("alert")).toContainText("이미지 선택이 변경되었습니다");
  await expect(page.getByText("SELECTED · REVISION 2")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("animation-real-studio.image-project.batch-0001"))).toBeNull();

  await page.getByRole("button", { name: "나만의 프로젝트 만들기" }).click();
  await expect(page.getByRole("heading", { name: "선택 변경 검증 프로젝트", level: 1 })).toBeVisible();
  const stored = await page.evaluate(() => sessionStorage.getItem("animation-real-studio.image-project.batch-0001"));
  expect(stored).toContain('"variantId":"batch-0001-variant-3"');
  expect(stored).toContain('"selectionRevision":2');
});

test("direct project entry without a selected candidate is actionable", async ({ page }) => {
  await page.route("**/api/image-batches/batch-0001", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: batch() }) }));
  await page.goto("/image-projects/batch-0001");
  await expect(page.getByRole("alert")).toContainText("완료된 후보 하나를 선택");
  await expect(page.getByRole("button", { name: "새 이미지 생성" })).toBeVisible();
});

test("legacy project opens as a v2 workboard and purpose reset requires confirmation", async ({ page }) => {
  const selection = { variantId: "batch-0001-variant-1", revision: 1, selectedAt: "2026-08-13T00:00:02.000Z" };
  await page.route("**/api/image-batches/batch-0001", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: batch(selection) }) }));
  await page.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), {
    key: "animation-real-studio.image-project.batch-0001",
    value: JSON.stringify({
      protocolVersion: "image-project.v1",
      batchId: "batch-0001",
      variantId: "batch-0001-variant-1",
      selectionRevision: 1,
      title: "기존 캠페인 프로젝트",
      purpose: "campaign_visual",
      creativeIntent: "기존 프로젝트를 작업 가능한 세션 보드로 안전하게 전환한다.",
      createdAt: "2026-08-13T00:00:03.000Z",
      updatedAt: "2026-08-13T00:00:03.000Z",
    }),
  });
  await page.goto("/image-projects/batch-0001");
  await expect(page.locator(".image-project-work-card")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "핵심 카피 한 줄 확정" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("animation-real-studio.image-project.batch-0001"))).toContain("image-project.v1");

  await page.getByLabel("프로젝트 전체 메모").fill("목적이 바뀌어도 보존할 공통 메모");
  await page.getByRole("button", { name: "작업 보드 저장" }).click();
  expect(await page.evaluate(() => sessionStorage.getItem("animation-real-studio.image-project.batch-0001"))).toContain("image-project.v2");

  await page.getByRole("button", { name: "기획 수정" }).click();
  await page.getByRole("button", { name: /개인 포트폴리오/ }).click();
  const detailsSave = page.getByRole("button", { name: "기획과 작업 계획 저장" });
  await expect(detailsSave).toBeDisabled();
  await page.getByLabel(/사용 목적을 바꾸면/).check();
  await expect(detailsSave).toBeEnabled();
  await detailsSave.click();
  await expect(page.getByRole("heading", { name: "작품 소개문 다듬기" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "핵심 카피 한 줄 확정" })).toHaveCount(0);
  await expect(page.getByLabel("프로젝트 전체 메모")).toHaveValue("목적이 바뀌어도 보존할 공통 메모");
  await expect(page.getByText("0%", { exact: true })).toBeVisible();
});

test("workboard save rejects a changed selection without overwriting the project", async ({ page }) => {
  const first = { variantId: "batch-0001-variant-1", revision: 1, selectedAt: "2026-08-13T00:00:02.000Z" };
  const latest = { variantId: "batch-0001-variant-3", revision: 2, selectedAt: "2026-08-13T00:00:03.000Z" };
  let currentSelection = first;
  await page.route("**/api/image-batches/batch-0001", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: batch(currentSelection) }) }));
  const storedProject = {
    protocolVersion: "image-project.v2",
    batchId: "batch-0001",
    variantId: "batch-0001-variant-1",
    selectionRevision: 1,
    title: "선택 경쟁 작업 보드",
    purpose: "social_short",
    creativeIntent: "작업 저장 직전 이미지 선택 revision을 다시 확인한다.",
    workItems: [
      { id: "social-hook", title: "3초 훅과 첫 프레임 확정", status: "todo", note: "" },
      { id: "social-shots", title: "3개 숏의 장면 순서 작성", status: "todo", note: "" },
      { id: "social-motion", title: "9:16 모션·자막 점검", status: "todo", note: "" },
    ],
    projectNote: "",
    createdAt: "2026-08-13T00:00:03.000Z",
    updatedAt: "2026-08-13T00:00:03.000Z",
  };
  await page.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), {
    key: "animation-real-studio.image-project.batch-0001",
    value: JSON.stringify(storedProject),
  });
  await page.goto("/image-projects/batch-0001");
  await page.locator(".image-project-work-card").first().getByRole("button", { name: "진행 중" }).click();
  currentSelection = latest;
  await page.getByRole("button", { name: "작업 보드 저장" }).click();
  await expect(page.getByRole("alert")).toContainText("이미지 선택이 변경되었습니다");
  await expect(page.getByText("SELECTED · REVISION 2")).toBeVisible();
  const stored = await page.evaluate(() => sessionStorage.getItem("animation-real-studio.image-project.batch-0001"));
  expect(stored).toBe(JSON.stringify(storedProject));
});

test("workboard locks edits and cancels persistence when the page unmounts during save", async ({ page }) => {
  const selection = { variantId: "batch-0001-variant-1", revision: 1, selectedAt: "2026-08-13T00:00:02.000Z" };
  let batchReads = 0;
  await page.route("**/api/image-batches/batch-0001", async (route) => {
    batchReads += 1;
    if (batchReads > 1) await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: batch(selection) }) });
    } catch {
      // The save-time fetch is expected to be aborted when the project route unmounts.
    }
  });
  const storedProject = {
    protocolVersion: "image-project.v2",
    batchId: "batch-0001",
    variantId: "batch-0001-variant-1",
    selectionRevision: 1,
    title: "저장 수명 테스트",
    purpose: "social_short",
    creativeIntent: "저장 중 화면을 벗어나면 세션 기록을 변경하지 않는다.",
    workItems: [
      { id: "social-hook", title: "3초 훅과 첫 프레임 확정", status: "todo", note: "" },
      { id: "social-shots", title: "3개 숏의 장면 순서 작성", status: "todo", note: "" },
      { id: "social-motion", title: "9:16 모션·자막 점검", status: "todo", note: "" },
    ],
    projectNote: "",
    createdAt: "2026-08-13T00:00:03.000Z",
    updatedAt: "2026-08-13T00:00:03.000Z",
  };
  await page.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), {
    key: "animation-real-studio.image-project.batch-0001",
    value: JSON.stringify(storedProject),
  });
  await page.goto("/image-projects/batch-0001");
  await page.getByLabel("프로젝트 전체 메모").fill("저장되면 안 되는 메모");
  const readsAfterLoad = batchReads;
  await page.getByRole("button", { name: "작업 보드 저장" }).click();
  await expect(page.getByRole("button", { name: "작업 보드 저장 중" })).toBeDisabled();
  await expect(page.getByLabel("프로젝트 전체 메모")).toBeDisabled();
  await expect(page.getByRole("button", { name: "기획 수정" })).toBeDisabled();
  await page.getByRole("button", { name: "Animation Real Studio 홈" }).click();
  await expect(page).toHaveURL("/");
  await page.waitForTimeout(500);
  expect(batchReads).toBe(readsAfterLoad + 1);
  expect(await page.evaluate(() => sessionStorage.getItem("animation-real-studio.image-project.batch-0001"))).toBe(JSON.stringify(storedProject));
});

test("personal project setup has no horizontal overflow at 390px", async ({ page }) => {
  const selection = { variantId: "batch-0001-variant-1", revision: 1, selectedAt: "2026-08-13T00:00:02.000Z" };
  await page.route("**/api/image-batches/batch-0001", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ batch: batch(selection) }) }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/image-projects/batch-0001");
  await expect(page.getByLabel("프로젝트 이름")).toBeVisible();
  await page.getByRole("button", { name: "나만의 프로젝트 만들기" }).click();
  await expect(page.locator(".image-project-board")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
