import { classifyImageDirection } from "./image-direction-policy.mjs";

const enumOf = (...values) => new Set(values);
const issue = (field, message, code) => ({ field, message, code });
const cleanText = (value) => typeof value === "string" ? value.trim() : "";

export const IMAGE_BATCH_PROTOCOL = "image-batch.v1";
export const IMAGE_BATCH_STORY_MIN_LENGTH = 20;
export const IMAGE_BATCH_STORY_MAX_LENGTH = 400;
export const IMAGE_PROJECT_DETAIL_PROMPT_MAX_LENGTH = 700;
export const IMAGE_BATCH_OPTIONS = Object.freeze({
  subjectKind: Object.freeze({ human: "Fictional adult human age 20+", animal: "Animal", bird: "Bird" }),
  subjectDetail: Object.freeze({ fictional_adult: "Fictional adult 20+", dog: "Dog", cat: "Cat", horse: "Horse", wildlife: "Wildlife", songbird: "Songbird", raptor: "Raptor", waterbird: "Water bird" }),
  age: Object.freeze({ not_applicable: "Not applicable", adult_20s: "Adult in their 20s", adult_30s: "Adult in their 30s", adult_40s: "Adult in their 40s", adult_50_plus: "Adult 50+" }),
  era: Object.freeze({ contemporary: "Contemporary", nineties: "1990s", historical: "Early 20th century", future: "Near future" }),
  weather: Object.freeze({ clear: "Clear", rain: "Rain", snow: "Snow", fog: "Fog", storm: "Storm" }),
  environment: Object.freeze({ city: "City", interior: "Interior", coast: "Coast", forest: "Forest", studio: "Studio set" }),
  cameraAngle: Object.freeze({ eye_level: "Eye level", low_angle: "Low angle", high_angle: "High angle", three_quarter: "Three-quarter", overhead: "Overhead", dutch: "Dutch angle" }),
  presentation: Object.freeze({ unspecified: "Unspecified", feminine: "Feminine", masculine: "Masculine", androgynous: "Androgynous" }),
  ethnicity: Object.freeze({ not_applicable: "N/A", unspecified: "Unspecified", east_asian: "East Asian", southeast_asian: "Southeast Asian", south_asian: "South Asian", black: "Black", white: "White", middle_eastern: "Middle Eastern", latino_hispanic: "Latino/Hispanic", multiracial: "Multiracial" }),
  country: Object.freeze({ not_applicable: "N/A", unspecified: "Unspecified", south_korea: "South Korea", japan: "Japan", china: "China", united_states: "United States", united_kingdom: "United Kingdom", france: "France", thailand: "Thailand", vietnam: "Vietnam", india: "India", brazil: "Brazil" }),
  framing: Object.freeze({ portrait: "Portrait", upper_body: "Upper body", full_body: "Full body", hands_detail: "Hands detail" }),
  lighting: Object.freeze({ soft_daylight: "Soft daylight", golden_hour: "Golden hour", neon_night: "Neon night", low_key: "Low key", high_key: "High key" }),
  mood: Object.freeze({ calm: "Calm", joyful: "Joyful", tense: "Tense", mysterious: "Mysterious", dramatic: "Dramatic" }),
  perspective: Object.freeze({ first_person: "First person", second_person: "Second person", third_person: "Third person" }),
  wardrobe: Object.freeze({ none: "N/A", bikini: "Adult bikini; opaque, non-explicit coverage", rash_guard: "Adult rash guard", monokini: "Adult monokini; opaque, non-explicit coverage", one_piece_swimsuit: "Adult one-piece swimsuit", micro_bikini: "Adult micro bikini; opaque, non-explicit coverage", lingerie: "Adult lingerie", school_inspired: "Adult school-inspired outfit", casual: "Casual", formal: "Formal" }),
  profession: Object.freeze({ none: "N/A", kpop_idol: "Fictional K-pop idol", fashion_model: "Fictional fashion model", announcer: "Fictional announcer", flight_attendant: "Flight attendant", police_officer: "Police officer", office_worker: "Office worker", adult_university_student: "Adult university student", other_professional: "Other professional" }),
  peopleCount: Object.freeze({ zero: "No people", one: "One", two: "Two", group: "Three or more" }),
});

const SUBJECT_DETAILS = Object.freeze({
  human: enumOf("fictional_adult"),
  animal: enumOf("dog", "cat", "horse", "wildlife"),
  bird: enumOf("songbird", "raptor", "waterbird"),
});
export function validateImageBatchDraft(input = {}) {
  const errors = [];
  if (input.protocolVersion !== IMAGE_BATCH_PROTOCOL) errors.push(issue("protocolVersion", `Use ${IMAGE_BATCH_PROTOCOL}.`, "batch_protocol"));
  if (!Number.isInteger(input.variantCount) || input.variantCount < 1 || input.variantCount > 3) errors.push(issue("variantCount", "Choose between one and three variants.", "batch_count"));
  const clientRequestId = cleanText(input.clientRequestId);
  if (!/^[a-zA-Z0-9-]{12,60}$/.test(clientRequestId)) errors.push(issue("clientRequestId", "A valid batch submission identifier is required.", "batch_submission_id"));
  if (input.rightsAccepted !== true) errors.push(issue("rightsAccepted", "Original-content and fictional-adult acknowledgement is required.", "batch_rights"));
  const briefInput = input.brief && typeof input.brief === "object" && !Array.isArray(input.brief) ? input.brief : {};
  const compatibilityDefaults = briefInput.subjectKind === "human"
    ? { age: "adult_20s", presentation: "unspecified", ethnicity: "unspecified", country: "unspecified", framing: "full_body", peopleCount: "one" }
    : { age: "not_applicable", presentation: "unspecified", ethnicity: "not_applicable", country: "not_applicable", framing: "full_body", peopleCount: "zero" };
  const brief = {};
  for (const [key, options] of Object.entries(IMAGE_BATCH_OPTIONS)) {
    const value = cleanText(briefInput[key] ?? compatibilityDefaults[key]);
    brief[key] = value;
    if (!Object.hasOwn(options, value)) errors.push(issue(`brief.${key}`, "Choose one supported value.", key === "subjectKind" || key === "subjectDetail" ? "batch_subject" : "batch_condition"));
  }
  const story = cleanText(briefInput.story);
  brief.story = story;
  if (story.length < IMAGE_BATCH_STORY_MIN_LENGTH || story.length > IMAGE_BATCH_STORY_MAX_LENGTH) errors.push(issue("brief.story", `Describe the scene in ${IMAGE_BATCH_STORY_MIN_LENGTH} to ${IMAGE_BATCH_STORY_MAX_LENGTH} characters.`, "batch_story"));
  const directionPolicy = classifyImageDirection(story, { schoolInspired: brief.wardrobe === "school_inspired" });
  if (brief.subjectKind === "human" && !directionPolicy.fictionalAttested && !directionPolicy.blockingCodes.includes("real_person_blocked")) directionPolicy.blockingCodes.push("real_person_blocked");
  const storyBlockingCodes = directionPolicy.blockingCodes.filter((code) => code !== "age_coded_sexualization_blocked");
  if (storyBlockingCodes.length) errors.push(issue("brief.story", "Use a fictional adult age 20+ direction without real people, minors, age ambiguity, explicit sexual activity, pornography, or coercion.", storyBlockingCodes.join(",")));
  if (directionPolicy.blockingCodes.includes("age_coded_sexualization_blocked")) errors.push(issue("brief.wardrobe,brief.story", "Adult school-inspired fashion cannot be combined with sensual or erotic direction.", "age_coded_sexualization_blocked"));

  const subjectDetails = SUBJECT_DETAILS[brief.subjectKind];
  if (subjectDetails && !subjectDetails.has(brief.subjectDetail)) errors.push(issue("brief.subjectDetail", "The subject detail does not match the subject kind.", "batch_subject"));
  if (brief.subjectKind !== "human" && (brief.profession !== "none" || brief.wardrobe !== "none")) errors.push(issue("brief", "Animal and bird subjects cannot use human professions or wardrobe.", "batch_subject_combination"));
  if (brief.subjectKind !== "human" && (brief.age !== "not_applicable" || brief.peopleCount !== "zero" || brief.presentation !== "unspecified" || brief.ethnicity !== "not_applicable" || brief.country !== "not_applicable")) errors.push(issue("brief", "Animal and bird subjects require non-person age, presentation, ethnicity, country, and count values.", "batch_subject_combination"));
  if (brief.subjectKind !== "human" && directionPolicy.adultNonGraphic) errors.push(issue("brief.subjectKind,brief.story", "Sensual or erotic styling requires a fictional adult human age 20+.", "batch_adult_safety"));
  if (brief.subjectKind === "human" && (brief.profession === "none" || brief.wardrobe === "none")) errors.push(issue("brief", "A fictional adult human needs a supported profession and wardrobe.", "batch_subject_combination"));
  if (brief.subjectKind === "human" && (brief.age === "not_applicable" || brief.peopleCount === "zero")) errors.push(issue("brief", "A fictional adult human requires an adult age and at least one person.", "batch_subject_combination"));
  if (brief.subjectKind === "human" && (brief.ethnicity === "not_applicable" || brief.country === "not_applicable")) errors.push(issue("brief.ethnicity,brief.country", "A human subject requires supported casting and country selections.", "batch_subject_combination"));
  const adultOnlyWardrobes = new Set(["bikini", "rash_guard", "monokini", "one_piece_swimsuit", "micro_bikini", "lingerie"]);
  if (adultOnlyWardrobes.has(brief.wardrobe) && (brief.subjectKind !== "human" || brief.age === "not_applicable")) errors.push(issue("brief.wardrobe", "Adult swimwear and lingerie are available only for a fictional adult human age 20+.", "batch_adult_safety"));
  if (brief.wardrobe === "school_inspired" && (brief.subjectKind !== "human" || brief.profession !== "adult_university_student")) errors.push(issue("brief.wardrobe", "The adult school-inspired outfit requires an adult university student subject.", "batch_adult_safety"));

  let sourceInput = null;
  if (input.sourceInput !== undefined) {
    const source = input.sourceInput && typeof input.sourceInput === "object" && !Array.isArray(input.sourceInput) ? input.sourceInput : {};
    const referenceImage = source.referenceImage && typeof source.referenceImage === "object" ? source.referenceImage : {};
    const focus = source.referenceFocus && typeof source.referenceFocus === "object" ? source.referenceFocus : {};
    const supportedMime = ["image/png", "image/jpeg", "image/webp"].includes(referenceImage.mimeType);
    const supportedData = typeof referenceImage.dataUrl === "string" && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(referenceImage.dataUrl);
    const focusKeys = ["preserveSubjectVisuals", "preserveBackgroundLayout", "preserveCameraComposition"];
    const supportedFocus = focusKeys.every((key) => typeof focus[key] === "boolean") && focusKeys.some((key) => focus[key]);
    if (source.kind !== "attested_original_2d" || !supportedMime || !supportedData || !supportedFocus) errors.push(issue("sourceInput", "Attach one supported attested original 2D input with at least one preservation focus.", "batch_source"));
    else sourceInput = { kind: "attested_original_2d", referenceImage: { mimeType: referenceImage.mimeType, dataUrl: referenceImage.dataUrl }, referenceFocus: Object.fromEntries(focusKeys.map((key) => [key, focus[key]])) };
  }

  const outputInput = input.outputPlan && typeof input.outputPlan === "object" && !Array.isArray(input.outputPlan) ? input.outputPlan : {};
  const outputKind = cleanText(outputInput.kind || "still");
  const frameCount = outputKind === "motion_gif" ? Number(outputInput.frameCount) : 1;
  if (!enumOf("still", "motion_gif").has(outputKind)) errors.push(issue("outputPlan.kind", "Choose a still image or motion GIF.", "batch_output"));
  if (!Number.isInteger(frameCount) || frameCount < (outputKind === "motion_gif" ? 2 : 1) || frameCount > (outputKind === "motion_gif" ? 30 : 1)) errors.push(issue("outputPlan.frameCount", "Choose 2 to 30 GIF frames, or one still frame.", "batch_output"));

  return { errors, draft: { protocolVersion: IMAGE_BATCH_PROTOCOL, variantCount: input.variantCount, clientRequestId, rightsAccepted: input.rightsAccepted === true, brief, sourceInput, outputPlan: { kind: outputKind, frameCount } } };
}

const settingMap = Object.freeze({ city: "city_night", interior: "sunlit_room", coast: "coastal_nature", forest: "coastal_nature", studio: "studio_set" });
const angleMap = Object.freeze({ eye_level: "eye_level", low_angle: "low_angle", high_angle: "high_angle", three_quarter: "three_quarter", overhead: "high_angle", dutch: "three_quarter" });
const clothingMap = Object.freeze({ none: "casual", bikini: "casual", rash_guard: "casual", monokini: "casual", one_piece_swimsuit: "casual", micro_bikini: "casual", lingerie: "casual", school_inspired: "historical", casual: "casual", formal: "tailored" });
const treatments = Object.freeze([
  "Editorial realism; restrained colour; balanced composition",
  "Cinematic contrast; expressive depth; distinct focus",
  "Documentary realism; natural detail; alternate distance",
]);

export function toPhotoProjectDraft(batchDraft, variantIndex) {
  const { brief } = batchDraft;
  const human = brief.subjectKind === "human";
  const conditions = {
    subject: human ? "fictional_adult" : "no_person",
    age: brief.age,
    era: brief.era,
    setting: settingMap[brief.environment],
    presentation: brief.presentation,
    framing: brief.framing,
    cameraAngle: angleMap[brief.cameraAngle],
    clothing: clothingMap[brief.wardrobe],
    peopleCount: brief.peopleCount,
  };
  const structuredDirection = [
    brief.story,
    `${IMAGE_BATCH_OPTIONS.subjectDetail[brief.subjectDetail]}.`,
    `${IMAGE_BATCH_OPTIONS.weather[brief.weather]}; ${IMAGE_BATCH_OPTIONS.environment[brief.environment]}.`,
    `${IMAGE_BATCH_OPTIONS.cameraAngle[brief.cameraAngle]}; ${IMAGE_BATCH_OPTIONS.perspective[brief.perspective]}.`,
    `${IMAGE_BATCH_OPTIONS.lighting[brief.lighting]}; ${IMAGE_BATCH_OPTIONS.mood[brief.mood]}.`,
    ...(human ? [`Adult: ${IMAGE_BATCH_OPTIONS.ethnicity[brief.ethnicity]}; ${IMAGE_BATCH_OPTIONS.country[brief.country]}; ${IMAGE_BATCH_OPTIONS.profession[brief.profession]}; ${IMAGE_BATCH_OPTIONS.wardrobe[brief.wardrobe]}.`] : []),
    `V${variantIndex + 1}: ${treatments[variantIndex]}.`,
  ].join(" ");
  if (structuredDirection.length > IMAGE_PROJECT_DETAIL_PROMPT_MAX_LENGTH) throw new RangeError("Mapped image-project detail prompt exceeds its 700-character contract.");
  return {
    mode: batchDraft.sourceInput ? "animation_2d_to_photo" : "text_to_photo",
    outputKind: batchDraft.outputPlan.kind,
    frameCount: batchDraft.outputPlan.frameCount,
    detailPrompt: structuredDirection,
    conditions,
    rightsAccepted: true,
    clientRequestId: `${batchDraft.clientRequestId}-v${variantIndex + 1}`,
    ...(batchDraft.sourceInput ? { referenceImage: batchDraft.sourceInput.referenceImage, referenceFocus: batchDraft.sourceInput.referenceFocus } : {}),
  };
}

export function deriveBatchStatus(variants) {
  const statuses = variants.map((variant) => variant.status);
  const completed = statuses.filter((status) => status === "completed").length;
  const failed = statuses.filter((status) => status === "failed").length;
  if (completed === variants.length) return "completed";
  if (failed === variants.length) return "failed";
  if (completed + failed === variants.length) return "partial";
  if (statuses.every((status) => status === "queued")) return "queued";
  return "in_progress";
}

export function treatmentForVariant(index) { return treatments[index] ?? treatments[0]; }
