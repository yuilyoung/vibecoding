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

export class StudioService {
  constructor({ now = () => new Date(), renderDelayMs = 120, schedule = setTimeout } = {}) { this.now = now; this.renderDelayMs = renderDelayMs; this.schedule = schedule; this.projects = new Map(); this.sequence = 0; }
  health() { return { status: "ok", provider: "mock", mode: "simulation", message: "Local precheck only: no external generation, media transfer, quarantine scan, or policy approval occurs." }; }
  createProject(input = {}) {
    const { errors, scene, blockedRules } = validate(input);
    if (errors.length) return { ok: false, status: 422, errors };
    const id = `local-${String(++this.sequence).padStart(4, "0")}`;
    const needsReview = input.sourceRelationship !== "original";
    const at = this.now().toISOString();
    const project = {
      id, createdAt: at, updatedAt: at, status: needsReview ? "review_required" : "local_preflight_ready", sourceRelationship: input.sourceRelationship, scene,
      direction: input.direction ?? "rainy-station",
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
    if (project.status === "review_required") return { ok: false, status: 409, error: "This source relationship requires rights review before simulation." };
    if (project.status !== "local_preflight_ready") return { ok: false, status: 409, error: "Only a local-preflight project can be submitted once." };
    const jobId = `mock-job-${project.id}`;
    project.status = "queued"; project.updatedAt = this.now().toISOString(); project.job = { id: jobId, provider: "mock", mode: "simulation", status: "queued", progress: 0 }; project.audit.push({ at: this.now().toISOString(), event: "simulation_queued", jobId });
    this.schedule(() => this.startMockRender(id), this.renderDelayMs);
    return { ok: true, status: 202, project: this.snapshot(project) };
  }
  startMockRender(id) { const project = this.projects.get(id); if (!project || TERMINAL_STATUSES.has(project.status) || project.status !== "queued") return; project.status = "in_progress"; project.job.status = "in_progress"; project.job.progress = 58; project.updatedAt = this.now().toISOString(); project.audit.push({ at: this.now().toISOString(), event: "mock_render_started", jobId: project.job.id }); this.schedule(() => this.completeMockRender(id), this.renderDelayMs); }
  completeMockRender(id) { const project = this.projects.get(id); if (!project || project.status !== "in_progress") return; project.status = "completed"; project.job.status = "completed"; project.job.progress = 100; project.updatedAt = this.now().toISOString(); project.delivery = { mode: "simulation", notice: "Simulation complete. No MP4, thumbnail, captions, or user media were produced or stored.", assets: [] }; project.audit.push({ at: this.now().toISOString(), event: "mock_render_completed", jobId: project.job.id }); }
  snapshot(project) { return JSON.parse(JSON.stringify(project)); }
}