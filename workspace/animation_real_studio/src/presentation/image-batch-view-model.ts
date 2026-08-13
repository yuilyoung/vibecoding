import { applySubjectKindDefaults, createDefaultImageBatchFormSettings, DEFAULT_IMAGE_BATCH_SETTINGS, hasAdultSensualSubjectConflict, hasAgeCodedAdultFashionConflict, hasHumanAttestationConflict, IMAGE_BATCH_PROTOCOL, IMAGE_BATCH_STORY_MAX_LENGTH, IMAGE_BATCH_STORY_MIN_LENGTH, type ImageBatch, type ImageBatchBrief, type ImageBatchMode, type ImageBatchReferenceFocus, type ImageBatchRepository, type ImageBatchSourceInput, type SubjectKind } from "../business/image-batch.ts";

const activeStatuses = new Set<ImageBatch["status"]>(["queued", "in_progress"]);
export type ImageBatchPollState = "idle" | "live" | "retrying" | "disconnected";

export type ImageBatchViewModelState = {
  brief: ImageBatchBrief;
  variantCount: 1 | 2 | 3;
  mode: ImageBatchMode;
  sourceInput: ImageBatchSourceInput | null;
  sourceLabel: string;
  referenceFocus: ImageBatchReferenceFocus;
  outputKind: "still" | "motion_gif";
  frameCount: number;
  rightsAccepted: boolean;
  batch: ImageBatch | null;
  error: string;
  pollError: string;
  pollState: ImageBatchPollState;
  consecutivePollFailures: number;
  lastSuccessfulPollAt: number | null;
  isSubmitting: boolean;
  isActive: boolean;
  canSubmit: boolean;
  policyMessage: string;
  selectingVariantId: string | null;
};

type ViewModelOptions = { pollIntervalMs?: number; createRequestId?: () => string; now?: () => number };

export class ImageBatchViewModel {
  private readonly repository: ImageBatchRepository;
  private state: ImageBatchViewModelState;
  private readonly listeners = new Set<() => void>();
  private readonly pollIntervalMs: number;
  private readonly createRequestId: () => string;
  private readonly now: () => number;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollController: AbortController | null = null;
  private commandController: AbortController | null = null;
  private sourceInputRevision = 0;
  private disposed = false;

  constructor(repository: ImageBatchRepository, options: ViewModelOptions = {}) {
    this.repository = repository;
    this.pollIntervalMs = options.pollIntervalMs ?? 750;
    this.createRequestId = options.createRequestId ?? (() => typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `batch-${Date.now()}-request`);
    this.now = options.now ?? Date.now;
    const defaults = createDefaultImageBatchFormSettings();
    this.state = this.withDerived({ brief: defaults.brief, variantCount: defaults.variantCount, mode: defaults.mode, sourceInput: null, sourceLabel: "", referenceFocus: defaults.referenceFocus, outputKind: defaults.outputPlan.kind, frameCount: defaults.outputPlan.frameCount, rightsAccepted: defaults.rightsAccepted, batch: null, error: "", pollError: "", pollState: "idle", consecutivePollFailures: 0, lastSuccessfulPollAt: null, isSubmitting: false, isActive: false, canSubmit: false, policyMessage: "", selectingVariantId: null });
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private withDerived(state: ImageBatchViewModelState) {
    const isActive = Boolean(state.batch && activeStatuses.has(state.batch.status));
    const ageCodedConflict = hasAgeCodedAdultFashionConflict(state.brief);
    const subjectConflict = hasAdultSensualSubjectConflict(state.brief);
    const attestationConflict = hasHumanAttestationConflict(state.brief);
    const sourceReady = state.mode === "text_to_photo" || state.sourceInput !== null;
    const canSubmit = state.rightsAccepted && sourceReady && state.brief.story.trim().length >= IMAGE_BATCH_STORY_MIN_LENGTH && state.brief.story.trim().length <= IMAGE_BATCH_STORY_MAX_LENGTH && !ageCodedConflict && !subjectConflict && !attestationConflict && !state.isSubmitting && !isActive;
    const policyMessage = ageCodedConflict
      ? "교복풍 의상은 관능적·에로틱 연출과 함께 사용할 수 없습니다. 성인용 비성적 패션으로 수정해 주세요."
      : subjectConflict ? "관능적·에로틱 연출은 가상 성인 사람(20세 이상)에게만 사용할 수 있습니다."
      : attestationConflict ? "사람 장면에는 ‘가상’·‘비식별’ 또는 ‘fictional’ 선언을 장면 설명에 포함해 주세요." : "";
    return { ...state, isActive, canSubmit, policyMessage };
  }

  private setState(patch: Partial<ImageBatchViewModelState>) {
    if (this.disposed) return;
    this.state = this.withDerived({ ...this.state, ...patch });
    this.listeners.forEach((listener) => listener());
  }

  updateBrief = <K extends keyof ImageBatchBrief>(key: K, value: ImageBatchBrief[K]) => {
    const next = key === "subjectKind" ? applySubjectKindDefaults(this.state.brief, value as SubjectKind) : { ...this.state.brief, [key]: value };
    if (key === "wardrobe" && value === "school_inspired") next.profession = "adult_university_student";
    if (key === "profession" && value !== "adult_university_student" && next.wardrobe === "school_inspired") next.wardrobe = "casual";
    this.setState({ brief: next });
  };

  setVariantCount = (variantCount: 1 | 2 | 3) => this.setState({ variantCount });
  setMode = (mode: ImageBatchMode) => {
    if (mode === "text_to_photo") this.sourceInputRevision += 1;
    this.setState(mode === "text_to_photo" ? { mode, sourceInput: null, sourceLabel: "", referenceFocus: { ...DEFAULT_IMAGE_BATCH_SETTINGS.referenceFocus } } : { mode });
  };
  beginSourceInputRead = () => {
    this.sourceInputRevision += 1;
    this.setState({ sourceInput: null, sourceLabel: "", error: "" });
    return this.sourceInputRevision;
  };
  setSourceInput = (sourceInput: ImageBatchSourceInput, sourceLabel: string, revision?: number) => {
    if (this.state.mode !== "animation_2d_to_photo" || (revision !== undefined && revision !== this.sourceInputRevision)) return;
    this.setState({ sourceInput: { ...sourceInput, referenceFocus: { ...this.state.referenceFocus } }, sourceLabel, error: "" });
  };
  setSourceInputError = (error: string, revision?: number) => {
    if (this.state.mode !== "animation_2d_to_photo" || (revision !== undefined && revision !== this.sourceInputRevision)) return;
    this.setState({ sourceInput: null, sourceLabel: "", error });
  };
  toggleReferenceFocus = (key: keyof ImageBatchReferenceFocus) => {
    if (this.state.referenceFocus[key] && Object.values(this.state.referenceFocus).filter(Boolean).length === 1) return;
    const referenceFocus = { ...this.state.referenceFocus, [key]: !this.state.referenceFocus[key] };
    const sourceInput = this.state.sourceInput ? { ...this.state.sourceInput, referenceFocus } : null;
    this.setState({ referenceFocus, sourceInput });
  };
  setOutputKind = (outputKind: "still" | "motion_gif") => this.setState({ outputKind });
  setFrameCount = (frameCount: number) => this.setState({ frameCount: Math.max(2, Math.min(30, Math.round(frameCount))) });
  setRightsAccepted = (rightsAccepted: boolean) => this.setState({ rightsAccepted });

  submit = async () => {
    if (!this.state.canSubmit) { this.setState({ error: this.state.policyMessage || `${IMAGE_BATCH_STORY_MIN_LENGTH}–${IMAGE_BATCH_STORY_MAX_LENGTH}자의 장면 설명과 성인·원본 안전 확인이 필요합니다.` }); return; }
    this.commandController?.abort();
    const controller = new AbortController();
    this.commandController = controller;
    this.setState({ isSubmitting: true, error: "", pollError: "", pollState: "idle", consecutivePollFailures: 0, lastSuccessfulPollAt: null });
    try {
      const batch = await this.repository.create({ protocolVersion: IMAGE_BATCH_PROTOCOL, variantCount: this.state.variantCount, clientRequestId: this.createRequestId(), rightsAccepted: this.state.rightsAccepted, brief: this.state.brief, outputPlan: { kind: this.state.outputKind, frameCount: this.state.outputKind === "motion_gif" ? this.state.frameCount : 1 }, ...(this.state.mode === "animation_2d_to_photo" && this.state.sourceInput ? { sourceInput: this.state.sourceInput } : {}) }, controller.signal);
      this.setState({ batch, pollState: activeStatuses.has(batch.status) ? "live" : "idle", consecutivePollFailures: 0, lastSuccessfulPollAt: this.now() });
      this.startPollingIfNeeded();
    } catch (requestError) {
      if (!controller.signal.aborted) this.setState({ error: requestError instanceof Error ? requestError.message : "이미지 배치를 시작할 수 없습니다." });
    } finally {
      if (this.commandController === controller) this.commandController = null;
      this.setState({ isSubmitting: false });
    }
  };

  selectVariant = async (variantId: string) => {
    if (!this.state.batch || this.state.selectingVariantId) return;
    this.commandController?.abort();
    const controller = new AbortController();
    this.commandController = controller;
    this.setState({ selectingVariantId: variantId, error: "" });
    try { this.setState({ batch: await this.repository.select(this.state.batch.id, variantId, controller.signal) }); }
    catch (requestError) { if (!controller.signal.aborted) this.setState({ error: requestError instanceof Error ? requestError.message : "결과를 선택할 수 없습니다." }); }
    finally {
      if (this.commandController === controller) this.commandController = null;
      this.setState({ selectingVariantId: null });
    }
  };

  private startPollingIfNeeded() {
    this.stopPolling();
    if (!this.state.batch || !activeStatuses.has(this.state.batch.status) || this.disposed) return;
    const batchId = this.state.batch.id;
    const controller = new AbortController();
    this.pollController = controller;
    const poll = async () => {
      try {
        const batch = await this.repository.get(batchId, controller.signal);
        if (controller.signal.aborted || this.pollController !== controller) return;
        this.setState({ batch, pollError: "", pollState: activeStatuses.has(batch.status) ? "live" : "idle", consecutivePollFailures: 0, lastSuccessfulPollAt: this.now() });
        if (activeStatuses.has(batch.status) && !controller.signal.aborted) this.pollTimer = setTimeout(() => { void poll(); }, this.pollIntervalMs);
        else this.stopPolling();
      } catch (requestError) {
        if (!controller.signal.aborted) {
          const consecutivePollFailures = this.state.consecutivePollFailures + 1;
          this.setState({
            pollError: requestError instanceof Error ? requestError.message : "배치 상태를 불러올 수 없습니다.",
            pollState: consecutivePollFailures >= 3 ? "disconnected" : "retrying",
            consecutivePollFailures,
          });
          this.pollTimer = setTimeout(() => { void poll(); }, this.pollIntervalMs);
        }
      }
    };
    this.pollTimer = setTimeout(() => { void poll(); }, this.pollIntervalMs);
  }

  private stopPolling() {
    if (this.pollTimer !== null) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.pollController?.abort();
    this.pollController = null;
  }

  activate = () => {
    this.disposed = false;
    this.startPollingIfNeeded();
  };

  startNewGeneration = () => {
    this.stopPolling();
    this.setState({ batch: null, pollError: "", pollState: "idle", consecutivePollFailures: 0, lastSuccessfulPollAt: null, selectingVariantId: null });
  };

  dispose = () => {
    this.disposed = true;
    this.stopPolling();
    this.commandController?.abort();
    this.commandController = null;
    this.listeners.clear();
  };
}
