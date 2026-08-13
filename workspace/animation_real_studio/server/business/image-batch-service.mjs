import { deriveBatchStatus, treatmentForVariant, toPhotoProjectDraft, validateImageBatchDraft } from "./image-batch-domain.mjs";

const clone = (value) => JSON.parse(JSON.stringify(value));

export class ImageBatchService {
  constructor({ imageProjectGateway, now = () => new Date() }) {
    if (!imageProjectGateway) throw new Error("ImageProjectGateway is required.");
    this.imageProjectGateway = imageProjectGateway;
    this.now = now;
    this.sequence = 0;
    this.batches = new Map();
    this.submissions = new Map();
  }

  async createBatch(input = {}) {
    const { errors, draft } = validateImageBatchDraft(input);
    if (errors.length) return { ok: false, status: 422, error: "batch_validation_failed", errors };
    const duplicateId = this.submissions.get(draft.clientRequestId);
    if (duplicateId) return { ok: false, status: 409, error: "batch_duplicate", message: "This batch request already exists.", batch: await this.snapshotBatch(this.batches.get(duplicateId)) };

    const id = `batch-${String(++this.sequence).padStart(4, "0")}`;
    const at = this.now().toISOString();
    const batch = {
      id,
      protocolVersion: draft.protocolVersion,
      createdAt: at,
      updatedAt: at,
      brief: clone(draft.brief),
      outputPlan: clone(draft.outputPlan),
      variantCount: draft.variantCount,
      variants: Array.from({ length: draft.variantCount }, (_, index) => ({ id: `${id}-variant-${index + 1}`, index, treatment: treatmentForVariant(index), projectId: null, launchError: null })),
      selection: null,
    };
    this.batches.set(id, batch);
    this.submissions.set(draft.clientRequestId, id);

    const launches = await Promise.all(batch.variants.map(async (variant) => {
      try { return await this.imageProjectGateway.createVariant(toPhotoProjectDraft(draft, variant.index)); }
      catch { return { ok: false, status: 500, error: "batch_variant_start_failed", message: "The variant could not be started." }; }
    }));
    launches.forEach((result, index) => {
      if (result.ok) batch.variants[index].projectId = result.project.id;
      else batch.variants[index].launchError = { code: result.error ?? "batch_variant_start_failed", message: result.message ?? result.errors?.[0]?.message ?? "The variant could not be started." };
    });
    batch.updatedAt = this.now().toISOString();
    if (launches.every((result) => !result.ok && result.status === 503)) return { ok: false, status: 503, error: "provider_not_configured", message: launches[0].message, batch: await this.snapshotBatch(batch) };
    return { ok: true, status: 202, batch: await this.snapshotBatch(batch) };
  }

  async getBatch(id) {
    const batch = this.batches.get(id);
    return batch ? { ok: true, status: 200, batch: await this.snapshotBatch(batch) } : { ok: false, status: 404, error: "batch_not_found", message: "Image batch not found." };
  }

  async selectVariant(id, variantId) {
    const batch = this.batches.get(id);
    if (!batch) return { ok: false, status: 404, error: "batch_not_found", message: "Image batch not found." };
    const snapshot = await this.snapshotBatch(batch);
    const variant = snapshot.variants.find((candidate) => candidate.id === variantId);
    if (!variant || variant.status !== "completed") return { ok: false, status: 409, error: "batch_selection_invalid", message: "Select a completed result from this batch." };
    if (batch.selection?.variantId !== variantId) {
      batch.selection = { variantId, revision: (batch.selection?.revision ?? 0) + 1, selectedAt: this.now().toISOString() };
      batch.updatedAt = batch.selection.selectedAt;
    }
    return { ok: true, status: 200, batch: await this.snapshotBatch(batch) };
  }

  async snapshotBatch(batch) {
    const variants = await Promise.all(batch.variants.map(async (variant) => {
      if (variant.launchError) return { id: variant.id, index: variant.index, treatment: variant.treatment, projectId: null, status: "failed", progress: 0, phase: "failed", delivery: null, error: clone(variant.launchError) };
      const result = await this.imageProjectGateway.getVariant(variant.projectId);
      if (!result.ok) return { id: variant.id, index: variant.index, treatment: variant.treatment, projectId: variant.projectId, status: "failed", progress: 0, phase: "failed", delivery: null, error: { code: result.error ?? "batch_variant_missing", message: result.message ?? "Variant state is unavailable." } };
      const project = result.project;
      return { id: variant.id, index: variant.index, treatment: variant.treatment, projectId: variant.projectId, status: project.status, progress: project.job?.progress ?? 0, phase: project.job?.phase ?? project.status, delivery: project.delivery ? clone(project.delivery) : null, error: project.error ? clone(project.error) : null };
    }));
    return { id: batch.id, protocolVersion: batch.protocolVersion, createdAt: batch.createdAt, updatedAt: batch.updatedAt, status: deriveBatchStatus(variants), brief: clone(batch.brief), outputPlan: clone(batch.outputPlan), variantCount: batch.variantCount, variants, selection: batch.selection ? clone(batch.selection) : null };
  }
}
