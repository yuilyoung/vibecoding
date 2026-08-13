import assert from "node:assert/strict";
import test from "node:test";
import { IMAGE_BATCH_STORY_MAX_LENGTH } from "./business/image-batch-domain.mjs";
import { ImageBatchService } from "./business/image-batch-service.mjs";
import { StudioPhotoProjectAdapter } from "./data/studio-photo-project-adapter.mjs";
import { PHOTO_DETAIL_PROMPT_MAX_LENGTH, StudioService } from "./studio-service.mjs";

test("StudioPhotoProjectAdapter implements the image project gateway without remapping sensitive payloads", async () => {
  const calls = [];
  const project = { id: "photo-0001", status: "queued" };
  const studioService = {
    createPhotorealisticProject(draft) { calls.push(["create", draft]); return { ok: true, status: 202, project }; },
    getPhotorealisticProject(id) { calls.push(["get", id]); return { ok: true, status: 200, project }; },
  };
  const adapter = new StudioPhotoProjectAdapter(studioService);
  const draft = { clientRequestId: "adapter-contract-0001", referenceImage: { mimeType: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgo=" } };
  assert.deepEqual(await adapter.createVariant(draft), { ok: true, status: 202, project });
  assert.deepEqual(await adapter.getVariant("photo-0001"), { ok: true, status: 200, project });
  assert.equal(calls[0][1], draft);
  assert.deepEqual(calls.map((call) => call[0]), ["create", "get"]);
});

test("maximum public story length stays valid through every domain-to-Studio variant", async () => {
  const studioService = new StudioService({
    schedule() {},
    headlessImageProvider: {
      status() { return { enabled: true, provider: "boundary-stub", mode: "test", notice: "test only" }; },
      async generateUserImage() { throw new Error("scheduled provider work must not run in this boundary test"); },
    },
  });
  const service = new ImageBatchService({ imageProjectGateway: new StudioPhotoProjectAdapter(studioService) });
  const result = await service.createBatch({
    protocolVersion: "image-batch.v1",
    variantCount: 3,
    clientRequestId: "adapter-boundary-0001",
    rightsAccepted: true,
    brief: {
      subjectKind: "human",
      subjectDetail: "fictional_adult",
      ethnicity: "east_asian",
      country: "south_korea",
      era: "historical",
      weather: "storm",
      environment: "studio",
      cameraAngle: "three_quarter",
      lighting: "soft_daylight",
      mood: "mysterious",
      perspective: "second_person",
      wardrobe: "micro_bikini",
      profession: "kpop_idol",
      story: `A fictional adult age 20+. ${"x".repeat(IMAGE_BATCH_STORY_MAX_LENGTH)}`.slice(0, IMAGE_BATCH_STORY_MAX_LENGTH),
    },
  });

  assert.equal(result.status, 202);
  assert.equal(result.batch.variants.length, 3);
  assert.ok(result.batch.variants.every((variant) => variant.status === "queued"));
  const detailPrompts = [...studioService.photorealisticProjects.values()].map((project) => project.detailPrompt);
  assert.equal(detailPrompts.length, 3);
  assert.ok(detailPrompts.every((prompt) => prompt.length <= PHOTO_DETAIL_PROMPT_MAX_LENGTH));
  assert.ok(detailPrompts.every((prompt) => prompt.length >= IMAGE_BATCH_STORY_MAX_LENGTH));
  assert.ok(detailPrompts.every((prompt) => prompt.includes("East Asian; South Korea; Fictional K-pop idol; Adult micro bikini; opaque, non-explicit coverage")));
});

test("animal and bird pronouns remain valid through the Batch-to-Studio adapter", async () => {
  const studioService = new StudioService({
    schedule() {},
    headlessImageProvider: {
      status() { return { enabled: true, provider: "boundary-stub", mode: "test", notice: "test only" }; },
      async generateUserImage() { throw new Error("scheduled provider work must not run in this boundary test"); },
    },
  });
  const service = new ImageBatchService({ imageProjectGateway: new StudioPhotoProjectAdapter(studioService) });
  for (const [index, subject] of [
    { subjectKind: "bird", subjectDetail: "songbird", story: "They fly over an original forest at dawn with calm cinematic light." },
    { subjectKind: "animal", subjectDetail: "dog", story: "A dog watches her ball beside an original cabin in soft daylight." },
  ].entries()) {
    const result = await service.createBatch({
      protocolVersion: "image-batch.v1",
      variantCount: 1,
      clientRequestId: `adapter-nonhuman-pronoun-${index}`,
      rightsAccepted: true,
      brief: {
        subjectKind: subject.subjectKind,
        subjectDetail: subject.subjectDetail,
        era: "contemporary",
        weather: "clear",
        environment: subject.subjectKind === "bird" ? "forest" : "interior",
        cameraAngle: "eye_level",
        lighting: "soft_daylight",
        mood: "calm",
        perspective: "third_person",
        wardrobe: "none",
        profession: "none",
        story: subject.story,
      },
    });
    assert.equal(result.status, 202);
    assert.equal(result.batch.variants.length, 1);
    assert.equal(result.batch.brief.ethnicity, "not_applicable");
    assert.equal(result.batch.brief.country, "not_applicable");
  }
});
