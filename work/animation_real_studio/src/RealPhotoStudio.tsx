import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPhotorealisticProject, fetchPhotorealisticProject, type PhotoConditions, type PhotoMode, type PhotoOutputKind, type PhotorealisticProject } from "./studio-api";

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

const PHASE_COPY: Record<PhotorealisticProject["job"]["phase"], string> = { validated: "요청과 조건을 검증했습니다", workspace_prepared: "안전한 임시 작업공간을 준비했습니다", provider_started: "이미지 생성기에 실제 요청을 전달했습니다", output_validated: "반환 이미지를 검증하고 있습니다", gif_encoding: "모션 GIF를 조립하고 있습니다", completed: "이미지 생성이 완료되었습니다", failed: "생성 작업이 실패했습니다" };

function makeDefaultPrompt(conditions: PhotoConditions) {
  const group = (key: ConditionKey, value: string) => CONDITION_GROUPS.find((item) => item.key === key)?.options.find((option) => option.value === value)?.label ?? "";
  if (conditions.subject === "no_person") return `${group("setting", conditions.setting)}에서 ${group("era", conditions.era)}의 공기를 담은, ${group("framing", conditions.framing)} ${group("cameraAngle", conditions.cameraAngle)} 실사 시네마틱 장면. 인물은 없이 빛과 질감, 자연스러운 공간감을 강조해 주세요.`;
  return `${group("setting", conditions.setting)}에서 ${group("age", conditions.age)} ${group("presentation", conditions.presentation)} 가상 성인이 ${group("clothing", conditions.clothing)} 차림으로 서 있는, ${group("framing", conditions.framing)} ${group("cameraAngle", conditions.cameraAngle)} 실사 시네마틱 장면. 자연스러운 빛과 물리적으로 설득력 있는 질감을 강조해 주세요.`;
}
function secondsCopy(seconds: number | null, etaState: PhotorealisticProject["job"]["etaState"]) {
  if (seconds === null && etaState === "awaiting_observed_samples") return "\uB3D9\uC77C \uC720\uD615 \uC644\uB8CC \uD45C\uBCF8 3\uAC1C\uB97C \uBAA8\uC73C\uB294 \uC911";
  if (seconds === null) return "예상 시간을 넘겼습니다 — 계속 생성 중";
  if (seconds === 0) return "\uc644\ub8cc";
  if (seconds < 60) return `약 ${Math.max(1, seconds)}초 남음`;
  return `약 ${Math.ceil(seconds / 60)}분 남음`;
}
function phaseCopy(project: PhotorealisticProject) {
  if (project.job.phase === "gif_encoding") return `모션 GIF 프레임 ${project.job.encodedFrameCount}/${project.job.requestedFrameCount}을 조립하고 있습니다`;
  return PHASE_COPY[project.job.phase];
}
function observedProgress(project: PhotorealisticProject) {
  if (project.status === "completed") return 100;
  return project.job.progress ?? 0;
}
function progressBasisCopy(project: PhotorealisticProject) {
  if (project.job.progressBasis === "server_lifecycle_and_duration_forecast") {
    return "\uC11C\uBC84 \uC0DD\uBA85\uC8FC\uAE30\uC640 \uB3D9\uC77C \uC720\uD615\uC758 \uC2E4\uC81C \uC644\uB8CC \uC2DC\uAC04 \uD45C\uBCF8\uC73C\uB85C \uACC4\uC0B0\uD55C \uC644\uB8CC \uC608\uC0C1\uCE58\uC785\uB2C8\uB2E4. \uC2DC\uAC04 \uAE30\uBC18 \uC608\uC0C1\uC740 90%\uAE4C\uC9C0\uB9CC \uD45C\uC2DC\uD558\uACE0, 91~100%\uB294 \uC2E4\uC81C \uCD9C\uB825\u00B7\uC644\uB8CC \uAC80\uC99D\uC5D0\uC11C\uB9CC \uD45C\uC2DC\uD569\uB2C8\uB2E4.";
  }
  return "\uBAA8\uB378 \uB80C\uB354 \uBE44\uC728\uC774 \uC544\uB2CC \uC11C\uBC84 \uD655\uC778 \uB2E8\uACC4\uC785\uB2C8\uB2E4.";
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
    }
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
      const created = await createPhotorealisticProject({ mode, outputKind, frameCount: outputKind === "motion_gif" ? frameCount : 1, detailPrompt, conditions, rightsAccepted, clientRequestId, ...(mode === "animation_2d_to_photo" && referenceImage ? { referenceImage } : {}) });
      setProject(created);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "실사 이미지 작업을 시작할 수 없습니다."); }
    finally { setIsSubmitting(false); }
  }
  const displayElapsed = project?.job.elapsedSeconds ?? 0;
  const displayProgress = project ? observedProgress(project) : 0;

  return <div className="real-photo-page">
    <section className="real-photo-intro"><p className="eyebrow">TRUSTED LOCAL EXPERIMENT / PHOTO STILL</p><h1>텍스트와 2D 원본을<br /><i>실사 이미지</i>로 만듭니다.</h1><p>실제 Codex 이미지 생성 기능을 사용하는 로컬 실험입니다. 실사 PNG 또는 그 한 장을 기반으로 한 2~30프레임 모션 GIF를 만들며, 모델 렌더 퍼센트 대신 실제 서버 단계와 완료 시간 추정치를 표시합니다.</p></section>
    <form className="photo-studio" onSubmit={submit}>
      <section className="photo-control-panel">
        <div className="photo-section-head"><span>01</span><div><p>INPUT MODE</p><h2>시작 방식을 고르세요.</h2></div></div>
        <div className="mode-grid" role="radiogroup" aria-label="실사 이미지 생성 방식">
          <button type="button" className={mode === "text_to_photo" ? "selected" : ""} role="radio" aria-checked={mode === "text_to_photo"} onClick={() => chooseMode("text_to_photo")}><b>텍스트 → 실사</b><small>설정 조건과 프롬프트로 새 이미지를 생성합니다.</small></button>
          <button type="button" className={mode === "animation_2d_to_photo" ? "selected" : ""} role="radio" aria-checked={mode === "animation_2d_to_photo"} onClick={() => chooseMode("animation_2d_to_photo")}><b>2D 애니메이션 → 실사</b><small>권리를 보유한 2D 원본을 비식별 실사 장면으로 재해석합니다.</small></button>
        </div>
        {mode === "animation_2d_to_photo" && <label className="photo-reference"><span>2D 원본 한 장</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseReference} /><small>PNG · JPEG · WebP / 6 MB 이하 / 사람 사진·유명인·원작 캐릭터는 사용할 수 없습니다.</small>{referenceLabel && <b>{referenceLabel}</b>}</label>}
        <div className="photo-output"><span>결과 형식</span><div className="output-grid" role="radiogroup" aria-label="이미지 결과 형식"><button type="button" role="radio" aria-checked={outputKind === "still"} className={outputKind === "still" ? "selected" : ""} onClick={() => setOutputKind("still")}><b>실사 PNG 한 장</b><small>생성된 원본 9:16 이미지를 반환합니다.</small></button><button type="button" role="radio" aria-checked={outputKind === "motion_gif"} className={outputKind === "motion_gif" ? "selected" : ""} onClick={() => setOutputKind("motion_gif")}><b>모션 GIF</b><small>한 장의 실사 PNG를 미세 pan/zoom 프레임으로 조립합니다.</small></button></div>{outputKind === "motion_gif" && <label className="gif-frame-control"><span>GIF 프레임 수 <b>{frameCount}프레임</b></span><input aria-label="GIF 프레임 수" type="range" min={2} max={30} value={frameCount} onChange={(event) => setFrameCount(Number(event.target.value))} /><small>10fps · 약 {(frameCount / 10).toFixed(1)}초 · 최대 30프레임 · 추가 AI 생성 호출 없음 · AI 비디오가 아닙니다.</small></label>}</div>
        {mode === "animation_2d_to_photo" && <p id="photo-reference-egress" className="photo-reference-disclosure">확인 체크 시, 선택한 2D 원본은 이번 생성 요청의 이미지 첨부로 Codex에 전달됩니다. 텍스트 → 실사 모드에는 이미지 첨부가 없습니다.</p>}
      </section>
      <section className="photo-control-panel"><div className="photo-section-head"><span>02</span><div><p>VISUAL CONDITIONS</p><h2>장면 조건을 구체화하세요.</h2></div></div><div className="condition-grid">{CONDITION_GROUPS.map((group) => <fieldset key={group.key}><legend>{group.label}</legend><div>{group.options.map((option) => <button type="button" key={option.value} className={conditions[group.key] === option.value ? "selected" : ""} aria-pressed={conditions[group.key] === option.value} onClick={() => chooseCondition(group.key, option.value)}>{option.label}</button>)}</div></fieldset>)}</div></section>
      <section className="photo-control-panel"><div className="photo-section-head"><span>03</span><div><p>PROMPT</p><h2>원하는 장면을 말해 주세요.</h2></div></div><label className="photo-prompt"><span>구체적인 내용 <small>기본 문구를 그대로 쓰거나 자유롭게 수정할 수 있습니다.</small></span><textarea value={detailPrompt} minLength={20} maxLength={700} onChange={(event) => setDetailPrompt(event.target.value)} aria-describedby="photo-prompt-count" /><div><small id="photo-prompt-count">{detailPrompt.length}/700</small><button type="button" onClick={() => setDetailPrompt(defaultPrompt)}>선택 조건으로 기본 문구 다시 만들기</button></div></label><div className="composed-prompt"><span>SERVER-COMPOSED BRIEF</span><p>{`선택 조건 + 입력 문구 + 오리지널·비식별·실사 제약을 서버에서 결합합니다.`}</p></div></section>
      <section className="photo-control-panel photo-confirm"><label><input type="checkbox" checked={rightsAccepted} aria-describedby={mode === "animation_2d_to_photo" ? "photo-reference-egress" : undefined} onChange={(event) => setRightsAccepted(event.target.checked)} /><span>업로드하는 2D 이미지는 내가 권리를 보유한 원본이며, 실존 인물·유명인·미성년자·원작 캐릭터·로고·워터마크를 포함하지 않습니다. 생성 결과는 내 로컬 API 세션에만 남는 실험 결과임을 이해합니다.</span></label><button className="button button-primary" type="submit" disabled={isSubmitting || isActive}>{isSubmitting ? "작업 준비 중" : outputKind === "motion_gif" ? "모션 GIF 생성" : mode === "text_to_photo" ? "실사 이미지 생성" : "2D 원본 실사화"}<span>→</span></button></section>
      {error && <p className="photo-error" role="alert">{error}</p>}
    </form>
    {project && <section className="photo-job" aria-live="polite">
      <div className="photo-job-head"><div><p>LOCAL JOB / {project.id.toUpperCase()}</p><h2>{phaseCopy(project)}</h2><span>{project.job.progressBasis === "server_lifecycle_and_duration_forecast" ? "예상 진행률은 90%까지만 표시합니다. 91~100%는 서버가 검증한 실제 출력·완료 단계이며, 완료 이벤트 전에는 100%가 되지 않습니다." : "동일 유형의 완료 표본 3개 전에는 실제 서버 생명주기 단계만 표시합니다. 표본이 쌓이면 예상 진행률도 90%까지만 표시합니다."}</span></div><b>{project.status === "completed" ? "DONE" : project.status === "failed" ? "FAILED" : "LIVE"}</b></div>
      {showProgress && <><div className="photo-phase-track" role="progressbar" aria-label={project.job.progressBasis === "server_lifecycle_and_duration_forecast" ? "서버 단계 및 완료 시간 표본 기반 예상 진행률" : "관측된 서버 생명주기 진행률"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={displayProgress}><span style={{ width: `${displayProgress}%` }} /></div><div className="photo-progress-copy"><b>{displayProgress}%</b><span>{progressBasisCopy(project)}</span></div><div className="photo-timing"><div><span>경과 시간</span><b>{displayElapsed}초</b></div><div><span>예상 잔여 시간</span><b>{secondsCopy(project.job.estimatedRemainingSeconds, project.job.etaState)}</b></div><div><span>현재 단계</span><b>{phaseCopy(project)}</b></div>{project.output.kind === "motion_gif" && <div><span>GIF 프레임</span><b>{project.job.encodedFrameCount}/{project.job.requestedFrameCount}</b></div>}</div></>}
      {project.delivery && <figure className="photo-result"><img src={project.delivery.asset.dataUri} width={project.delivery.asset.width} height={project.delivery.asset.height} alt={project.delivery.asset.kind === "user_motion_gif" ? "생성된 비식별 실사 모션 GIF" : "생성된 비식별 실사 이미지"} /><figcaption><b>{project.delivery.asset.kind === "user_motion_gif" ? "MOTION GIF / 9:16" : "PHOTOREALISTIC STILL / 9:16"}</b><span>{project.delivery.asset.width} × {project.delivery.asset.height} · {project.delivery.asset.frameCount}프레임 · {project.delivery.asset.fps ? `${project.delivery.asset.fps}fps · ${project.delivery.asset.durationSeconds?.toFixed(1)}초` : "실사 PNG 한 장"}</span>{project.delivery.asset.kind === "user_motion_gif" && <small>한 장의 생성된 실사 이미지를 기반으로 한 결정적 pan/zoom GIF이며, AI 비디오·프레임별 재생성이 아닙니다.</small>}</figcaption></figure>}
      {project.delivery?.asset.cleanupWarning && <p className="photo-cleanup-warning" role="status">임시 작업 공간 정리 경고: <b>{project.delivery.asset.cleanupWarning.code}</b>. 업로드한 2D 원본의 임시 사본이 로컬 작업 공간에 남았을 수 있습니다. 로컬 운영자에게 정리를 요청하세요.</p>}
      {project.error && <div className="photo-error" role="alert"><b>{project.error.code}</b>{project.error.providerDiagnostics?.diagnosticCode && <small>진단 코드: <b>{project.error.providerDiagnostics.diagnosticCode}</b></small>}<span>{project.error.message}</span></div>}
      <button type="button" className="button button-quiet" onClick={() => { setProject(null); setError(""); }}>새 작업 만들기</button>
    </section>}
  </div>;
}