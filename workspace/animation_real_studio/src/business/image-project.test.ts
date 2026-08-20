import assert from "node:assert/strict";
import test from "node:test";
import type { ImageBatch } from "./image-batch.ts";
import {
  IMAGE_PROJECT_PROTOCOL,
  changeImageProjectPurpose,
  createDefaultImageProjectDraft,
  createImageProjectWorkDraft,
  createPersonalImageProject,
  deriveImageProjectProgress,
  projectMatchesSelection,
  resolveSelectedImage,
  selectedImageMatches,
  updateImageProjectNote,
  updateImageProjectWorkItem,
  updatePersonalImageProjectDetails,
  updatePersonalImageProjectWork,
  validateImageProjectDraft,
  validateImageProjectWorkDraft,
} from "./image-project.ts";
import { LocalImageProjectRepository } from "../data/local-image-project-repository.ts";

const completedBatch = (): ImageBatch => ({
  id: "batch-0001",
  protocolVersion: "image-batch.v1",
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:01.000Z",
  status: "completed",
  brief: { subjectKind: "human", subjectDetail: "fictional_adult", age: "adult_30s", presentation: "unspecified", ethnicity: "east_asian", country: "south_korea", peopleCount: "one", era: "contemporary", weather: "rain", environment: "city", cameraAngle: "three_quarter", framing: "upper_body", lighting: "neon_night", mood: "dramatic", perspective: "third_person", wardrobe: "casual", profession: "kpop_idol", story: "A fictional adult performs in an original rainy city scene with cinematic light." },
  outputPlan: { kind: "still", frameCount: 1 },
  variantCount: 3,
  variants: [0, 1, 2].map((index) => ({ id: `batch-0001-variant-${index + 1}`, index, treatment: `Treatment ${index + 1}`, projectId: `photo-${index + 1}`, status: "completed", progress: 100, phase: "completed", delivery: { asset: { id: `asset-${index + 1}`, dataUri: `data:image/png;base64,asset-${index + 1}` } }, error: null })),
  selection: { variantId: "batch-0001-variant-2", revision: 2, selectedAt: "2026-08-13T00:00:01.000Z" },
});

test("selected image resolution requires a completed delivered variant", () => {
  const batch = completedBatch();
  const selected = resolveSelectedImage(batch);
  assert.equal(selected.ok, true);
  if (selected.ok) {
    assert.equal(selected.variant.id, "batch-0001-variant-2");
    assert.equal(selected.revision, 2);
  }
  assert.deepEqual(resolveSelectedImage({ ...batch, selection: null }), { ok: false, reason: "selection_missing" });
  const unavailable = completedBatch();
  unavailable.variants[1] = { ...unavailable.variants[1], status: "failed", delivery: null };
  assert.deepEqual(resolveSelectedImage(unavailable), { ok: false, reason: "variant_unavailable" });
  const missingDelivery = completedBatch();
  missingDelivery.variants[1] = { ...missingDelivery.variants[1], delivery: null };
  assert.deepEqual(resolveSelectedImage(missingDelivery), { ok: false, reason: "delivery_unavailable" });
});

test("personal project is validated and bound to the current selection revision", () => {
  const batch = completedBatch();
  const draft = createDefaultImageProjectDraft(batch);
  assert.equal(draft.purpose, "social_short");
  assert.equal(draft.creativeIntent, batch.brief.story);
  assert.deepEqual(validateImageProjectDraft({ ...draft, title: "x" }), ["프로젝트 이름은 2~60자로 입력해 주세요."]);
  assert.deepEqual(validateImageProjectDraft({ ...draft, creativeIntent: "short" }), ["창작 의도는 10~280자로 입력해 주세요."]);
  const project = createPersonalImageProject(batch, { ...draft, title: "나의 K-Pop 캠페인", purpose: "campaign_visual" }, new Date("2026-08-13T01:00:00.000Z"));
  assert.equal(project.protocolVersion, IMAGE_PROJECT_PROTOCOL);
  assert.equal(project.variantId, "batch-0001-variant-2");
  assert.equal(project.selectionRevision, 2);
  assert.equal(project.createdAt, "2026-08-13T01:00:00.000Z");
  assert.deepEqual(project.workItems.map(({ id, status, note }) => ({ id, status, note })), [
    { id: "campaign-copy", status: "todo", note: "" },
    { id: "campaign-layouts", status: "todo", note: "" },
    { id: "campaign-channels", status: "todo", note: "" },
  ]);
  assert.equal(projectMatchesSelection(project, batch), true);
  assert.equal(selectedImageMatches(completedBatch(), batch), true);
  batch.selection = { ...batch.selection!, revision: 3 };
  assert.equal(projectMatchesSelection(project, batch), false);
  assert.equal(selectedImageMatches(completedBatch(), batch), false);
});

test("project work is changed through validated Business updates and derives the next action", () => {
  const batch = completedBatch();
  const project = createPersonalImageProject(batch, {
    title: "실제 작업 보드",
    purpose: "social_short",
    creativeIntent: "선택한 이미지를 세 장면의 세로형 숏폼으로 구체화한다.",
  }, new Date("2026-08-13T01:00:00.000Z"));
  let workDraft = createImageProjectWorkDraft(project);
  assert.deepEqual(deriveImageProjectProgress(workDraft.workItems), {
    completed: 0,
    total: 3,
    percent: 0,
    nextAction: workDraft.workItems[0],
    state: "not_started",
  });

  workDraft = updateImageProjectWorkItem(workDraft, "social-hook", { status: "in_progress", note: " 첫 3초에 우산을 여는 동작을 배치한다. " }, project.purpose);
  workDraft = updateImageProjectWorkItem(workDraft, "social-shots", { status: "done", note: "와이드 → 상반신 → 손 디테일" }, project.purpose);
  workDraft = updateImageProjectNote(workDraft, " 네온 색 대비를 세 작업에 공통 적용한다. ", project.purpose);
  const progress = deriveImageProjectProgress(workDraft.workItems);
  assert.equal(progress.completed, 1);
  assert.equal(progress.percent, 33);
  assert.equal(progress.nextAction?.id, "social-hook");
  assert.equal(progress.state, "in_progress");

  const saved = updatePersonalImageProjectWork(project, batch, workDraft, new Date("2026-08-13T02:00:00.000Z"));
  assert.equal(saved.workItems[0].note, "첫 3초에 우산을 여는 동작을 배치한다.");
  assert.equal(saved.projectNote, "네온 색 대비를 세 작업에 공통 적용한다.");
  assert.equal(saved.updatedAt, "2026-08-13T02:00:00.000Z");
  assert.throws(() => updateImageProjectWorkItem(workDraft, "unknown", { status: "done" }, project.purpose), /찾을 수 없습니다/);
  assert.deepEqual(validateImageProjectWorkDraft(project.purpose, { ...workDraft, workItems: workDraft.workItems.slice(0, 2) }), ["프로젝트 작업은 목적별 기본 3개를 유지해야 합니다."]);
});

test("purpose changes require confirmation and reset only the purpose work items", () => {
  const batch = completedBatch();
  const baseProject = {
    ...createPersonalImageProject(batch, {
      title: "목적 변경 프로젝트",
      purpose: "social_short" as const,
      creativeIntent: "목적 변경 시 작업 초기화 경계를 검증하는 프로젝트다.",
    }),
    projectNote: "목적과 무관한 공통 메모",
  };
  const workedDraft = updateImageProjectWorkItem(createImageProjectWorkDraft(baseProject), "social-hook", { status: "in_progress", note: "초기화되어야 하는 작업 메모" }, baseProject.purpose);
  const project = updatePersonalImageProjectWork(baseProject, batch, workedDraft);
  const changedDraft = changeImageProjectPurpose({
    title: project.title,
    purpose: project.purpose,
    creativeIntent: project.creativeIntent,
  }, "portfolio_piece");
  assert.throws(() => updatePersonalImageProjectDetails(project, batch, changedDraft, false), /초기화됨을 확인/);
  const updated = updatePersonalImageProjectDetails(project, batch, changedDraft, true, new Date("2026-08-13T03:00:00.000Z"));
  assert.equal(updated.purpose, "portfolio_piece");
  assert.equal(updated.workItems[0].id, "portfolio-statement");
  assert.equal(updated.workItems.every((item) => item.status === "todo" && item.note === ""), true);
  assert.equal(updated.projectNote, "목적과 무관한 공통 메모");
});

test("local project repository stores metadata without copying image bytes", async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const repository = new LocalImageProjectRepository(storage);
  const project = createPersonalImageProject(completedBatch(), { title: "나의 숏폼", purpose: "social_short", creativeIntent: "선택한 이미지를 9:16 숏폼의 첫 장면으로 발전시킨다." }, new Date("2026-08-13T01:00:00.000Z"));
  const saved = await repository.save({ ...project, dataUri: "data:image/png;base64,do-not-store", asset: { id: "asset-2" } });
  assert.deepEqual(await repository.get("batch-0001"), project);
  const serialized = [...values.values()][0];
  assert.equal(serialized.includes("data:image"), false);
  assert.equal(serialized.includes("asset-2"), false);
  project.workItems[0].note = "caller mutation";
  assert.equal(saved.workItems[0].note, "");
  saved.workItems[0].note = "returned mutation";
  assert.equal((await repository.get("batch-0001"))?.workItems[0].note, "");

  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(repository.save(createPersonalImageProject(completedBatch(), { title: "취소 테스트", purpose: "social_short", creativeIntent: "취소된 저장은 브라우저 세션을 변경하지 않아야 한다." }), cancelled.signal), { name: "AbortError" });
  values.set("animation-real-studio.image-project.batch-0001", "{");
  assert.equal(await repository.get("batch-0001"), null);
});

test("local repository migrates valid v1 projects in memory and rejects malformed v2 data", async () => {
  const key = "animation-real-studio.image-project.batch-0001";
  const current = createPersonalImageProject(completedBatch(), {
    title: "이전 프로젝트 복구",
    purpose: "campaign_visual",
    creativeIntent: "기존 메타데이터를 실제 작업 보드로 안전하게 이어 간다.",
  }, new Date("2026-08-13T01:00:00.000Z"));
  const { workItems: _workItems, projectNote: _projectNote, ...legacyFields } = current;
  const legacy = { ...legacyFields, protocolVersion: "image-project.v1", dataUri: "data:image/png;base64,do-not-copy" };
  const values = new Map<string, string>([[key, JSON.stringify(legacy)]]);
  const storage = { getItem: (storageKey: string) => values.get(storageKey) ?? null, setItem: (storageKey: string, value: string) => { values.set(storageKey, value); } };
  const repository = new LocalImageProjectRepository(storage);

  const migrated = await repository.get("batch-0001");
  assert.equal(migrated?.protocolVersion, IMAGE_PROJECT_PROTOCOL);
  assert.equal(migrated?.workItems.length, 3);
  assert.equal(migrated?.workItems[0].id, "campaign-copy");
  assert.equal(migrated?.projectNote, "");
  assert.equal(values.get(key)?.includes('"image-project.v1"'), true, "read-only migration must not rewrite storage");

  await repository.save(migrated!);
  assert.equal(values.get(key)?.includes('"image-project.v2"'), true);
  assert.equal(values.get(key)?.includes("data:image"), false);

  const malformed = { ...migrated, workItems: migrated!.workItems.slice(1) };
  values.set(key, JSON.stringify(malformed));
  assert.equal(await repository.get("batch-0001"), null);
  values.set(key, JSON.stringify({ ...migrated, protocolVersion: "image-project.v9" }));
  assert.equal(await repository.get("batch-0001"), null);
  values.set(key, JSON.stringify({ ...migrated, createdAt: "August 20, 2026" }));
  assert.equal(await repository.get("batch-0001"), null);
  values.set(key, JSON.stringify({ ...migrated, updatedAt: "2026/08/20" }));
  assert.equal(await repository.get("batch-0001"), null);
  values.set(key, JSON.stringify({ ...migrated, updatedAt: "2026-02-30T00:00:00.000Z" }));
  assert.equal(await repository.get("batch-0001"), null);
});
