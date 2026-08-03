import assert from "node:assert/strict";
import test from "node:test";
import { StudioService } from "./studio-service.mjs";

const validRequest = { scene: "A commuter pauses at a rain-soaked station, then gives a hand-written apology to a friend before the final train departs.", sourceRelationship: "original", rightsAccepted: true, direction: "rainy-station" };
test("creates a local preflight record with a fixed 15-second vertical storyboard", () => { const result = new StudioService().createProject(validRequest); assert.equal(result.status, 201); assert.equal(result.project.status, "local_preflight_ready"); assert.equal(result.project.localPrecheck.status, "not_a_policy_decision"); assert.equal(result.project.storyboard.seconds, 15); assert.equal(result.project.storyboard.format, "1080x1920"); });
test("does not queue inspired material without rights review", () => { const service = new StudioService(); const created = service.createProject({ ...validRequest, sourceRelationship: "inspired" }); assert.equal(created.project.status, "review_required"); assert.equal(service.approveStoryboard(created.project.id).status, 409); });
test("blocks obvious protected-work, copied-scene, and real-person requests in local precheck", () => { const service = new StudioService(); for (const scene of ["원피스 루피가 등장하는 장면을 정확하게 재현해 줘. 카메라는 원작과 똑같이 움직인다.", "유명인 얼굴과 목소리로 실제 인터뷰 장면을 만들어 줘. 현실의 인물을 그대로 재현한다."]) { const result = service.createProject({ ...validRequest, scene }); assert.equal(result.status, 422); assert.equal(result.errors[0].field, "scene"); } });
test("stores reference input only as unverified metadata", () => { const result = new StudioService().createProject({ ...validRequest, referenceMedia: { name: "street-light.jpg", mimeType: "image/jpeg", purpose: "lighting" } }); assert.equal(result.status, 201); assert.equal(result.project.referenceMedia.transfer, "metadata_only"); assert.equal(result.project.referenceMedia.screening, "not_performed"); });
test("completes an original project with four fixed local 2D preview stills", () => {
  const scheduled = [];
  const service = new StudioService({ schedule: (work) => scheduled.push(work) });
  const created = service.createProject({ ...validRequest, referenceMedia: { name: "street-light.jpg", mimeType: "image/jpeg", purpose: "lighting" } });
  assert.equal(service.approveStoryboard(created.project.id).status, 202);
  const queued = service.getProject(created.project.id).project;
  assert.equal(queued.status, "queued");
  assert.equal(queued.job.status, "queued");
  assert.equal(queued.job.progress, 0);
  scheduled.shift()();
  const inProgress = service.getProject(created.project.id).project;
  assert.equal(inProgress.status, "in_progress");
  assert.equal(inProgress.job.status, "in_progress");
  assert.equal(inProgress.job.progress, 58);
  scheduled.shift()();
  const project = service.getProject(created.project.id).project;
  assert.equal(project.status, "completed");
  assert.equal(project.job.status, "completed");
  assert.equal(project.job.progress, 100);
  assert.equal(project.delivery.mode, "local_2d_preview");
  assert.equal(project.delivery.assets.length, 4);
  for (const asset of project.delivery.assets) {
    assert.equal(asset.kind, "local_2d_preview");
    assert.equal(asset.origin, "fixed_local_template");
    assert.equal(asset.generatedByAi, false);
    assert.equal(asset.mimeType, "image/svg+xml");
    assert.equal(asset.width, 1080);
    assert.equal(asset.height, 1920);
    assert.equal(asset.aspectRatio, "9:16");
    assert.equal(typeof asset.captionDraft, "string");
    const markup = decodeURIComponent(asset.dataUri.split(",", 2)[1]);
    assert.equal(markup.includes(validRequest.scene), false);
    assert.equal(markup.includes("street-light.jpg"), false);
  }
});