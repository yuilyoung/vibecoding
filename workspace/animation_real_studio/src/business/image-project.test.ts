import assert from "node:assert/strict";
import test from "node:test";
import type { ImageBatch } from "./image-batch.ts";
import { createDefaultImageProjectDraft, createPersonalImageProject, projectMatchesSelection, resolveSelectedImage, selectedImageMatches, validateImageProjectDraft } from "./image-project.ts";
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
  assert.equal(project.variantId, "batch-0001-variant-2");
  assert.equal(project.selectionRevision, 2);
  assert.equal(project.createdAt, "2026-08-13T01:00:00.000Z");
  assert.equal(projectMatchesSelection(project, batch), true);
  assert.equal(selectedImageMatches(completedBatch(), batch), true);
  batch.selection = { ...batch.selection!, revision: 3 };
  assert.equal(projectMatchesSelection(project, batch), false);
  assert.equal(selectedImageMatches(completedBatch(), batch), false);
});

test("local project repository stores metadata without copying image bytes", async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const repository = new LocalImageProjectRepository(storage);
  const project = createPersonalImageProject(completedBatch(), { title: "나의 숏폼", purpose: "social_short", creativeIntent: "선택한 이미지를 9:16 숏폼의 첫 장면으로 발전시킨다." }, new Date("2026-08-13T01:00:00.000Z"));
  await repository.save(project);
  assert.deepEqual(await repository.get("batch-0001"), project);
  const serialized = [...values.values()][0];
  assert.equal(serialized.includes("data:image"), false);
  assert.equal(serialized.includes("asset-2"), false);
  values.set("animation-real-studio.image-project.batch-0001", "{");
  assert.equal(await repository.get("batch-0001"), null);
});
