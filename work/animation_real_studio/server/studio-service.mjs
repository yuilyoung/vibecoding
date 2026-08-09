import { HeadlessCodexImageProvider, HeadlessImageProviderError } from "./headless-image-provider.mjs";
import { randomUUID } from "node:crypto";
const ALLOWED_REFERENCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4"]);
const TERMINAL_STATUSES = new Set(["completed", "failed", "review_required"]);
const PROVIDER_DIAGNOSTIC_CODES = new Set(["process_permission_denied", "codex_command_not_found", "codex_not_authenticated", "sandbox_rejected", "quota_or_rate_limited", "provider_exit_nonzero", "provider_start_failed", "provider_timeout"]);
const LOCAL_BLOCK_RULES = [
  { code: "copyrighted_work", pattern: /\b(one piece|luffy|naruto|pokemon|demon slayer|attack on titan)\b|원피스|루피|나루토|포켓몬|귀멸|진격의 거인/i },
  { code: "copied_scene", pattern: /(장면|대사).{0,40}(그대로|똑같이|정확하게).{0,24}(재현|복제)|\b(recreate|copy)\b.{0,40}\b(scene|dialogue)\b/i },
  { code: "real_person", pattern: /(실존|유명|연예인|공인|실제).{0,32}(인물|사람|얼굴|목소리)|\b(real person|public figure|celebrity)\b/i },
];

const text = (value) => typeof value === "string" ? value.trim() : "";
const issue = (field, message, code) => ({ field, message, code });

function safeProviderDiagnostics(value) {
  if (!value || typeof value !== "object" || !PROVIDER_DIAGNOSTIC_CODES.has(value.diagnosticCode)) return null;
  const safe = { diagnosticCode: value.diagnosticCode };
  if (Number.isInteger(value.exitCode) && value.exitCode >= 0 && value.exitCode <= 255) safe.exitCode = value.exitCode;
  if (typeof value.signal === "string" && /^[A-Z0-9_]{1,32}$/.test(value.signal)) safe.signal = value.signal;
  if (Number.isInteger(value.elapsedSeconds) && value.elapsedSeconds >= 0 && value.elapsedSeconds <= 600) safe.elapsedSeconds = value.elapsedSeconds;
  if (Number.isInteger(value.stderrBytes) && value.stderrBytes >= 0 && value.stderrBytes <= 1_048_576) safe.stderrBytes = value.stderrBytes;
  if (typeof value.stderrTruncated === "boolean") safe.stderrTruncated = value.stderrTruncated;
  if (Number.isInteger(value.timeoutSeconds) && value.timeoutSeconds >= 0 && value.timeoutSeconds <= 600) safe.timeoutSeconds = value.timeoutSeconds;
  return safe;
}

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

export const PHOTO_CONDITION_OPTIONS = Object.freeze({
  subject: Object.freeze({ no_person: "No people", fictional_adult: "Fictional adult person" }),
  age: Object.freeze({ not_applicable: "Not applicable", adult_20s: "Adult in their 20s", adult_30s: "Adult in their 30s", adult_40s: "Adult in their 40s", adult_50_plus: "Adult 50+" }),
  era: Object.freeze({ contemporary: "Contemporary", nineties: "1990s", historical: "Early 20th century", future: "Near future" }),
  setting: Object.freeze({ city_night: "Rainy city at night", sunlit_room: "Sunlit interior", coastal_nature: "Coastal nature", studio_set: "Original studio set" }),
  presentation: Object.freeze({ unspecified: "Unspecified", feminine: "Feminine", masculine: "Masculine", androgynous: "Androgynous" }),
  framing: Object.freeze({ portrait: "Portrait", upper_body: "Upper body", full_body: "Full body", hands_detail: "Hands detail" }),
  cameraAngle: Object.freeze({ eye_level: "Eye level", low_angle: "Low angle", high_angle: "High angle", three_quarter: "Three-quarter view" }),
  clothing: Object.freeze({ casual: "Casual everyday clothing", tailored: "Tailored clothing", historical: "Period-inspired clothing", functional: "Functional outerwear" }),
  peopleCount: Object.freeze({ zero: "No people", one: "One adult", two: "Two adults", group: "Three or more adults" }),
});
export const PHOTO_DEFAULT_CONDITIONS = Object.freeze({ subject: "fictional_adult", age: "adult_30s", era: "contemporary", setting: "city_night", presentation: "unspecified", framing: "upper_body", cameraAngle: "three_quarter", clothing: "casual", peopleCount: "one" });
const PHOTO_MODES = new Set(["text_to_photo", "animation_2d_to_photo"]);
const PHOTO_OUTPUT_KINDS = new Set(["still", "motion_gif"]);
const DEFAULT_GIF_FRAME_COUNT = 12;
const GIF_FRAME_RATE = 10;
const PHOTO_REFERENCE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_PHOTO_REFERENCE_BYTES = 6 * 1024 * 1024;
const PHOTO_REFERENCE_FOCUS_KEYS = Object.freeze(["preserveSubjectVisuals", "preserveBackgroundLayout", "preserveCameraComposition"]);
const DEFAULT_PHOTO_REFERENCE_FOCUS = Object.freeze({ preserveSubjectVisuals: true, preserveBackgroundLayout: true, preserveCameraComposition: true });
const PHOTO_UNSAFE_RULES = [
  { code: "unsafe_minor", pattern: /\b(minor|child|children|underage|teen(?:ager)?)\b/i },
  { code: "unsafe_sexual", pattern: /\b(nude|nudity|explicit|sexual|nsfw)\b/i },
];
const PHOTO_PHASES = Object.freeze({ validated: { progress: 10, label: "validated" }, workspace_prepared: { progress: 30, label: "workspace_prepared" }, provider_started: { progress: 55, label: "provider_started" }, output_validated: { progress: 90, label: "output_validated" }, gif_encoding: { progress: 90, label: "gif_encoding" }, artifact_ready: { progress: 90, label: "artifact_ready" }, completed: { progress: 100, label: "completed" }, failed: { progress: null, label: "failed" } });
const MIN_DURATION_SAMPLES = 3;
const DEFAULT_BOOTSTRAP_PROVIDER_DEADLINE_SECONDS = 300;

function photoIssue(field, message, code) { return issue(field, message, code); }
function hasPhotoSignature(bytes, mimeType) {
  if (!Buffer.isBuffer(bytes)) return false;
  if (mimeType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}
function decodePhotoReference(reference) {
  const dataUrl = text(reference?.dataUrl);
  const mimeType = text(reference?.mimeType);
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!PHOTO_REFERENCE_TYPES.has(mimeType) || !match || match[1] !== mimeType) return { error: "reference_format" };
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_PHOTO_REFERENCE_BYTES) return { error: "reference_size" };
  if (!hasPhotoSignature(bytes, mimeType)) return { error: "reference_signature" };
  return { mimeType, bytes };
}
function normalizePhotoReferenceFocus(value) {
  if (value === undefined) return { focus: { ...DEFAULT_PHOTO_REFERENCE_FOCUS } };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "reference_focus_format" };
  const focus = {};
  for (const key of PHOTO_REFERENCE_FOCUS_KEYS) {
    if (value[key] === undefined) focus[key] = DEFAULT_PHOTO_REFERENCE_FOCUS[key];
    else if (typeof value[key] !== "boolean") return { error: "reference_focus_format" };
    else focus[key] = value[key];
  }
  return PHOTO_REFERENCE_FOCUS_KEYS.some((key) => focus[key]) ? { focus } : { error: "reference_focus_empty" };
}
function referenceFocusInstruction(focus) {
  const requested = [];
  if (focus.preserveSubjectVisuals) requested.push("fictional-adult silhouette and pose; non-identifying hairstyle; clothing category, palette, material, and non-logo accessories");
  if (focus.preserveBackgroundLayout) requested.push("background setting, spatial layout, focal-object placement, lighting, weather, and colour palette");
  if (focus.preserveCameraComposition) requested.push("camera angle, framing, perspective, and composition");
  return requested.join("; ");
}
export function composePhotorealisticPrompt(detailPrompt, conditions, mode, referenceFocus = null) {
  const named = Object.fromEntries(Object.entries(PHOTO_CONDITION_OPTIONS).map(([key, options]) => [key, options[conditions[key]]]));
  const modeLead = mode === "animation_2d_to_photo"
    ? "Transform the supplied user-attested original 2D illustration into a new photorealistic interpretation. Hard safety constraints come first, then the structured visual brief and story direction define the subject's action, emotion, event, and intended scene change."
    : "Create one original photorealistic still from the user direction.";
  return [
    modeLead,
    `Visual brief: ${named.subject}; ${named.age}; ${named.presentation} presentation; ${named.era}; ${named.setting}; ${named.framing}; ${named.cameraAngle}; ${named.clothing}; ${named.peopleCount}.`,
    `Story direction (authoritative for action, emotion, event, and intended scene change): ${detailPrompt.replace(/\s+/g, " ").trim()}`,
    ...(mode === "animation_2d_to_photo" ? [`Reference continuity requested by the user: preserve only these non-conflicting visual domains from the attached original 2D image: ${referenceFocusInstruction(referenceFocus ?? DEFAULT_PHOTO_REFERENCE_FOCUS)}.`] : []),
    "Keep it cinematic, physically plausible, and non-identifying. Do not include logos, readable text, watermarks, copyrighted characters, or recognisable real people.",
  ].join("\n");
}
function validatePhotorealisticDraft(input = {}) {
  const errors = [];
  const mode = text(input.mode);
  const detailPrompt = text(input.detailPrompt);
  const conditions = input.conditions && typeof input.conditions === "object" ? input.conditions : {};
  if (!PHOTO_MODES.has(mode)) errors.push(photoIssue("mode", "Choose a supported image-generation mode.", "photo_mode"));
  if (detailPrompt.length < 20 || detailPrompt.length > 700) errors.push(photoIssue("detailPrompt", "Describe the image in 20 to 700 characters.", "photo_prompt_length"));
  if (input.rightsAccepted !== true) errors.push(photoIssue("rightsAccepted", "Original-content and adult-only acknowledgement is required.", "photo_rights_acknowledgement"));
  for (const [key, options] of Object.entries(PHOTO_CONDITION_OPTIONS)) if (!Object.hasOwn(options, conditions[key])) errors.push(photoIssue(`conditions.${key}`, "Choose one supported visual condition.", "photo_condition"));
  if (conditions.subject === "no_person" && conditions.peopleCount !== "zero") errors.push(photoIssue("conditions.peopleCount", "A no-person scene must use no people.", "photo_people_mismatch"));
  if (conditions.subject === "fictional_adult" && conditions.peopleCount === "zero") errors.push(photoIssue("conditions.peopleCount", "A person scene needs at least one adult.", "photo_people_mismatch"));
  const blockedRules = [...localPrecheck(detailPrompt), ...PHOTO_UNSAFE_RULES.filter((rule) => rule.pattern.test(detailPrompt)).map((rule) => rule.code)];
  if (blockedRules.length) errors.push(photoIssue("detailPrompt", "This experimental generator accepts only original, non-identifying, adult-safe image directions.", blockedRules.join(",")));
  let reference = null;
  let referenceFocus = null;
  if (mode === "animation_2d_to_photo") {
    const decoded = decodePhotoReference(input.referenceImage);
    if (decoded.error) errors.push(photoIssue("referenceImage", "Attach one original PNG, JPEG, or WebP 2D image under 6 MB.", decoded.error));
    else reference = decoded;
    const normalizedFocus = normalizePhotoReferenceFocus(input.referenceFocus);
    if (normalizedFocus.error) errors.push(photoIssue("referenceFocus", "Choose at least one reference element to preserve using supported boolean options.", normalizedFocus.error));
    else referenceFocus = normalizedFocus.focus;
  } else if (input.referenceFocus !== undefined) {
    errors.push(photoIssue("referenceFocus", "Reference preservation choices are available only with a 2D original.", "reference_focus_mode"));
  }
  const outputKind = text(input.outputKind || "still");
  const requestedFrameCount = input.frameCount ?? DEFAULT_GIF_FRAME_COUNT;
  if (!PHOTO_OUTPUT_KINDS.has(outputKind)) errors.push(photoIssue("outputKind", "Choose a still image or a motion GIF output.", "photo_output_kind"));
  if (outputKind === "motion_gif" && (!Number.isInteger(requestedFrameCount) || requestedFrameCount < 2 || requestedFrameCount > 30)) errors.push(photoIssue("frameCount", "Choose between 2 and 30 motion GIF frames.", "photo_frame_count"));
  const frameCount = outputKind === "motion_gif" && Number.isInteger(requestedFrameCount) ? requestedFrameCount : 1;
  const clientRequestId = text(input.clientRequestId);
  if (!/^[a-zA-Z0-9-]{12,80}$/.test(clientRequestId)) errors.push(photoIssue("clientRequestId", "A valid local submission identifier is required.", "photo_submission_id"));
  return { errors, mode, detailPrompt, conditions, reference, referenceFocus, outputKind, frameCount, clientRequestId, blockedRules };
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
        const code = typeof error?.code === "string" ? error.code : error instanceof HeadlessImageProviderError ? error.code : "provider_failed";
        const message = error instanceof Error ? error.message : "Headless image generation failed.";
        const cleanupWarning = error && typeof error === "object" ? error.cleanupWarning : null;
        const providerDiagnostics = safeProviderDiagnostics(error?.providerDiagnostics);
        this.finishHeadlessImageProbeAttempt(attempt, { status: "failed", job: { ...attempt.job, phase: "failed" }, error: { code, message, ...(providerDiagnostics ? { providerDiagnostics } : {}), ...(cleanupWarning ? { cleanupWarning } : {}) } });
      });
    return { ok: true, status: 202, generation: this.snapshot(attempt), capabilityToken: this.localCapabilityToken, remainingAttempts: this.remainingHeadlessImageProbeAttempts() };
  }
  durationBucket(output, mode) {
    const outputBucket = output.kind !== "motion_gif" ? "still" : output.frameCount <= 10 ? "motion_gif_short" : output.frameCount <= 20 ? "motion_gif_medium" : "motion_gif_long";
    return `${mode}_${outputBucket}`;
  }
  estimatedPhotorealisticDurationSeconds(output, mode) {
    const bucket = this.durationBucket(output, mode);
    const values = (this.photorealisticDurationSamples ?? []).filter((sample) => sample.bucket === bucket).map((sample) => sample.seconds);
    if (values.length < MIN_DURATION_SAMPLES) return null;
    const ordered = [...values].sort((left, right) => left - right);
    return Math.max(15, ordered[Math.floor(ordered.length / 2)]);
  }
  photorealisticDurationSampleCount(output, mode) {
    return (this.photorealisticDurationSamples ?? []).filter((sample) => sample.bucket === this.durationBucket(output, mode)).length;
  }
  bootstrapPhotorealisticDurationSeconds(output) {
    const configuredTimeoutSeconds = Math.floor(Number(this.headlessImageProvider?.timeoutMs) / 1000);
    const providerDeadlineSeconds = Number.isFinite(configuredTimeoutSeconds) && configuredTimeoutSeconds >= 60 && configuredTimeoutSeconds <= 600 ? configuredTimeoutSeconds : DEFAULT_BOOTSTRAP_PROVIDER_DEADLINE_SECONDS;
    const outputBufferSeconds = output.kind === "still" ? 15 : output.frameCount <= 10 ? 25 : output.frameCount <= 20 ? 35 : 50;
    return providerDeadlineSeconds + outputBufferSeconds;
  }
  photorealisticDurationEstimate(output, mode) {
    const sampledSeconds = this.estimatedPhotorealisticDurationSeconds(output, mode);
    const sampleCount = this.photorealisticDurationSampleCount(output, mode);
    return sampledSeconds === null
      ? { seconds: this.bootstrapPhotorealisticDurationSeconds(output), source: "bucket_bootstrap", sampleCount }
      : { seconds: sampledSeconds, source: "bucket_median", sampleCount };
  }
  forecastPhotorealisticProgress(elapsedSeconds, estimatedDurationSeconds, maximumProgress = 90) {
    const startProgress = Math.min(PHOTO_PHASES.provider_started.progress, maximumProgress);
    const ratio = Math.min(1, Math.max(0, elapsedSeconds) / Math.max(1, estimatedDurationSeconds));
    return Math.min(maximumProgress, Math.floor((startProgress + ((maximumProgress - startProgress) * ratio)) / 5) * 5);
  }
  setPhotorealisticPhase(project, phase, details = {}) {
    const state = PHOTO_PHASES[phase];
    if (!state || phase === "completed" || phase === "failed" || !project || project.status === "completed" || project.status === "failed") return;
    project.job.phase = state.label;
    const phaseStartedAt = this.now().toISOString();
    project.job.phaseStartedAt = phaseStartedAt;
    if (phase === "provider_started") project.job.forecastStartedAt = phaseStartedAt;
    if (phase === "output_validated") project.job.finalizationState = "validating_image";
    if (phase === "gif_encoding") project.job.finalizationState = "encoding_gif";
    if (phase === "artifact_ready") project.job.finalizationState = "saving_artifact";
    if (phase === "gif_encoding") {
      project.job.encodedFrameCount = Math.max(0, Math.min(project.output.frameCount, Number(details.currentFrame) || 0));
      project.job.observedProgress = state.progress;
      project.job.progress = state.progress;
    } else {
      project.job.observedProgress = state.progress;
      project.job.progress = state.progress;
    }
    project.updatedAt = this.now().toISOString();
    project.audit.push({ at: project.updatedAt, event: `photo_${state.label}`, jobId: project.job.id, ...(phase === "gif_encoding" ? { currentFrame: project.job.encodedFrameCount, frameCount: project.output.frameCount } : {}) });
  }
  snapshotPhotorealisticProject(project) {
    const snapshot = this.snapshot(project);
    const startedAt = snapshot.job?.startedAt ? Date.parse(snapshot.job.startedAt) : NaN;
    const now = this.now().getTime();
    const completedAt = snapshot.job?.completedAt ? Date.parse(snapshot.job.completedAt) : NaN;
    const elapsedEnd = (snapshot.status === "completed" || snapshot.status === "failed") && Number.isFinite(completedAt) ? completedAt : now;
    const rawElapsedSeconds = Number.isFinite(startedAt) ? Math.max(0, Math.floor((elapsedEnd - startedAt) / 1000)) : 0;
    const recordedElapsedSeconds = Number.isFinite(project.job?.elapsedSeconds) ? project.job.elapsedSeconds : 0;
    const elapsedSeconds = Math.max(recordedElapsedSeconds, rawElapsedSeconds);
    const forecastStartedAt = snapshot.job?.forecastStartedAt ? Date.parse(snapshot.job.forecastStartedAt) : NaN;
    const rawForecastElapsedSeconds = Number.isFinite(forecastStartedAt) ? Math.max(0, Math.floor((elapsedEnd - forecastStartedAt) / 1000)) : 0;
    const recordedForecastElapsedSeconds = Number.isFinite(project.job?.forecastElapsedSeconds) ? project.job.forecastElapsedSeconds : 0;
    const forecastElapsedSeconds = Math.max(recordedForecastElapsedSeconds, rawForecastElapsedSeconds);
    if (snapshot.job) {
      snapshot.job.elapsedSeconds = elapsedSeconds;
      snapshot.job.forecastElapsedSeconds = forecastElapsedSeconds;
      const observedProgress = Number.isFinite(snapshot.job.observedProgress) ? snapshot.job.observedProgress : snapshot.job.progress ?? 0;
      const retainedForecast = Number.isFinite(project.job?.forecastHighWater) ? project.job.forecastHighWater : 0;
      snapshot.job.observedProgress = observedProgress;
      snapshot.job.forecastHighWater = retainedForecast;
      if (project.job) {
        project.job.elapsedSeconds = elapsedSeconds;
        project.job.forecastElapsedSeconds = forecastElapsedSeconds;
        project.job.observedProgress ??= observedProgress;
        project.job.forecastHighWater ??= retainedForecast;
      }
      if (snapshot.status !== "completed" && snapshot.status !== "failed") {
        const durationEstimate = this.photorealisticDurationEstimate(snapshot.output, snapshot.mode);
        snapshot.job.estimatedDurationSeconds = durationEstimate.seconds;
        snapshot.job.durationSampleCount = durationEstimate.sampleCount;
        snapshot.job.etaSource = durationEstimate.source;
        if (project.job) Object.assign(project.job, { estimatedDurationSeconds: durationEstimate.seconds, durationSampleCount: durationEstimate.sampleCount, etaSource: durationEstimate.source });
      }
      if (snapshot.status === "completed" || snapshot.status === "failed") {
        snapshot.job.estimatedRemainingSeconds = 0;
        snapshot.job.etaState = "terminal";
        snapshot.job.etaSource = null;
        snapshot.job.finalizationState = "terminal";
        snapshot.job.progressBasis = "observed_server_lifecycle";
        snapshot.job.progress = snapshot.status === "completed" ? 100 : Math.min(90, Math.max(observedProgress, retainedForecast));
      } else {
        if (snapshot.job.estimatedDurationSeconds === null) {
          snapshot.job.estimatedRemainingSeconds = null;
          snapshot.job.etaState = "bootstrap";
          snapshot.job.etaSource = "bucket_bootstrap";
          snapshot.job.progressBasis = "observed_server_lifecycle";
          snapshot.job.progress = observedProgress;
        } else {
          const remaining = snapshot.job.estimatedDurationSeconds - forecastElapsedSeconds;
          snapshot.job.estimatedRemainingSeconds = remaining > 0 ? remaining : null;
          snapshot.job.etaState = remaining > 0 ? snapshot.job.etaSource === "bucket_median" ? "sampled" : "bootstrap" : "estimate_exceeded";
          const supportsForecast = snapshot.status === "in_progress" && ["provider_started", "output_validated", "gif_encoding", "artifact_ready"].includes(snapshot.job.phase);
          if (supportsForecast) {
            const forecastCap = 90;
            const forecast = this.forecastPhotorealisticProgress(forecastElapsedSeconds, snapshot.job.estimatedDurationSeconds, forecastCap);
            const forecastHighWater = Math.min(forecastCap, Math.max(retainedForecast, forecast));
            if (project.job) project.job.forecastHighWater = forecastHighWater;
            snapshot.job.forecastHighWater = forecastHighWater;
            snapshot.job.progress = Math.max(observedProgress, forecastHighWater);
            snapshot.job.progressBasis = "server_lifecycle_and_duration_forecast";
          } else { snapshot.job.progress = observedProgress; snapshot.job.progressBasis = "observed_server_lifecycle"; }
        }
      }
      if (snapshot.status !== "completed" && snapshot.status !== "failed" && snapshot.job.progress >= 90) {
        const finalizationState = ["validating_image", "encoding_gif", "saving_artifact"].includes(snapshot.job.finalizationState)
          ? snapshot.job.finalizationState
          : "awaiting_provider_output";
        snapshot.job.finalizationState = finalizationState;
        if (project.job) project.job.finalizationState = finalizationState;
      }
    }
    return snapshot;
  }
  createPhotorealisticProject(input = {}) {
    const draft = validatePhotorealisticDraft(input);
    if (draft.errors.length) return { ok: false, status: 422, errors: draft.errors };
    const provider = this.headlessImageProvider.status();
    if (!provider.enabled) return { ok: false, status: 503, error: "provider_not_configured", message: provider.notice };
    this.photorealisticProjects ??= new Map();
    this.photorealisticSubmissionIds ??= new Map();
    this.photorealisticDurationSamples ??= [];
    const duplicateId = this.photorealisticSubmissionIds.get(draft.clientRequestId);
    if (duplicateId) return { ok: false, status: 409, error: "duplicate_submission", message: "This image request is already active or complete.", project: this.snapshotPhotorealisticProject(this.photorealisticProjects.get(duplicateId)) };
    const at = this.now().toISOString();
    const id = `photo-${String(++this.sequence).padStart(4, "0")}`;
    const composedPrompt = composePhotorealisticPrompt(draft.detailPrompt, draft.conditions, draft.mode, draft.referenceFocus);
    const output = { kind: draft.outputKind, frameCount: draft.frameCount, fps: draft.outputKind === "motion_gif" ? GIF_FRAME_RATE : null };
    const durationEstimate = this.photorealisticDurationEstimate(output, draft.mode);
    const estimate = durationEstimate.seconds;
    const project = {
      id,
      createdAt: at,
      updatedAt: at,
      status: "queued",
      mode: draft.mode,
      conditions: { ...draft.conditions },
      detailPrompt: draft.detailPrompt,
      composedPrompt,
      output,
      source: draft.reference ? { kind: "attested_original_2d", processing: "ephemeral_codex_image_attachment", focus: draft.referenceFocus } : null,
      job: { id: `photo-job-${id}`, provider: provider.provider, mode: draft.mode, outputKind: output.kind, requestedFrameCount: output.frameCount, encodedFrameCount: 0, fps: output.fps, status: "queued", phase: "validated", progress: PHOTO_PHASES.validated.progress, observedProgress: PHOTO_PHASES.validated.progress, forecastHighWater: 0, progressBasis: "observed_server_lifecycle", startedAt: null, phaseStartedAt: at, forecastStartedAt: null, completedAt: null, estimatedDurationSeconds: estimate, elapsedSeconds: 0, forecastElapsedSeconds: 0, estimatedRemainingSeconds: estimate, etaState: durationEstimate.source === "bucket_median" ? "sampled" : "bootstrap", etaSource: durationEstimate.source, durationSampleCount: durationEstimate.sampleCount, finalizationState: "none" },
      delivery: null,
      error: null,
      audit: [{ at, event: "photo_validated", jobId: `photo-job-${id}` }],
    };
    this.photorealisticProjects.set(id, project);
    this.photorealisticSubmissionIds.set(draft.clientRequestId, id);
    this.schedule(() => { void this.startPhotorealisticProject(id, draft.reference); }, 0);
    return { ok: true, status: 202, project: this.snapshotPhotorealisticProject(project) };
  }
  getPhotorealisticProject(id) {
    const project = this.photorealisticProjects?.get(id);
    return project ? { ok: true, status: 200, project: this.snapshotPhotorealisticProject(project) } : { ok: false, status: 404, error: "Image project not found." };
  }
  async startPhotorealisticProject(id, reference) {
    const project = this.photorealisticProjects?.get(id);
    if (!project || project.status !== "queued") return;
    project.status = "in_progress";
    project.job.status = "in_progress";
    project.job.startedAt = this.now().toISOString();
    this.setPhotorealisticPhase(project, "validated");
    try {
      const asset = await this.headlessImageProvider.generateUserImage({ prompt: project.composedPrompt, reference, output: project.output, onPhase: (phase, details) => this.setPhotorealisticPhase(project, phase, details) });
      project.status = "completed";
      project.job.status = "completed";
      project.job.completedAt = this.now().toISOString();
      project.job.phase = PHOTO_PHASES.completed.label;
      project.job.progress = PHOTO_PHASES.completed.progress;
      project.job.observedProgress = PHOTO_PHASES.completed.progress;
      project.job.finalizationState = "terminal";
      project.updatedAt = project.job.completedAt;
      project.delivery = { mode: project.mode, output: project.output, notice: project.output.kind === "motion_gif" ? "Trusted-local deterministic motion GIF complete. It is built from one generated still, not AI video or frame-by-frame generation." : "Trusted-local experimental photorealistic image complete. It remains local to this API session.", asset };
      project.audit.push({ at: project.updatedAt, event: "photo_completed", jobId: project.job.id });
      const elapsed = Math.max(1, project.job.elapsedSeconds ?? 0, Math.floor((Date.parse(project.job.completedAt) - Date.parse(project.job.startedAt)) / 1000));
      project.job.elapsedSeconds = elapsed;
      const forecastStartAt = Date.parse(project.job.forecastStartedAt ?? project.job.startedAt);
      const forecastElapsed = Math.max(1, project.job.forecastElapsedSeconds ?? 0, Math.floor((Date.parse(project.job.completedAt) - forecastStartAt) / 1000));
      project.job.forecastElapsedSeconds = forecastElapsed;
      const bucket = this.durationBucket(project.output, project.mode);
      const otherBuckets = (this.photorealisticDurationSamples ?? []).filter((sample) => sample.bucket !== bucket);
      const priorBucketSamples = (this.photorealisticDurationSamples ?? []).filter((sample) => sample.bucket === bucket).slice(-7);
      this.photorealisticDurationSamples = [...otherBuckets, ...priorBucketSamples, { bucket, seconds: forecastElapsed }];
    } catch (error) {
      const code = typeof error?.code === "string" ? error.code : error instanceof HeadlessImageProviderError ? error.code : "provider_failed";
      const message = error instanceof Error ? error.message : "Photorealistic image generation failed.";
      const cleanupWarning = error && typeof error === "object" ? error.cleanupWarning : null;
      const providerDiagnostics = safeProviderDiagnostics(error?.providerDiagnostics);
      project.status = "failed";
      project.job.status = "failed";
      project.job.completedAt = this.now().toISOString();
      project.job.phase = PHOTO_PHASES.failed.label;
      project.job.finalizationState = "terminal";
      project.job.forecastHighWater = Math.min(90, project.job.forecastHighWater ?? 0);
      project.job.progress = Math.min(90, Math.max(project.job.observedProgress ?? project.job.progress ?? 0, project.job.forecastHighWater));
      project.updatedAt = project.job.completedAt;
      project.error = { code, message, ...(providerDiagnostics ? { providerDiagnostics } : {}), ...(cleanupWarning ? { cleanupWarning } : {}) };
      project.audit.push({ at: project.updatedAt, event: "photo_failed", jobId: project.job.id, code, ...(providerDiagnostics ? { diagnosticCode: providerDiagnostics.diagnosticCode } : {}) });
    }
  }
  snapshot(project) { return JSON.parse(JSON.stringify(project)); }
}