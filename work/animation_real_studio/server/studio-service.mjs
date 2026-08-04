import { HeadlessCodexImageProvider, HeadlessImageProviderError } from "./headless-image-provider.mjs";
import { randomUUID } from "node:crypto";
const ALLOWED_REFERENCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4"]);
const TERMINAL_STATUSES = new Set(["completed", "failed", "review_required"]);
const LOCAL_BLOCK_RULES = [
  { code: "copyrighted_work", pattern: /\b(one piece|luffy|naruto|pokemon|demon slayer|attack on titan)\b|원피스|루피|나루토|포켓몬|귀멸|진격의 거인/i },
  { code: "copied_scene", pattern: /(장면|대사).{0,40}(그대로|똑같이|정확하게).{0,24}(재현|복제)|\b(recreate|copy)\b.{0,40}\b(scene|dialogue)\b/i },
  { code: "real_person", pattern: /(실존|유명|연예인|공인|실제).{0,32}(인물|사람|얼굴|목소리)|\b(real person|public figure|celebrity)\b/i },
];

const text = (value) => typeof value === "string" ? value.trim() : "";
const issue = (field, message, code) => ({ field, message, code });

function localPrecheck(scene) {
  return LOCAL_BLOCK_RULES.filter((rule) => rule.pattern.test(scene)).map((rule) => rule.code);
}

function validate(input) {
  const scene = text(input.scene);
  const errors = [];
  if (scene.length < 30 || scene.length > 700) errors.push(issue("scene", "Scene must be between 30 and 700 characters.", "scene_length"));
  if (!['original', 'inspired', 'licensed'].includes(input.sourceRelationship)) errors.push(issue("sourceRelationship", "A source relationship is required.", "source_relationship"));
  if (input.rightsAccepted !== true) errors.push(issue("rightsAccepted", "Rights and safety acknowledgement is required.", "rights_acknowledgement"));
  const blockedRules = localPrecheck(scene);
  if (blockedRules.length) errors.push(issue("scene", "This local simulation cannot accept an obvious protected-work, copied-scene, or real-person request.", blockedRules.join(",")));
  if (input.referenceMedia) {
    const reference = input.referenceMedia;
    if (!ALLOWED_REFERENCE_TYPES.has(reference.mimeType)) errors.push(issue("referenceMedia.mimeType", "Only JPEG, PNG, WebP, or MP4 metadata is accepted.", "reference_mime"));
    if (!['setting', 'lighting', 'composition', 'movement'].includes(reference.purpose)) errors.push(issue("referenceMedia.purpose", "A permitted reference purpose is required.", "reference_purpose"));
    if (reference.containsPeople === true || reference.containsPersonalData === true) errors.push(issue("referenceMedia", "A caller-declared people or personal-data reference is not accepted.", "reference_declared_unsafe"));
  }
  return { scene, errors, blockedRules };
}

function storyboard(scene) {
  const source = scene.replace(/\s+/g, " ").slice(0, 160);
  return { format: "1080x1920", seconds: 15, captions: "ko", beats: [
    { start: "00:00", end: "00:02", label: "Hook", direction: "Open on the emotional change before dialogue.", source },
    { start: "00:02", end: "00:07", label: "Tension", direction: "Show a single original action and its consequence." },
    { start: "00:07", end: "00:11", label: "Turn", direction: "Shift the camera or lighting to reveal the decision." },
    { start: "00:11", end: "00:15", label: "Aftertaste", direction: "End on a clear original image, not a copied scene." },
  ] };
}

const LOCAL_PREVIEW_PALETTES = {
  "rainy-station": ["#11263f", "#6dc7ee", "#e9a16a"],
  "warm-room": ["#4b2a39", "#ffd07a", "#d9805e"],
  "fictional-set": ["#192d46", "#d7ff62", "#ff7a5c"],
};
const LOCAL_PREVIEW_CAPTIONS = [
  "비가 내려도, 마음은 먼저 도착한다.",
  "잠시 멈춘 사이, 말하지 못한 감정이 선명해진다.",
  "작은 선택이 장면의 빛을 바꾼다.",
  "마지막 순간에도, 서로를 향한 길은 남는다.",
];

function localPreviewDirection(direction) {
  return Object.hasOwn(LOCAL_PREVIEW_PALETTES, direction) ? direction : "rainy-station";
}

function createLocalPreviewAssets(direction, beats) {
  const [background, light, accent] = LOCAL_PREVIEW_PALETTES[localPreviewDirection(direction)];
  return beats.map((beat, index) => {
    const number = String(index + 1).padStart(2, "0");
    const subject = 220 + index * 125;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="' + background + '"/><circle cx="' + (250 + index * 110) + '" cy="420" r="360" fill="' + light + '" opacity=".38"/><path d="M0 1180 L1080 1020 V1920 H0Z" fill="#101722" opacity=".72"/><rect x="' + subject + '" y="880" width="132" height="400" rx="66" fill="#e8e2d7" opacity=".84"/><circle cx="' + (subject + 66) + '" cy="810" r="86" fill="' + accent + '" opacity=".86"/><rect x="66" y="70" width="948" height="1776" fill="none" stroke="#f7f2e8" stroke-width="4" opacity=".65"/><text x="96" y="142" fill="#f7f2e8" font-family="Arial,sans-serif" font-size="34" font-weight="700">LOCAL 2D PREVIEW / ' + number + '</text><text x="96" y="1735" fill="#f7f2e8" font-family="Arial,sans-serif" font-size="76" font-weight="700">' + beat.label.toUpperCase() + '</text><text x="96" y="1795" fill="#f7f2e8" font-family="Arial,sans-serif" font-size="25">FIXED TEMPLATE · NOT AI GENERATED · NO USER MEDIA</text></svg>';
    return {
      id: "local-still-" + number,
      kind: "local_2d_preview",
      origin: "fixed_local_template",
      generatedByAi: false,
      mimeType: "image/svg+xml",
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      beat: beat.label,
      captionDraft: LOCAL_PREVIEW_CAPTIONS[index],
      dataUri: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    };
  });
}
export class StudioService {
  constructor({ now = () => new Date(), renderDelayMs = 450, schedule = setTimeout, headlessImageProvider = new HeadlessCodexImageProvider(), createLocalCapabilityToken = randomUUID, maxHeadlessImageProbeAttempts = 3 } = {}) {
    this.now = now;
    this.renderDelayMs = renderDelayMs;
    this.schedule = schedule;
    this.headlessImageProvider = headlessImageProvider;
    this.localCapabilityToken = createLocalCapabilityToken();
    this.projects = new Map();
    this.sequence = 0;
    this.headlessImageSpike = null;
    this.maxHeadlessImageProbeAttempts = Number.isInteger(maxHeadlessImageProbeAttempts) && maxHeadlessImageProbeAttempts > 0 ? maxHeadlessImageProbeAttempts : 3;
    this.headlessImageProbeAllowanceUsed = 0;
    this.headlessImageProbeActiveAttemptId = null;
    this.headlessImageProbeHistory = [];
  }
  health() { return { status: "ok", provider: "local-template", mode: "local_2d_preview", message: "Local 2D previews remain the default. The optional headless image probe never receives project, reference-media, or user-prompt data.", headlessImageGeneration: this.headlessImageProvider.status() }; }
  createProject(input = {}) {
    const { errors, scene, blockedRules } = validate(input);
    if (errors.length) return { ok: false, status: 422, errors };
    const id = `local-${String(++this.sequence).padStart(4, "0")}`;
    const needsReview = input.sourceRelationship !== "original";
    const at = this.now().toISOString();
    const project = {
      id, createdAt: at, updatedAt: at, status: needsReview ? "review_required" : "local_preflight_ready", sourceRelationship: input.sourceRelationship, scene,
      direction: localPreviewDirection(input.direction),
      localPrecheck: { status: "not_a_policy_decision", outcome: needsReview ? "review_required" : "simulation_allowed", blockedRules, notice: "This is a narrow local text precheck and attestation record, not a rights, likeness, privacy, or media-safety approval." },
      referenceMedia: input.referenceMedia ? { name: text(input.referenceMedia.name).slice(0, 120), mimeType: input.referenceMedia.mimeType, purpose: input.referenceMedia.purpose, transfer: "metadata_only", screening: "not_performed" } : null,
      storyboard: storyboard(scene), job: null, delivery: null, audit: [{ at, event: needsReview ? "review_requested" : "local_preflight_created" }],
    };
    this.projects.set(id, project);
    return { ok: true, status: 201, project: this.snapshot(project) };
  }
  getProject(id) { const project = this.projects.get(id); return project ? { ok: true, status: 200, project: this.snapshot(project) } : { ok: false, status: 404, error: "Project not found." }; }
  approveStoryboard(id) {
    const project = this.projects.get(id);
    if (!project) return { ok: false, status: 404, error: "Project not found." };
    if (project.status === "review_required") return { ok: false, status: 409, error: "This source relationship requires rights review before a local preview." };
    if (project.status !== "local_preflight_ready") return { ok: false, status: 409, error: "Only a local-preflight project can be submitted once." };
    const jobId = "local-preview-" + project.id;
    project.status = "queued";
    project.updatedAt = this.now().toISOString();
    project.job = { id: jobId, provider: "local-template", mode: "local_2d_preview", status: "queued", progress: 0 };
    project.audit.push({ at: this.now().toISOString(), event: "local_preview_queued", jobId });
    this.schedule(() => this.startLocalPreview(id), this.renderDelayMs);
    return { ok: true, status: 202, project: this.snapshot(project) };
  }
  startLocalPreview(id) {
    const project = this.projects.get(id);
    if (!project || TERMINAL_STATUSES.has(project.status) || project.status !== "queued") return;
    project.status = "in_progress";
    project.job.status = "in_progress";
    project.job.progress = 58;
    project.updatedAt = this.now().toISOString();
    project.audit.push({ at: this.now().toISOString(), event: "local_preview_started", jobId: project.job.id });
    this.schedule(() => this.completeLocalPreview(id), this.renderDelayMs);
  }
  completeLocalPreview(id) {
    const project = this.projects.get(id);
    if (!project || project.status !== "in_progress") return;
    project.status = "completed";
    project.job.status = "completed";
    project.job.progress = 100;
    project.updatedAt = this.now().toISOString();
    project.delivery = {
      mode: "local_2d_preview",
      notice: "Local 2D preview complete. These fixed-template SVG stills are not AI-generated, photorealistic, uploaded, video, or downloadable assets.",
      assets: createLocalPreviewAssets(project.direction, project.storyboard.beats),
    };
    project.audit.push({ at: this.now().toISOString(), event: "local_preview_completed", jobId: project.job.id });
  }
  remainingHeadlessImageProbeAttempts() { return Math.max(0, this.maxHeadlessImageProbeAttempts - this.headlessImageProbeAllowanceUsed); }
  getHeadlessImageSpike() { return { ok: true, status: 200, generation: this.snapshot(this.headlessImageSpike), capabilityToken: this.localCapabilityToken, remainingAttempts: this.remainingHeadlessImageProbeAttempts() }; }
  rejectHeadlessImageProbeStart(status, error, message) { return { ok: false, status, error, message, generation: this.snapshot(this.headlessImageSpike), capabilityToken: this.localCapabilityToken, remainingAttempts: this.remainingHeadlessImageProbeAttempts() }; }
  recordHeadlessImageProbeAttempt(attempt) {
    const cleanupWarning = attempt.asset?.cleanupWarning ?? attempt.error?.cleanupWarning ?? null;
    const dimensions = attempt.asset ? { width: attempt.asset.width, height: attempt.asset.height, targetAspectRatio: attempt.asset.targetAspectRatio, returnedAspectRatio: attempt.asset.returnedAspectRatio } : null;
    this.headlessImageProbeHistory.push(Object.freeze({ id: attempt.id, consumedAt: attempt.startedAt, status: attempt.status, completedAt: attempt.completedAt, dimensions: dimensions ? Object.freeze(dimensions) : null, cleanupWarning: cleanupWarning ? this.snapshot(cleanupWarning) : null }));
  }
  finishHeadlessImageProbeAttempt(attempt, outcome) {
    Object.assign(attempt, outcome, { completedAt: this.now().toISOString() });
    this.headlessImageSpike = attempt;
    this.recordHeadlessImageProbeAttempt(attempt);
    if (this.headlessImageProbeActiveAttemptId === attempt.id) this.headlessImageProbeActiveAttemptId = null;
  }
  startHeadlessImageSpike(capabilityToken) {
    if (capabilityToken !== this.localCapabilityToken) return { ok: false, status: 403, error: "invalid_local_capability", message: "A same-origin local capability token is required to start the headless image probe." };
    const provider = this.headlessImageProvider.status();
    if (!provider.enabled) return { ok: false, status: 503, error: "provider_not_configured", message: provider.notice };
    if (this.headlessImageProbeActiveAttemptId) return this.rejectHeadlessImageProbeStart(409, "probe_in_flight", "A developer probe is in progress. Wait for its terminal result before using another allowance.");
    if (this.remainingHeadlessImageProbeAttempts() === 0) return this.rejectHeadlessImageProbeStart(429, "probe_allowance_exhausted", "No developer probe allowance remains for this API session.");
    const id = `headless-${String(++this.sequence).padStart(4, "0")}`;
    const attempt = { id, status: "in_progress", provider: provider.provider, mode: provider.mode, job: { mode: "developer_image_probe", phase: "queued", progress: 0 }, startedAt: this.now().toISOString(), completedAt: null, asset: null, error: null, notice: "Developer-only fixed original probe. This does not use project input, user prompts, or reference media." };
    this.headlessImageProbeAllowanceUsed += 1;
    this.headlessImageProbeActiveAttemptId = id;
    this.headlessImageSpike = attempt;
    Promise.resolve()
      .then(() => {
        attempt.job = { ...attempt.job, phase: "generating", progress: 50 };
        return this.headlessImageProvider.generateProbe();
      })
      .then((asset) => this.finishHeadlessImageProbeAttempt(attempt, { status: "completed", job: { ...attempt.job, phase: "completed", progress: 100 }, asset }))
      .catch((error) => {
        const code = error instanceof HeadlessImageProviderError ? error.code : "provider_failed";
        const message = error instanceof Error ? error.message : "Headless image generation failed.";
        const cleanupWarning = error && typeof error === "object" ? error.cleanupWarning : null;
        this.finishHeadlessImageProbeAttempt(attempt, { status: "failed", job: { ...attempt.job, phase: "failed" }, error: { code, message, ...(cleanupWarning ? { cleanupWarning } : {}) } });
      });
    return { ok: true, status: 202, generation: this.snapshot(attempt), capabilityToken: this.localCapabilityToken, remainingAttempts: this.remainingHeadlessImageProbeAttempts() };
  }
  snapshot(project) { return JSON.parse(JSON.stringify(project)); }
}