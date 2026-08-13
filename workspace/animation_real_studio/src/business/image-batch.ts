export const IMAGE_BATCH_PROTOCOL = "image-batch.v1" as const;
export const IMAGE_BATCH_STORY_MIN_LENGTH = 20;
export const IMAGE_BATCH_STORY_MAX_LENGTH = 400;

export type SubjectKind = "human" | "animal" | "bird";
export type SubjectDetail = "fictional_adult" | "dog" | "cat" | "horse" | "wildlife" | "songbird" | "raptor" | "waterbird";
export type ImageBatchEthnicity = "not_applicable" | "unspecified" | "east_asian" | "southeast_asian" | "south_asian" | "black" | "white" | "middle_eastern" | "latino_hispanic" | "multiracial";
export type ImageBatchCountry = "not_applicable" | "unspecified" | "south_korea" | "japan" | "china" | "united_states" | "united_kingdom" | "france" | "thailand" | "vietnam" | "india" | "brazil";
export type ImageBatchBrief = {
  subjectKind: SubjectKind;
  subjectDetail: SubjectDetail;
  age: "not_applicable" | "adult_20s" | "adult_30s" | "adult_40s" | "adult_50_plus";
  era: "contemporary" | "nineties" | "historical" | "future";
  weather: "clear" | "rain" | "snow" | "fog" | "storm";
  environment: "city" | "interior" | "coast" | "forest" | "studio";
  cameraAngle: "eye_level" | "low_angle" | "high_angle" | "three_quarter" | "overhead" | "dutch";
  presentation: "unspecified" | "feminine" | "masculine" | "androgynous";
  ethnicity: ImageBatchEthnicity;
  country: ImageBatchCountry;
  framing: "portrait" | "upper_body" | "full_body" | "hands_detail";
  lighting: "soft_daylight" | "golden_hour" | "neon_night" | "low_key" | "high_key";
  mood: "calm" | "joyful" | "tense" | "mysterious" | "dramatic";
  perspective: "first_person" | "second_person" | "third_person";
  wardrobe: "none" | "bikini" | "rash_guard" | "monokini" | "one_piece_swimsuit" | "micro_bikini" | "lingerie" | "school_inspired" | "casual" | "formal";
  profession: "none" | "kpop_idol" | "fashion_model" | "announcer" | "flight_attendant" | "police_officer" | "office_worker" | "adult_university_student" | "other_professional";
  peopleCount: "zero" | "one" | "two" | "group";
  story: string;
};

export type ImageBatchReferenceFocus = { preserveSubjectVisuals: boolean; preserveBackgroundLayout: boolean; preserveCameraComposition: boolean };
export type ImageBatchSourceInput = { kind: "attested_original_2d"; referenceImage: { mimeType: "image/png" | "image/jpeg" | "image/webp"; dataUrl: string }; referenceFocus: ImageBatchReferenceFocus };
export type ImageBatchOutputPlan = { kind: "still" | "motion_gif"; frameCount: number };
export type ImageBatchMode = "text_to_photo" | "animation_2d_to_photo";
export type ImageBatchFormSettings = { brief: ImageBatchBrief; mode: ImageBatchMode; referenceFocus: ImageBatchReferenceFocus; outputPlan: ImageBatchOutputPlan; variantCount: 1 | 2 | 3; rightsAccepted: boolean };
export type ImageBatchDraft = { protocolVersion: typeof IMAGE_BATCH_PROTOCOL; variantCount: 1 | 2 | 3; clientRequestId: string; rightsAccepted: boolean; brief: ImageBatchBrief; outputPlan: ImageBatchOutputPlan; sourceInput?: ImageBatchSourceInput };
export type ImageVariant = {
  id: string;
  index: number;
  treatment: string;
  projectId: string | null;
  status: "queued" | "in_progress" | "completed" | "failed";
  progress: number;
  phase: string;
  delivery: null | { asset: { id: string; dataUri: string; mimeType?: string; width?: number; height?: number; notice?: string } };
  error: null | { code: string; message: string };
};
export type ImageBatch = {
  id: string;
  protocolVersion: typeof IMAGE_BATCH_PROTOCOL;
  createdAt: string;
  updatedAt: string;
  status: "queued" | "in_progress" | "completed" | "partial" | "failed";
  brief: ImageBatchBrief;
  outputPlan?: ImageBatchOutputPlan;
  variantCount: number;
  variants: ImageVariant[];
  selection: null | { variantId: string; revision: number; selectedAt: string };
};

export interface ImageBatchRepository {
  create(draft: ImageBatchDraft, signal?: AbortSignal): Promise<ImageBatch>;
  get(batchId: string, signal?: AbortSignal): Promise<ImageBatch>;
  select(batchId: string, variantId: string, signal?: AbortSignal): Promise<ImageBatch>;
}

const adultSensualPattern = /\b(sensual(?:ly)?|erotic(?:a|ally)?|seductiv(?:e|ely)|provocativ(?:e|ely)|sex(?:y|ily)|sexual\s+expression|lingerie|boudoir|fetish)\b|관능적|에로틱|유혹적|도발적|섹시|성적\s*표현|란제리|부두아르|페티시|야한/i;
const fictionalAttestationPattern = /\b(fictional|non[- ]identifying|imaginary|invented|original character)\b|가상|비식별|창작(?:한|된)?\s*인물/i;
export function hasAdultSensualDirection(story: string) { return adultSensualPattern.test(story); }
export function hasFictionalAttestation(story: string) { return fictionalAttestationPattern.test(story); }
export function hasAgeCodedAdultFashionConflict(brief: ImageBatchBrief) {
  return brief.wardrobe === "school_inspired" && hasAdultSensualDirection(brief.story);
}
export function hasAdultSensualSubjectConflict(brief: ImageBatchBrief) {
  return brief.subjectKind !== "human" && hasAdultSensualDirection(brief.story);
}
export function hasHumanAttestationConflict(brief: ImageBatchBrief) {
  return brief.subjectKind === "human" && !hasFictionalAttestation(brief.story);
}

type SubjectDependentBrief = Pick<ImageBatchBrief, "subjectDetail" | "age" | "presentation" | "ethnicity" | "country" | "peopleCount" | "profession" | "wardrobe">;
type DeepReadonly<T> = { readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K] };

export const IMAGE_BATCH_SUBJECT_DEFAULTS: DeepReadonly<Record<SubjectKind, SubjectDependentBrief>> = Object.freeze({
  human: Object.freeze({ subjectDetail: "fictional_adult", age: "adult_30s", presentation: "unspecified", ethnicity: "east_asian", country: "south_korea", peopleCount: "one", profession: "office_worker", wardrobe: "casual" }),
  animal: Object.freeze({ subjectDetail: "dog", age: "not_applicable", presentation: "unspecified", ethnicity: "not_applicable", country: "not_applicable", peopleCount: "zero", profession: "none", wardrobe: "none" }),
  bird: Object.freeze({ subjectDetail: "songbird", age: "not_applicable", presentation: "unspecified", ethnicity: "not_applicable", country: "not_applicable", peopleCount: "zero", profession: "none", wardrobe: "none" }),
});

export const DEFAULT_IMAGE_BATCH_SETTINGS: DeepReadonly<ImageBatchFormSettings> = Object.freeze({
  brief: Object.freeze({
    subjectKind: "human",
    ...IMAGE_BATCH_SUBJECT_DEFAULTS.human,
    era: "contemporary",
    weather: "rain",
    environment: "city",
    cameraAngle: "three_quarter",
    framing: "upper_body",
    lighting: "neon_night",
    mood: "dramatic",
    perspective: "third_person",
    story: "A fictional adult makes a calm decision in an original rainy city scene with cinematic light.",
  }),
  mode: "text_to_photo",
  referenceFocus: Object.freeze({ preserveSubjectVisuals: true, preserveBackgroundLayout: true, preserveCameraComposition: true }),
  outputPlan: Object.freeze({ kind: "still", frameCount: 12 }),
  variantCount: 3,
  rightsAccepted: false,
});

export function createDefaultImageBatchFormSettings(): ImageBatchFormSettings {
  return {
    brief: { ...DEFAULT_IMAGE_BATCH_SETTINGS.brief },
    mode: DEFAULT_IMAGE_BATCH_SETTINGS.mode,
    referenceFocus: { ...DEFAULT_IMAGE_BATCH_SETTINGS.referenceFocus },
    outputPlan: { ...DEFAULT_IMAGE_BATCH_SETTINGS.outputPlan },
    variantCount: DEFAULT_IMAGE_BATCH_SETTINGS.variantCount,
    rightsAccepted: DEFAULT_IMAGE_BATCH_SETTINGS.rightsAccepted,
  };
}

export function applySubjectKindDefaults(brief: ImageBatchBrief, subjectKind: SubjectKind): ImageBatchBrief {
  return { ...brief, subjectKind, ...IMAGE_BATCH_SUBJECT_DEFAULTS[subjectKind] };
}
