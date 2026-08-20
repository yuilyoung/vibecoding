import type { ImageBatch, ImageVariant } from "./image-batch";

export const LEGACY_IMAGE_PROJECT_PROTOCOL = "image-project.v1" as const;
export const IMAGE_PROJECT_PROTOCOL = "image-project.v2" as const;
export const IMAGE_PROJECT_TITLE_MAX_LENGTH = 60;
export const IMAGE_PROJECT_INTENT_MAX_LENGTH = 280;
export const IMAGE_PROJECT_WORK_NOTE_MAX_LENGTH = 240;
export const IMAGE_PROJECT_NOTE_MAX_LENGTH = 600;

export type ImageProjectPurpose = "social_short" | "campaign_visual" | "portfolio_piece";
export type ImageProjectWorkStatus = "todo" | "in_progress" | "done";

export type ImageProjectWorkItem = {
  id: string;
  title: string;
  status: ImageProjectWorkStatus;
  note: string;
};

export type PersonalImageProject = {
  protocolVersion: typeof IMAGE_PROJECT_PROTOCOL;
  batchId: string;
  variantId: string;
  selectionRevision: number;
  title: string;
  purpose: ImageProjectPurpose;
  creativeIntent: string;
  workItems: ImageProjectWorkItem[];
  projectNote: string;
  createdAt: string;
  updatedAt: string;
};

export type PersonalImageProjectDraft = Pick<PersonalImageProject, "title" | "purpose" | "creativeIntent">;
export type ImageProjectWorkDraft = Pick<PersonalImageProject, "workItems" | "projectNote">;

export interface PersonalImageProjectRepository {
  get(batchId: string): Promise<PersonalImageProject | null>;
  save(project: PersonalImageProject, signal?: AbortSignal): Promise<PersonalImageProject>;
}

export type SelectedImageResult =
  | { ok: true; variant: ImageVariant & { delivery: NonNullable<ImageVariant["delivery"]> }; revision: number }
  | { ok: false; reason: "selection_missing" | "variant_unavailable" | "delivery_unavailable" };

export type ImageProjectProgress = {
  completed: number;
  total: 3;
  percent: number;
  nextAction: ImageProjectWorkItem | null;
  state: "not_started" | "in_progress" | "completed";
};

const purposes = new Set<ImageProjectPurpose>(["social_short", "campaign_visual", "portfolio_piece"]);
const workStatuses = new Set<ImageProjectWorkStatus>(["todo", "in_progress", "done"]);

const workDefinitions: Readonly<Record<ImageProjectPurpose, ReadonlyArray<Readonly<Pick<ImageProjectWorkItem, "id" | "title">>>>> = Object.freeze({
  social_short: Object.freeze([
    Object.freeze({ id: "social-hook", title: "3초 훅과 첫 프레임 확정" }),
    Object.freeze({ id: "social-shots", title: "3개 숏의 장면 순서 작성" }),
    Object.freeze({ id: "social-motion", title: "9:16 모션·자막 점검" }),
  ]),
  campaign_visual: Object.freeze([
    Object.freeze({ id: "campaign-copy", title: "핵심 카피 한 줄 확정" }),
    Object.freeze({ id: "campaign-layouts", title: "가로·세로 파생 레이아웃 설계" }),
    Object.freeze({ id: "campaign-channels", title: "채널별 배포 규격 점검" }),
  ]),
  portfolio_piece: Object.freeze([
    Object.freeze({ id: "portfolio-statement", title: "작품 소개문 다듬기" }),
    Object.freeze({ id: "portfolio-series", title: "같은 세계관의 연작 2점 기획" }),
    Object.freeze({ id: "portfolio-order", title: "포트폴리오 순서와 캡션 확정" }),
  ]),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function cloneWorkItems(items: ReadonlyArray<ImageProjectWorkItem>): ImageProjectWorkItem[] {
  return items.map((item) => ({ ...item }));
}

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

export function createDefaultImageProjectWorkItems(purpose: ImageProjectPurpose): ImageProjectWorkItem[] {
  return workDefinitions[purpose].map((item) => ({ ...item, status: "todo", note: "" }));
}

export function createImageProjectWorkDraft(project: PersonalImageProject): ImageProjectWorkDraft {
  return { workItems: cloneWorkItems(project.workItems), projectNote: project.projectNote };
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

export function validateImageProjectWorkDraft(purpose: ImageProjectPurpose, draft: ImageProjectWorkDraft): string[] {
  const errors: string[] = [];
  const expected = workDefinitions[purpose];
  if (draft.workItems.length !== expected.length) return ["프로젝트 작업은 목적별 기본 3개를 유지해야 합니다."];
  draft.workItems.forEach((item, index) => {
    if (item.id !== expected[index].id || item.title !== expected[index].title) errors.push("프로젝트 작업의 제목이나 순서를 변경할 수 없습니다.");
    if (!workStatuses.has(item.status)) errors.push("프로젝트 작업 상태가 올바르지 않습니다.");
    if (item.note.length > IMAGE_PROJECT_WORK_NOTE_MAX_LENGTH) errors.push(`작업 메모는 ${IMAGE_PROJECT_WORK_NOTE_MAX_LENGTH}자 이내로 입력해 주세요.`);
  });
  if (draft.projectNote.length > IMAGE_PROJECT_NOTE_MAX_LENGTH) errors.push(`프로젝트 메모는 ${IMAGE_PROJECT_NOTE_MAX_LENGTH}자 이내로 입력해 주세요.`);
  return [...new Set(errors)];
}

export function changeImageProjectPurpose(draft: PersonalImageProjectDraft, purpose: ImageProjectPurpose): PersonalImageProjectDraft {
  if (!purposes.has(purpose)) throw new Error("프로젝트 사용 목적을 선택해 주세요.");
  return { ...draft, purpose };
}

export function updateImageProjectWorkItem(draft: ImageProjectWorkDraft, itemId: string, changes: Partial<Pick<ImageProjectWorkItem, "status" | "note">>, purpose: ImageProjectPurpose): ImageProjectWorkDraft {
  if (changes.status && !workStatuses.has(changes.status)) throw new Error("프로젝트 작업 상태가 올바르지 않습니다.");
  if (changes.note !== undefined && changes.note.length > IMAGE_PROJECT_WORK_NOTE_MAX_LENGTH) throw new Error(`작업 메모는 ${IMAGE_PROJECT_WORK_NOTE_MAX_LENGTH}자 이내로 입력해 주세요.`);
  let found = false;
  const next = {
    ...draft,
    workItems: draft.workItems.map((item) => {
      if (item.id !== itemId) return { ...item };
      found = true;
      return { ...item, ...changes };
    }),
  };
  if (!found) throw new Error("프로젝트 작업을 찾을 수 없습니다.");
  const errors = validateImageProjectWorkDraft(purpose, next);
  if (errors.length) throw new Error(errors[0]);
  return next;
}

export function updateImageProjectNote(draft: ImageProjectWorkDraft, projectNote: string, purpose: ImageProjectPurpose): ImageProjectWorkDraft {
  const next = { workItems: cloneWorkItems(draft.workItems), projectNote };
  const errors = validateImageProjectWorkDraft(purpose, next);
  if (errors.length) throw new Error(errors[0]);
  return next;
}

export function deriveImageProjectProgress(workItems: ReadonlyArray<ImageProjectWorkItem>): ImageProjectProgress {
  const completed = workItems.filter((item) => item.status === "done").length;
  const nextAction = workItems.find((item) => item.status === "in_progress") ?? workItems.find((item) => item.status === "todo") ?? null;
  return {
    completed,
    total: 3,
    percent: Math.round((completed / 3) * 100),
    nextAction: nextAction ? { ...nextAction } : null,
    state: completed === 3 ? "completed" : workItems.some((item) => item.status !== "todo") ? "in_progress" : "not_started",
  };
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
    workItems: createDefaultImageProjectWorkItems(draft.purpose),
    projectNote: "",
    createdAt: at,
    updatedAt: at,
  };
}

export function updatePersonalImageProjectDetails(project: PersonalImageProject, batch: ImageBatch, draft: PersonalImageProjectDraft, confirmPurposeReset: boolean, now = new Date()): PersonalImageProject {
  if (!projectMatchesSelection(project, batch)) throw new Error("이미지 선택이 변경되었습니다. 최신 기준 이미지를 다시 확인해 주세요.");
  const errors = validateImageProjectDraft(draft);
  if (errors.length) throw new Error(errors[0]);
  const purposeChanged = project.purpose !== draft.purpose;
  if (purposeChanged && !confirmPurposeReset) throw new Error("사용 목적 변경 시 기존 작업 상태와 메모가 초기화됨을 확인해 주세요.");
  return {
    ...project,
    title: draft.title.trim(),
    purpose: draft.purpose,
    creativeIntent: draft.creativeIntent.trim(),
    workItems: purposeChanged ? createDefaultImageProjectWorkItems(draft.purpose) : cloneWorkItems(project.workItems),
    projectNote: project.projectNote,
    updatedAt: now.toISOString(),
  };
}

export function updatePersonalImageProjectWork(project: PersonalImageProject, batch: ImageBatch, draft: ImageProjectWorkDraft, now = new Date()): PersonalImageProject {
  if (!projectMatchesSelection(project, batch)) throw new Error("이미지 선택이 변경되었습니다. 최신 기준 이미지를 다시 확인해 주세요.");
  const errors = validateImageProjectWorkDraft(project.purpose, draft);
  if (errors.length) throw new Error(errors[0]);
  return {
    ...project,
    workItems: draft.workItems.map((item) => ({ ...item, note: item.note.trim() })),
    projectNote: draft.projectNote.trim(),
    updatedAt: now.toISOString(),
  };
}

export function readStoredPersonalImageProject(value: unknown): PersonalImageProject | null {
  if (!isRecord(value)) return null;
  if (value.protocolVersion !== LEGACY_IMAGE_PROJECT_PROTOCOL && value.protocolVersion !== IMAGE_PROJECT_PROTOCOL) return null;
  if (typeof value.batchId !== "string" || !value.batchId || typeof value.variantId !== "string" || !value.variantId) return null;
  if (!Number.isInteger(value.selectionRevision) || Number(value.selectionRevision) < 1) return null;
  if (typeof value.title !== "string" || typeof value.creativeIntent !== "string" || typeof value.purpose !== "string" || !purposes.has(value.purpose as ImageProjectPurpose)) return null;
  if (!isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)) return null;
  const purpose = value.purpose as ImageProjectPurpose;
  const baseDraft = { title: value.title, purpose, creativeIntent: value.creativeIntent };
  if (validateImageProjectDraft(baseDraft).length) return null;

  let workDraft: ImageProjectWorkDraft;
  if (value.protocolVersion === LEGACY_IMAGE_PROJECT_PROTOCOL) {
    workDraft = { workItems: createDefaultImageProjectWorkItems(purpose), projectNote: "" };
  } else {
    if (!Array.isArray(value.workItems) || typeof value.projectNote !== "string") return null;
    const workItems: ImageProjectWorkItem[] = [];
    for (const item of value.workItems) {
      if (!isRecord(item) || typeof item.id !== "string" || typeof item.title !== "string" || typeof item.status !== "string" || typeof item.note !== "string") return null;
      workItems.push({ id: item.id, title: item.title, status: item.status as ImageProjectWorkStatus, note: item.note });
    }
    workDraft = { workItems, projectNote: value.projectNote };
    if (validateImageProjectWorkDraft(purpose, workDraft).length) return null;
  }

  return {
    protocolVersion: IMAGE_PROJECT_PROTOCOL,
    batchId: value.batchId,
    variantId: value.variantId,
    selectionRevision: Number(value.selectionRevision),
    ...baseDraft,
    workItems: cloneWorkItems(workDraft.workItems),
    projectNote: workDraft.projectNote,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
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
