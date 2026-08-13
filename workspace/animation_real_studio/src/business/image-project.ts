import type { ImageBatch, ImageVariant } from "./image-batch";

export const IMAGE_PROJECT_PROTOCOL = "image-project.v1" as const;
export const IMAGE_PROJECT_TITLE_MAX_LENGTH = 60;
export const IMAGE_PROJECT_INTENT_MAX_LENGTH = 280;

export type ImageProjectPurpose = "social_short" | "campaign_visual" | "portfolio_piece";

export type PersonalImageProject = {
  protocolVersion: typeof IMAGE_PROJECT_PROTOCOL;
  batchId: string;
  variantId: string;
  selectionRevision: number;
  title: string;
  purpose: ImageProjectPurpose;
  creativeIntent: string;
  createdAt: string;
  updatedAt: string;
};

export type PersonalImageProjectDraft = Pick<PersonalImageProject, "title" | "purpose" | "creativeIntent">;

export interface PersonalImageProjectRepository {
  get(batchId: string): Promise<PersonalImageProject | null>;
  save(project: PersonalImageProject): Promise<PersonalImageProject>;
}

export type SelectedImageResult =
  | { ok: true; variant: ImageVariant & { delivery: NonNullable<ImageVariant["delivery"]> }; revision: number }
  | { ok: false; reason: "selection_missing" | "variant_unavailable" | "delivery_unavailable" };

const purposes = new Set<ImageProjectPurpose>(["social_short", "campaign_visual", "portfolio_piece"]);

export function resolveSelectedImage(batch: ImageBatch): SelectedImageResult {
  if (!batch.selection) return { ok: false, reason: "selection_missing" };
  const variant = batch.variants.find((candidate) => candidate.id === batch.selection?.variantId);
  if (!variant || variant.status !== "completed") return { ok: false, reason: "variant_unavailable" };
  if (!variant.delivery?.asset?.dataUri) return { ok: false, reason: "delivery_unavailable" };
  return { ok: true, variant: variant as ImageVariant & { delivery: NonNullable<ImageVariant["delivery"]> }, revision: batch.selection.revision };
}

export function createDefaultImageProjectDraft(batch: ImageBatch): PersonalImageProjectDraft {
  return {
    title: `나의 이미지 프로젝트 · ${batch.id}`,
    purpose: "social_short",
    creativeIntent: batch.brief.story.trim().slice(0, IMAGE_PROJECT_INTENT_MAX_LENGTH),
  };
}

export function validateImageProjectDraft(draft: PersonalImageProjectDraft): string[] {
  const errors: string[] = [];
  const titleLength = draft.title.trim().length;
  const intentLength = draft.creativeIntent.trim().length;
  if (titleLength < 2 || titleLength > IMAGE_PROJECT_TITLE_MAX_LENGTH) errors.push(`프로젝트 이름은 2~${IMAGE_PROJECT_TITLE_MAX_LENGTH}자로 입력해 주세요.`);
  if (!purposes.has(draft.purpose)) errors.push("프로젝트 사용 목적을 선택해 주세요.");
  if (intentLength < 10 || intentLength > IMAGE_PROJECT_INTENT_MAX_LENGTH) errors.push(`창작 의도는 10~${IMAGE_PROJECT_INTENT_MAX_LENGTH}자로 입력해 주세요.`);
  return errors;
}

export function createPersonalImageProject(batch: ImageBatch, draft: PersonalImageProjectDraft, now = new Date()): PersonalImageProject {
  const selected = resolveSelectedImage(batch);
  if (!selected.ok) throw new Error("선택된 완료 이미지를 확인할 수 없습니다.");
  const errors = validateImageProjectDraft(draft);
  if (errors.length) throw new Error(errors[0]);
  const at = now.toISOString();
  return {
    protocolVersion: IMAGE_PROJECT_PROTOCOL,
    batchId: batch.id,
    variantId: selected.variant.id,
    selectionRevision: selected.revision,
    title: draft.title.trim(),
    purpose: draft.purpose,
    creativeIntent: draft.creativeIntent.trim(),
    createdAt: at,
    updatedAt: at,
  };
}

export function projectMatchesSelection(project: PersonalImageProject, batch: ImageBatch) {
  return project.batchId === batch.id
    && project.variantId === batch.selection?.variantId
    && project.selectionRevision === batch.selection?.revision;
}

export function selectedImageMatches(left: ImageBatch, right: ImageBatch) {
  const expected = resolveSelectedImage(left);
  const latest = resolveSelectedImage(right);
  return expected.ok && latest.ok
    && left.id === right.id
    && expected.variant.id === latest.variant.id
    && expected.revision === latest.revision;
}
