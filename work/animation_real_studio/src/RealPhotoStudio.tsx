import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPhotorealisticProject, fetchPhotorealisticProject, type PhotoConditions, type PhotoMode, type PhotoOutputKind, type PhotoReferenceFocus, type PhotorealisticProject } from "./studio-api";

type ConditionKey = keyof PhotoConditions;
type ConditionOption = { value: string; label: string };

const DEFAULT_CONDITIONS: PhotoConditions = { subject: "fictional_adult", age: "adult_30s", era: "contemporary", setting: "city_night", presentation: "unspecified", framing: "upper_body", cameraAngle: "three_quarter", clothing: "casual", peopleCount: "one" };
const CONDITION_GROUPS: Array<{ key: ConditionKey; label: string; options: ConditionOption[] }> = [
  { key: "subject", label: "인물", options: [{ value: "fictional_adult", label: "가상 성인" }, { value: "no_person", label: "인물 없음" }] },
  { key: "age", label: "나이", options: [{ value: "adult_20s", label: "20대 성인" }, { value: "adult_30s", label: "30대 성인" }, { value: "adult_40s", label: "40대 성인" }, { value: "adult_50_plus", label: "50대 이상 성인" }, { value: "not_applicable", label: "해당 없음" }] },
  { key: "era", label: "시대", options: [{ value: "contemporary", label: "현대" }, { value: "nineties", label: "1990년대" }, { value: "historical", label: "20세기 초" }, { value: "future", label: "근미래" }] },
  { key: "setting", label: "배경", options: [{ value: "city_night", label: "비 오는 도시의 밤" }, { value: "sunlit_room", label: "햇살 든 실내" }, { value: "coastal_nature", label: "해안 자연" }, { value: "studio_set", label: "오리지널 스튜디오 세트" }] },
  { key: "presentation", label: "성별 표현", options: [{ value: "unspecified", label: "지정 안 함" }, { value: "feminine", label: "여성적" }, { value: "masculine", label: "남성적" }, { value: "androgynous", label: "중성적" }] },
  { key: "framing", label: "부위 / 프레이밍", options: [{ value: "portrait", label: "얼굴 중심" }, { value: "upper_body", label: "상반신" }, { value: "full_body", label: "전신" }, { value: "hands_detail", label: "손 디테일" }] },
  { key: "cameraAngle", label: "각도", options: [{ value: "eye_level", label: "눈높이" }, { value: "low_angle", label: "로우 앵글" }, { value: "high_angle", label: "하이 앵글" }, { value: "three_quarter", label: "사선 3/4" }] },
  { key: "clothing", label: "옷", options: [{ value: "casual", label: "캐주얼" }, { value: "tailored", label: "테일러드" }, { value: "historical", label: "시대감 있는 의상" }, { value: "functional", label: "기능성 아우터" }] },
  { key: "peopleCount", label: "사람 수", options: [{ value: "zero", label: "0명" }, { value: "one", label: "1명" }, { value: "two", label: "2명" }, { value: "group", label: "3명 이상" }] },
];

const PHASE_COPY: Record<PhotorealisticProject["job"]["phase"], string> = { validated: "요청과 조건을 검증했습니다", workspace_prepared: "안전한 임시 작업공간을 준비했습니다", provider_started: "이미지 생성기에 실제 요청을 전달했습니다", output_validated: "반환 이미지를 검증하고 있습니다", gif_encoding: "모션 GIF를 조립하고 있습니다", artifact_ready: "결과 파일을 검증해 전달 준비를 마쳤습니다", completed: "이미지 생성이 완료되었습니다", failed: "생성 작업이 실패했습니다" };
const DEFAULT_REFERENCE_FOCUS: PhotoReferenceFocus = { preserveSubjectVisuals: true, preserveBackgroundLayout: true, preserveCameraComposition: true };
const REFERENCE_FOCUS_OPTIONS: Array<{ key: keyof PhotoReferenceFocus; title: string; description: string }> = [{ key: "preserveSubjectVisuals", title: "캐릭터 시각 특성", description: "실루엣·포즈·의상 범주·색감" }, { key: "preserveBackgroundLayout", title: "배경 배치·조명", description: "공간 구조·초점 요소·빛과 팔레트" }, { key: "preserveCameraComposition", title: "카메라 구도", description: "프레이밍·시점·원근" }];

function makeDefaultPrompt(conditions: PhotoConditions) {
  const group = (key: ConditionKey, value: string) => CONDITION_GROUPS.find((item) => item.key === key)?.options.find((option) => option.value === value)?.label ?? "";
  if (conditions.subject === "no_person") return `${group("setting", conditions.setting)}에서 ${group("era", conditions.era)}의 공기를 담은, ${group("framing", conditions.framing)} ${group("cameraAngle", conditions.cameraAngle)} 실사 시네마틱 장면. 인물은 없이 빛과 질감, 자연스러운 공간감을 강조해 주세요.`;
  return `${group("setting", conditions.setting)}에서 ${group("age", conditions.age)} ${group("presentation", conditions.presentation)} 가상 성인이 ${group("clothing", conditions.clothing)} 차림으로 서 있는, ${group("framing", conditions.framing)} ${group("cameraAngle", conditions.cameraAngle)} 실사 시네마틱 장면. 자연스러운 빛과 물리적으로 설득력 있는 질감을 강조해 주세요.`;
}
function secondsCopy(seconds: number | null, etaState: PhotorealisticProject["job"]["etaState"]) {
  if (seconds === null) return "예상 시간을 넘겼습니다 — 계속 생성 중";
  if (seconds === 0) return "완료";
  if (seconds < 60) return `약 ${Math.max(1, seconds)}초 남음`;
  return `약 ${Math.ceil(seconds / 60)}분 남음`;
}
function etaSourceCopy(project: PhotorealisticProject) {
  if (project.job.etaSource === "bucket_bootstrap") return "초기 추정 · 서버 제한시간과 결과 처리 여유 기준";
  if (project.job.etaSource === "bucket_median") return `완료 표본 ${project.job.durationSampleCount}개 기반 추정`;
  return "완료된 작업";
}

function phaseCopy(project: PhotorealisticProject) {
  if (project.job.phase === "gif_encoding") return `모션 GIF 프레임 ${project.job.encodedFrameCount}/${project.job.requestedFrameCount}을 조립하고 있습니다`;
  return PHASE_COPY[project.job.phase];
}
function isFinalizing(project: PhotorealisticProject) {
  return (project.status === "queued" || project.status === "in_progress") && project.job.finalizationState !== "none";
}
function finalizationCopy(project: PhotorealisticProject) {
  if (project.job.finalizationState === "awaiting_provider_output") return "생성 결과를 대기하며 완료를 확인하고 있습니다.";
  if (project.job.finalizationState === "validating_image") return "반환 이미지 파일을 검증하고 있습니다.";
  if (project.job.finalizationState === "encoding_gif") return `GIF 프레임 ${project.job.encodedFrameCount}/${project.job.requestedFrameCount}을 인코딩하고 있습니다.`;
  if (project.job.finalizationState === "saving_artifact") return "결과 파일을 저장하고 완료를 확인하고 있습니다.";
  return "실제 완료 이벤트를 확인하고 있습니다.";
}
function providerErrorCopy(project: PhotorealisticProject) {
  if (project.error?.providerDiagnostics?.diagnosticCode === "process_permission_denied") {
    return "로컬 API가 Codex 프로세스를 시작할 권한 없이 실행되었습니다. API를 종료한 뒤 자식 프로세스 실행이 허용된 신뢰 가능한 로컬 터미널에서 다시 시작해 주세요.";
  }
  return project.error?.message ?? "이미지 생성 작업이 실패했습니다.";
}
function referenceFocusCopy(focus: PhotoReferenceFocus) {
  const selected = REFERENCE_FOCUS_OPTIONS.filter((option) => focus[option.key]).map((option) => option.title);
  return selected.join(" · ");
}
function observedProgress(project: PhotorealisticProject) {
  if (project.status === "completed") return 100;
  return project.job.progress ?? 0;
}
function progressBasisCopy(project: PhotorealisticProject) {
  if (project.job.progressBasis === "server_lifecycle_and_duration_forecast") {
    return `${etaSourceCopy(project)}입니다. provider 시작 시 5%부터 표시하고, 예상시간을 100등분해 1%씩 90%까지 증가시킵니다. 100%는 실제 완료 검증에서만 표시합니다.`;
  }
  return "모델 렌더 비율이 아닌 서버 확인 단계입니다.";
}
function progressAriaText(project: PhotorealisticProject) {
  return `${etaSourceCopy(project)}, 관측 단계: ${phaseCopy(project)}, ${observedProgress(project)}%${isFinalizing(project) ? `, 완료 대기: ${finalizationCopy(project)}` : ""}`;
}
function dataUrlFromFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

export function RealPhotoStudio() {
  const [mode, setMode] = useState<PhotoMode>("text_to_photo");
  const [conditions, setConditions] = useState<PhotoConditions>(DEFAULT_CONDITIONS);
  const [detailPrompt, setDetailPrompt] = useState(() => makeDefaultPrompt(DEFAULT_CONDITIONS));
  const [referenceImage, setReferenceImage] = useState<{ mimeType: "image/png" | "image/jpeg" | "image/webp"; dataUrl: string } | null>(null);
  const [referenceLabel, setReferenceLabel] = useState("");
  const [referenceFocus, setReferenceFocus] = useState<PhotoReferenceFocus>(DEFAULT_REFERENCE_FOCUS);
  const [outputKind, setOutputKind] = useState<PhotoOutputKind>("still");
  const [frameCount, setFrameCount] = useState(12);
  const [rightsAccepted, setRightsAccepted] = useState(false);
  const [project, setProject] = useState<PhotorealisticProject | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isActive = project?.status === "queued" || project?.status === "in_progress";
  const showProgress = isActive || project?.status === "completed";
  const defaultPrompt = useMemo(() => makeDefaultPrompt(conditions), [conditions]);

  useEffect(() => {
    if (!project || !isActive) return;
    const pollTimer = window.setInterval(() => {
      void fetchPhotorealisticProject(project.id).then(setProject).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "작업 상태를 불러올 수 없습니다."));
    }, 1000);
    return () => { window.clearInterval(pollTimer); };
  }, [project?.id, isActive]);

  function chooseCondition(key: ConditionKey, value: string) {
    setConditions((current) => {
      const next = { ...current, [key]: value } as PhotoConditions;
      if (key === "subject" && value === "no_person") { next.age = "not_applicable"; next.peopleCount = "zero"; }
      if (key === "subject" && value === "fictional_adult" && next.peopleCount === "zero") { next.age = "adult_30s"; next.peopleCount = "one"; }
      if (key === "peopleCount" && value === "zero") { next.subject = "no_person"; next.age = "not_applicable"; }
      if (key === "peopleCount" && value !== "zero" && next.subject === "no_person") { next.subject = "fictional_adult"; next.age = "adult_30s"; }
      return next;
    });
  }
  function chooseMode(nextMode: PhotoMode) {
    setMode(nextMode);
    if (nextMode === "text_to_photo") {
      setReferenceImage(null);
      setReferenceLabel("");
      setReferenceFocus(DEFAULT_REFERENCE_FOCUS);
    }
  }
  function toggleReferenceFocus(key: keyof PhotoReferenceFocus) {
    setReferenceFocus((current) => {
      if (current[key] && Object.values(current).filter(Boolean).length === 1) return current;
      return { ...current, [key]: !current[key] };
    });
  }
  async function chooseReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError("");
    if (!file) return;
    if (!(["image/png", "image/jpeg", "image/webp"] as const).includes(file.type as "image/png")) { setError("2D 원본은 PNG, JPEG 또는 WebP만 사용할 수 있습니다."); return; }
    if (file.size > 6 * 1024 * 1024) { setError("2D 원본은 6 MB 이하만 사용할 수 있습니다."); return; }
    try {
      setReferenceImage({ mimeType: file.type as "image/png" | "image/jpeg" | "image/webp", dataUrl: await dataUrlFromFile(file) });
      setReferenceLabel(`${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`);
    } catch (readError) { setError(readError instanceof Error ? readError.message : "파일을 읽을 수 없습니다."); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting || isActive) return;
    if (mode === "animation_2d_to_photo" && !referenceImage) { setError("실사화할 2D 원본 이미지를 먼저 선택해 주세요."); return; }
    if (!rightsAccepted) { setError("원본 권리와 성인·비식별 기준을 확인해 주세요."); return; }
    setIsSubmitting(true);
    setError("");
    try {
      const clientRequestId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `photo-${Date.now()}-local-request`;
      const created = await createPhotorealisticProject({ mode, outputKind, frameCount: outputKind === "motion_gif" ? frameCount : 1, detailPrompt, conditions, rightsAccepted, clientRequestId, ...(mode === "animation_2d_to_photo" && referenceImage ? { referenceImage, referenceFocus } : {}) });
      setProject(created);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "실사 이미지 작업을 시작할 수 없습니다."); }
    finally { setIsSubmitting(false); }
  }
  const displayElapsed = project?.job.elapsedSeconds ?? 0;
  const displayProgress = project ? observedProgress(project) : 0;
  const finalizing = project ? isFinalizing(project) : false;

  return <div className="real-photo-page">
    <section className="real-photo-intro"><p className="eyebrow">TRUSTED LOCAL EXPERIMENT / PHOTO STILL</p><h1>참조의 시각과<br /><i>내 스토리</i>를 함께 만듭니다.</h1><p>2D 원본에서 지킬 시각 요소를 직접 고르고, 스토리 지시로 행동·감정·사건을 결정하세요. 모델 렌더 퍼센트 대신 실제 서버 단계와 완료 시간 추정치를 표시합니다.</p></section>
    <nav className="photo-process-rail" aria-label="실사화 제작 순서"><ol><li><b>01</b><span>참조 선택</span></li><li><b>02</b><span>보존 범위</span></li><li><b>03</b><span>스토리 지시</span></li><li><b>04</b><span>생성 계획</span></li></ol></nav>
    <form className="photo-studio" onSubmit={submit}>
      <section className="photo-control-panel photo-mode-panel">
        <div className="photo-section-head"><span>01</span><div><p>MODE &amp; BOUNDARY</p><h2>어떤 재료로 시작할까요?</h2></div></div>
        <div className="mode-grid" role="radiogroup" aria-label="실사 이미지 생성 방식">
          <button type="button" className={mode === "text_to_photo" ? "selected" : ""} role="radio" aria-checked={mode === "text_to_photo"} onClick={() => chooseMode("text_to_photo")}><b>텍스트 → 실사</b><small>스토리와 장면 조건으로 새 이미지를 만듭니다.</small></button>
          <button type="button" className={mode === "animation_2d_to_photo" ? "selected" : ""} role="radio" aria-checked={mode === "animation_2d_to_photo"} onClick={() => chooseMode("animation_2d_to_photo")}><b>2D 애니메이션 → 실사</b><small>권리를 보유한 원본의 선택한 시각 요소를 출발점으로 씁니다.</small></button>
        </div>
        {mode === "animation_2d_to_photo" && <label className="photo-reference"><span>2D 원본 한 장</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseReference} /><small>PNG · JPEG · WebP / 6 MB 이하 / 사람 사진·유명인·원작 캐릭터는 사용할 수 없습니다.</small>{referenceLabel && <b>{referenceLabel}</b>}</label>}
        {mode === "animation_2d_to_photo" && <p id="photo-reference-egress" className="photo-reference-disclosure">선택한 2D 원본은 이번 생성 요청에서만 Codex 이미지 첨부로 전달되고, 작업공간 정리 후 보관하지 않습니다.</p>}
      </section>
      {mode === "animation_2d_to_photo" && <section className="photo-control-panel photo-reference-focus">
        <div className="photo-section-head"><span>02</span><div><p>REFERENCE FOCUS</p><h2>이번 실사화에서 지킬 고정점을 고르세요.</h2></div></div>
        {referenceImage ? <div className="reference-focus-preview"><img src={referenceImage.dataUrl} alt="선택한 2D 원본 미리보기" /><div><span>ATTACHED ORIGINAL</span><b>{referenceLabel}</b><p>이 미리보기는 업로드 확인용입니다. 아래 항목은 모델 분석 결과가 아니라 이번 생성에서 반영을 요청할 요소입니다.</p></div></div> : <p className="reference-focus-empty">원본을 선택하면 보존 범위를 지정할 수 있습니다.</p>}
        <fieldset className="reference-focus-options"><legend>반영을 요청할 시각 요소</legend><div>{REFERENCE_FOCUS_OPTIONS.map((option) => <button type="button" key={option.key} className={referenceFocus[option.key] ? "selected" : ""} aria-pressed={referenceFocus[option.key]} onClick={() => toggleReferenceFocus(option.key)}><b>{option.title}</b><small>{option.description}</small></button>)}</div><small>최소 하나를 유지합니다. 스토리의 행동·감정·사건이 충돌할 때는 스토리 지시가 우선합니다.</small></fieldset>
      </section>}
      <section className="photo-control-panel"><div className="photo-section-head"><span>{mode === "animation_2d_to_photo" ? "03" : "02"}</span><div><p>VISUAL CONDITIONS</p><h2>장면의 안전한 기본값을 정하세요.</h2></div></div><div className="condition-grid">{CONDITION_GROUPS.map((group) => <fieldset key={group.key}><legend>{group.label}</legend><div>{group.options.map((option) => <button type="button" key={option.value} className={conditions[group.key] === option.value ? "selected" : ""} aria-pressed={conditions[group.key] === option.value} onClick={() => chooseCondition(group.key, option.value)}>{option.label}</button>)}</div></fieldset>)}</div></section>
      <section className="photo-control-panel photo-story-panel"><div className="photo-section-head"><span>{mode === "animation_2d_to_photo" ? "04" : "03"}</span><div><p>STORY DIRECTION</p><h2>무엇이 벌어지는지 먼저 지시하세요.</h2></div></div><p className="story-authority">스토리는 주체의 행동·감정·사건과 의도적인 장면 변화를 결정합니다. 2D 원본은 선택한 시각 요소만 보완합니다.</p><label className="photo-prompt"><span>스토리 지시 <small>주체, 행동, 감정, 사건 또는 바꾸고 싶은 장면을 구체적으로 적어 주세요.</small></span><textarea value={detailPrompt} minLength={20} maxLength={700} onChange={(event) => setDetailPrompt(event.target.value)} aria-describedby="photo-prompt-count" /><div><small id="photo-prompt-count">{detailPrompt.length}/700</small><button type="button" onClick={() => setDetailPrompt(defaultPrompt)}>조건으로 기본 지시 다시 만들기</button></div></label><div className="photo-render-plan"><span>RENDER CONTRACT</span><b>안전 제약 → 스토리 지시 → {mode === "animation_2d_to_photo" ? `참조 고정점 (${referenceFocusCopy(referenceFocus)})` : "장면 조건"} → 실사 표현</b><p>{mode === "animation_2d_to_photo" ? "첨부 이미지는 선택한 비식별 시각 요소의 연속성에만 쓰이며, 원본을 그대로 복제하지 않습니다." : "첨부 이미지 없이 스토리와 장면 조건만으로 새 실사 이미지를 만듭니다."}</p></div></section>
      <section className="photo-control-panel photo-plan-panel"><div className="photo-section-head"><span>{mode === "animation_2d_to_photo" ? "05" : "04"}</span><div><p>OUTPUT PLAN</p><h2>결과 형식을 정하고 생성하세요.</h2></div></div><div className="photo-output"><span>결과 형식</span><div className="output-grid" role="radiogroup" aria-label="이미지 결과 형식"><button type="button" role="radio" aria-checked={outputKind === "still"} className={outputKind === "still" ? "selected" : ""} onClick={() => setOutputKind("still")}><b>실사 PNG 한 장</b><small>생성된 원본 9:16 이미지를 반환합니다.</small></button><button type="button" role="radio" aria-checked={outputKind === "motion_gif"} className={outputKind === "motion_gif" ? "selected" : ""} onClick={() => setOutputKind("motion_gif")}><b>모션 GIF</b><small>한 장의 실사 PNG를 미세 pan/zoom 프레임으로 조립합니다.</small></button></div>{outputKind === "motion_gif" && <label className="gif-frame-control"><span>GIF 프레임 수 <b>{frameCount}프레임</b></span><input aria-label="GIF 프레임 수" type="range" min={2} max={30} value={frameCount} onChange={(event) => setFrameCount(Number(event.target.value))} /><small>10fps · 약 {(frameCount / 10).toFixed(1)}초 · 최대 30프레임 · 추가 AI 생성 호출 없음 · AI 비디오가 아닙니다.</small></label>}</div><div className="photo-confirm"><label><input type="checkbox" checked={rightsAccepted} aria-describedby={mode === "animation_2d_to_photo" ? "photo-reference-egress" : undefined} onChange={(event) => setRightsAccepted(event.target.checked)} /><span>업로드하는 2D 이미지는 내가 권리를 보유한 원본이며, 실존 인물·유명인·미성년자·원작 캐릭터·로고·워터마크를 포함하지 않습니다. 생성 결과는 내 로컬 API 세션에만 남는 실험 결과임을 이해합니다.</span></label><button className="button button-primary" type="submit" disabled={isSubmitting || isActive}>{isSubmitting ? "작업 준비 중" : outputKind === "motion_gif" ? "모션 GIF 생성" : mode === "text_to_photo" ? "실사 이미지 생성" : "2D 원본 실사화"}<span>→</span></button></div></section>
      {error && <p className="photo-error" role="alert">{error}</p>}
    </form>
    {project && <section className={`photo-job ${isActive ? "is-active" : ""} ${finalizing ? "is-finalizing" : ""}`} aria-live="polite">
      <div className="photo-job-head">
        <div><p>LOCAL JOB / {project.id.toUpperCase()}</p><h2>{finalizing ? "완료 대기 중" : phaseCopy(project)}</h2><span>{finalizing ? "90%에서 생성 결과를 기다립니다. 실제 파일 검증과 완료 이벤트가 확인될 때만 100%로 완료됩니다." : project.job.etaSource === "bucket_bootstrap" ? "provider 시작 시 5%부터 표시하고, 완료 예상 시간을 100등분해 1%씩 90%까지 증가시킵니다." : project.job.etaSource === "bucket_median" ? "provider 시작 시 5%부터 표시하고, 완료 표본의 예상 시간을 100등분해 1%씩 90%까지 증가시킵니다." : "완료 상태는 서버가 검증한 실제 결과를 기준으로 표시합니다."}</span></div>
        {isActive && <div className="photo-live-indicator" aria-hidden="true"><i /><span>서버 상태 확인 중</span></div>}
        <b>{project.status === "completed" ? "DONE" : project.status === "failed" ? "FAILED" : "LIVE"}</b>
      </div>
      {showProgress && <>
        <div className="photo-phase-track" role="progressbar" aria-label={finalizing ? "서버 완료 대기 진행률" : project.job.etaSource === "bucket_bootstrap" ? "서버 초기 완료 예상 진행률" : project.job.etaSource === "bucket_median" ? "서버 완료 표본 기반 예상 진행률" : "관측된 서버 생명주기 진행률"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={displayProgress} aria-valuetext={progressAriaText(project)}><span style={{ width: `${displayProgress}%` }} /></div>
        <div className="photo-progress-copy"><b>{displayProgress}%</b><span>{progressBasisCopy(project)}</span></div>
        {finalizing && <div className="photo-finalization" role="status"><i aria-hidden="true" /><div><span>COMPLETION WAIT / 90%</span><b>완료 대기 중</b><p>{finalizationCopy(project)}</p><small>실제 결과 파일이 검증될 때까지 90%를 유지하며, 검증된 완료 이벤트에서만 100%가 됩니다.</small></div></div>}
        <div className="photo-timing"><div><span>경과 시간</span><b>{displayElapsed}초</b></div><div><span>{finalizing ? "완료 처리" : "예상 잔여 시간"}</span><b>{finalizing ? finalizationCopy(project) : secondsCopy(project.job.estimatedRemainingSeconds, project.job.etaState)}</b></div><div><span>현재 단계</span><b>{phaseCopy(project)}</b></div><div><span>예상 기준</span><b>{etaSourceCopy(project)}</b></div>{project.output.kind === "motion_gif" && <div><span>GIF 프레임</span><b>{project.job.encodedFrameCount}/{project.job.requestedFrameCount}</b></div>}</div>
      </>}
      {project.delivery && <figure className="photo-result"><img src={project.delivery.asset.dataUri} width={project.delivery.asset.width} height={project.delivery.asset.height} alt={project.delivery.asset.kind === "user_motion_gif" ? "생성된 비식별 실사 모션 GIF" : "생성된 비식별 실사 이미지"} /><figcaption><b>{project.delivery.asset.kind === "user_motion_gif" ? "MOTION GIF / 9:16" : "PHOTOREALISTIC STILL / 9:16"}</b><span>{project.delivery.asset.width} × {project.delivery.asset.height} · {project.delivery.asset.frameCount}프레임 · {project.delivery.asset.fps ? `${project.delivery.asset.fps}fps · ${project.delivery.asset.durationSeconds?.toFixed(1)}초` : "실사 PNG 한 장"}</span>{project.delivery.asset.kind === "user_motion_gif" && <small>한 장의 생성된 실사 이미지를 기반으로 한 결정적 pan/zoom GIF이며, AI 비디오·프레임별 재생성이 아닙니다.</small>}</figcaption></figure>}
      {project.delivery?.asset.cleanupWarning && <p className="photo-cleanup-warning" role="status">임시 작업 공간 정리 경고: <b>{project.delivery.asset.cleanupWarning.code}</b>. 업로드한 2D 원본의 임시 사본이 로컬 작업 공간에 남았을 수 있습니다. 로컬 운영자에게 정리를 요청하세요.</p>}
      {project.error && <div className="photo-error" role="alert"><b>{project.error.code}</b>{project.error.providerDiagnostics?.diagnosticCode && <small>진단 코드: <b>{project.error.providerDiagnostics.diagnosticCode}</b></small>}<span>{providerErrorCopy(project)}</span></div>}
      <button type="button" className="button button-quiet" onClick={() => { setProject(null); setError(""); }}>새 작업 만들기</button>
    </section>}
  </div>;
}
