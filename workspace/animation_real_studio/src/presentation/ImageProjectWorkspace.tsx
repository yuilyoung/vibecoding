import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ImageBatch, ImageBatchRepository } from "../business/image-batch";
import {
  changeImageProjectPurpose,
  createDefaultImageProjectDraft,
  createImageProjectWorkDraft,
  createPersonalImageProject,
  deriveImageProjectProgress,
  projectMatchesSelection,
  resolveSelectedImage,
  selectedImageMatches,
  updateImageProjectNote,
  updateImageProjectWorkItem,
  updatePersonalImageProjectDetails,
  updatePersonalImageProjectWork,
  validateImageProjectDraft,
  validateImageProjectWorkDraft,
  IMAGE_PROJECT_NOTE_MAX_LENGTH,
  IMAGE_PROJECT_WORK_NOTE_MAX_LENGTH,
  type ImageProjectPurpose,
  type ImageProjectWorkDraft,
  type ImageProjectWorkStatus,
  type PersonalImageProject,
  type PersonalImageProjectDraft,
  type PersonalImageProjectRepository,
} from "../business/image-project";

type Props = {
  batchId: string;
  batchRepository: ImageBatchRepository;
  projectRepository: PersonalImageProjectRepository;
  navigate: (route: string) => void;
};

const purposeOptions: ReadonlyArray<{ value: ImageProjectPurpose; label: string; description: string }> = [
  { value: "social_short", label: "SNS 숏폼", description: "선택 이미지를 9:16 영상의 대표 프레임으로 발전시킵니다." },
  { value: "campaign_visual", label: "캠페인 비주얼", description: "키 비주얼과 카피, 채널별 파생 규격을 설계합니다." },
  { value: "portfolio_piece", label: "개인 포트폴리오", description: "작품 설명과 연작 방향을 갖춘 대표 작업으로 정리합니다." },
];

const statusOptions: ReadonlyArray<{ value: ImageProjectWorkStatus; label: string }> = [
  { value: "todo", label: "할 일" },
  { value: "in_progress", label: "진행 중" },
  { value: "done", label: "완료" },
];

const valueLabels: Record<string, string> = {
  human: "사람", animal: "동물", bird: "새", east_asian: "동아시아", south_korea: "대한민국",
  kpop_idol: "K-Pop 아이돌", fashion_model: "패션 모델", announcer: "아나운서", office_worker: "오피스 워커",
  city: "도시", interior: "실내", coast: "해안", forest: "숲", studio: "스튜디오",
  rain: "비", snow: "눈", clear: "맑음", fog: "안개", storm: "폭풍",
  portrait: "얼굴 중심", upper_body: "상반신", full_body: "전신", hands_detail: "손 디테일",
  still: "정지 이미지 PNG", motion_gif: "모션 GIF",
};

function display(value: string | undefined) {
  if (!value) return "-";
  return valueLabels[value] ?? value.replaceAll("_", " ");
}

function SettingValue({ name, label, value }: { name: string; label: string; value: string | number | undefined }) {
  return <span className="image-project-setting" data-setting={name}><b>{label}</b>{typeof value === "number" ? value : display(value)}</span>;
}

function ErrorState({ message, navigate, retry }: { message: string; navigate: (route: string) => void; retry: () => void }) {
  return <section className="image-project-page image-project-error" role="alert">
    <p className="eyebrow">PROJECT SOURCE UNAVAILABLE</p>
    <h1>프로젝트 기준 이미지를<br /><i>확인할 수 없습니다.</i></h1>
    <p>{message}</p>
    <div className="image-project-actions">
      <button className="button button-primary" type="button" onClick={retry}>다시 확인</button>
      <button className="button button-quiet" type="button" onClick={() => navigate("/real")}>새 이미지 생성</button>
    </div>
  </section>;
}

export function ImageProjectWorkspace({ batchId, batchRepository, projectRepository, navigate }: Props) {
  const [batch, setBatch] = useState<ImageBatch | null>(null);
  const [project, setProject] = useState<PersonalImageProject | null>(null);
  const [draft, setDraft] = useState<PersonalImageProjectDraft | null>(null);
  const [workDraft, setWorkDraft] = useState<ImageProjectWorkDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workSaving, setWorkSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [workError, setWorkError] = useState("");
  const [workNotice, setWorkNotice] = useState("");
  const [purposeResetConfirmed, setPurposeResetConfirmed] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const saveControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    saveControllerRef.current?.abort();
    saveControllerRef.current = null;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    void Promise.all([batchRepository.get(batchId, controller.signal), projectRepository.get(batchId)])
      .then(([nextBatch, savedProject]) => {
        if (controller.signal.aborted) return;
        const selected = resolveSelectedImage(nextBatch);
        if (!selected.ok) {
          const message = selected.reason === "selection_missing" ? "먼저 생성 결과 화면에서 완료된 후보 하나를 선택해 주세요." : selected.reason === "variant_unavailable" ? "현재 선택한 후보가 완료 상태가 아닙니다. 생성 결과에서 다른 후보를 확인해 주세요." : "선택한 후보의 이미지 파일을 확인할 수 없습니다.";
          setLoadError(message);
          setBatch(nextBatch);
          return;
        }
        const usableProject = savedProject && projectMatchesSelection(savedProject, nextBatch) ? savedProject : null;
        setBatch(nextBatch);
        setProject(usableProject);
        setDraft(usableProject ? { title: usableProject.title, purpose: usableProject.purpose, creativeIntent: usableProject.creativeIntent } : createDefaultImageProjectDraft(nextBatch));
        setWorkDraft(usableProject ? createImageProjectWorkDraft(usableProject) : null);
        setEditing(!usableProject);
        setPurposeResetConfirmed(false);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setLoadError(loadError instanceof Error ? loadError.message : "프로젝트 데이터를 불러오지 못했습니다.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [batchId, batchRepository, projectRepository, loadRevision]);

  const selected = useMemo(() => batch ? resolveSelectedImage(batch) : null, [batch]);
  const validationErrors = draft ? validateImageProjectDraft(draft) : [];
  const purposeChanged = Boolean(project && draft && project.purpose !== draft.purpose);
  const workValidationErrors = project && workDraft ? validateImageProjectWorkDraft(project.purpose, workDraft) : [];
  const progress = workDraft ? deriveImageProjectProgress(workDraft.workItems) : null;

  async function saveProject(event: FormEvent) {
    event.preventDefault();
    if (!batch || !draft || validationErrors.length || saving || (purposeChanged && !purposeResetConfirmed)) return;
    const controller = new AbortController();
    saveControllerRef.current?.abort();
    saveControllerRef.current = controller;
    setSaving(true);
    setFormError("");
    try {
      const latestBatch = await batchRepository.get(batchId, controller.signal);
      if (controller.signal.aborted) return;
      if (!selectedImageMatches(batch, latestBatch)) {
        setBatch(latestBatch);
        setProject(null);
        setWorkDraft(null);
        setFormError("이미지 선택이 변경되었습니다. 최신 기준 이미지를 확인한 뒤 다시 프로젝트를 만들어 주세요.");
        return;
      }
      const nextProject = project
        ? updatePersonalImageProjectDetails(project, latestBatch, draft, purposeResetConfirmed)
        : createPersonalImageProject(latestBatch, draft);
      const saved = await projectRepository.save(nextProject, controller.signal);
      if (controller.signal.aborted) return;
      setBatch(latestBatch);
      setProject(saved);
      setDraft({ title: saved.title, purpose: saved.purpose, creativeIntent: saved.creativeIntent });
      setWorkDraft(createImageProjectWorkDraft(saved));
      setEditing(false);
      setPurposeResetConfirmed(false);
      setWorkNotice(project ? "프로젝트 기획과 작업 계획을 저장했습니다." : "프로젝트를 만들고 작업 보드를 준비했습니다.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (saveError) {
      if (!controller.signal.aborted) setFormError(saveError instanceof Error ? saveError.message : "프로젝트를 저장하지 못했습니다.");
    } finally {
      if (saveControllerRef.current === controller) saveControllerRef.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  async function saveWorkPlan(event: FormEvent) {
    event.preventDefault();
    if (!batch || !project || !workDraft || workSaving || workValidationErrors.length) return;
    const controller = new AbortController();
    saveControllerRef.current?.abort();
    saveControllerRef.current = controller;
    setWorkSaving(true);
    setWorkError("");
    setWorkNotice("");
    try {
      const latestBatch = await batchRepository.get(batchId, controller.signal);
      if (controller.signal.aborted) return;
      if (!selectedImageMatches(batch, latestBatch)) {
        setBatch(latestBatch);
        setDraft({ title: project.title, purpose: project.purpose, creativeIntent: project.creativeIntent });
        setProject(null);
        setWorkDraft(null);
        setEditing(true);
        setFormError("이미지 선택이 변경되었습니다. 최신 기준 이미지를 확인한 뒤 프로젝트를 다시 확정해 주세요.");
        return;
      }
      const saved = await projectRepository.save(updatePersonalImageProjectWork(project, latestBatch, workDraft), controller.signal);
      if (controller.signal.aborted) return;
      setBatch(latestBatch);
      setProject(saved);
      setWorkDraft(createImageProjectWorkDraft(saved));
      setWorkNotice("작업 상태와 메모를 이 브라우저 세션에 저장했습니다.");
    } catch (saveError) {
      if (!controller.signal.aborted) setWorkError(saveError instanceof Error ? saveError.message : "작업 계획을 저장하지 못했습니다.");
    } finally {
      if (saveControllerRef.current === controller) saveControllerRef.current = null;
      if (!controller.signal.aborted) setWorkSaving(false);
    }
  }

  if (loading) return <section className="image-project-page image-project-loading" aria-live="polite"><p className="eyebrow">OPENING IMAGE PROJECT</p><h1>선택한 이미지를<br /><i>프로젝트로 준비 중입니다.</i></h1></section>;
  if (loadError || !batch || !selected?.ok || !draft) return <ErrorState message={loadError || "선택한 프로젝트 데이터를 확인할 수 없습니다."} navigate={navigate} retry={() => setLoadRevision((value) => value + 1)} />;

  const asset = selected.variant.delivery.asset;
  const purpose = purposeOptions.find((option) => option.value === draft.purpose) ?? purposeOptions[0];

  return <section className="image-project-page">
    <header className="image-project-hero">
      <div><p className="eyebrow">MY IMAGE PROJECT / PRIVATE SESSION</p><h1>{project && !editing ? project.title : "선택 이미지를\n나만의 프로젝트로"}</h1><p>후보 선택은 끝났습니다. 이제 이 이미지가 어디에, 어떤 의도로 쓰일지 확정해 실제 제작 작업대로 이어갑니다.</p></div>
      <div className="image-project-source"><img src={asset.dataUri} alt="프로젝트 기준으로 선택한 이미지" /><span>SELECTED · REVISION {selected.revision}</span></div>
    </header>

    {editing ? <form className="image-project-setup" aria-busy={saving} onSubmit={saveProject}>
      <div className="photo-section-head"><span>05</span><div><p>PROJECT SETUP</p><h2>프로젝트의 이름과 쓰임을 구체화하세요.</h2></div></div>
      <label>프로젝트 이름<input aria-label="프로젝트 이름" disabled={saving} maxLength={60} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /><small>{draft.title.length}/60</small></label>
      <fieldset><legend>사용 목적</legend><div className="image-project-purpose-grid">{purposeOptions.map((option) => <button key={option.value} type="button" disabled={saving} className={draft.purpose === option.value ? "selected" : ""} aria-pressed={draft.purpose === option.value} onClick={() => { setDraft(changeImageProjectPurpose(draft, option.value)); setPurposeResetConfirmed(false); }}><b>{option.label}</b><small>{option.description}</small></button>)}</div></fieldset>
      <label>이 프로젝트에서 만들고 싶은 것<textarea aria-label="창작 의도" disabled={saving} minLength={10} maxLength={280} value={draft.creativeIntent} onChange={(event) => setDraft({ ...draft, creativeIntent: event.target.value })} /><small>{draft.creativeIntent.length}/280</small></label>
      {purposeChanged && <label className="image-project-reset-confirm"><input type="checkbox" disabled={saving} checked={purposeResetConfirmed} onChange={(event) => setPurposeResetConfirmed(event.target.checked)} /><span>사용 목적을 바꾸면 기존 작업 상태와 작업 메모가 새 목적의 3개 작업으로 초기화됩니다.</span></label>}
      {formError && <p className="image-batch-error" role="alert">{formError}</p>}
      {validationErrors.length > 0 && <p className="image-project-validation">{validationErrors[0]}</p>}
      <div className="image-project-actions"><button className="button button-quiet" disabled={saving} type="button" onClick={() => navigate("/real")}>이미지 다시 선택</button><button className="button button-primary" disabled={validationErrors.length > 0 || saving || (purposeChanged && !purposeResetConfirmed)} type="submit">{saving ? "프로젝트 저장 중" : project ? "기획과 작업 계획 저장" : "나만의 프로젝트 만들기"}</button></div>
    </form> : project && <div className="image-project-workbench">
      <section className="image-project-summary"><div><p className="eyebrow">PROJECT INTENT</p><h2>{purpose.label}</h2><p>{project.creativeIntent}</p></div><button type="button" disabled={workSaving} onClick={() => setEditing(true)}>기획 수정</button></section>
      {workDraft && progress && <form className="image-project-board" aria-busy={workSaving} onSubmit={saveWorkPlan}>
        <header className="image-project-board-head">
          <div><p className="eyebrow">STEP 03 / ACTIVE WORKBOARD</p><h2>이제 프로젝트를 실제로 진행하세요.</h2><p>각 작업의 상태와 판단 근거를 기록하면 다음 행동과 전체 진행률이 자동으로 갱신됩니다.</p></div>
          <div className="image-project-progress" data-state={progress.state}><strong>{progress.percent}%</strong><span>{progress.completed}/{progress.total} 완료</span><progress aria-label="프로젝트 진행률" max={progress.total} value={progress.completed} /></div>
        </header>
        <div className="image-project-next-action"><span>NEXT ACTION</span><b>{progress.nextAction?.title ?? "모든 작업이 완료되었습니다."}</b></div>
        <div className="image-project-work-grid">
          {workDraft.workItems.map((item, index) => <article className="image-project-work-card" data-status={item.status} key={item.id}>
            <div className="image-project-work-title"><span>0{index + 1}</span><h3>{item.title}</h3></div>
            <div className="image-project-status-controls" role="group" aria-label={`${item.title} 상태`}>
              {statusOptions.map((option) => <button key={option.value} type="button" disabled={workSaving} className={item.status === option.value ? "selected" : ""} aria-pressed={item.status === option.value} onClick={() => setWorkDraft(updateImageProjectWorkItem(workDraft, item.id, { status: option.value }, project.purpose))}>{option.label}</button>)}
            </div>
            <label>작업 메모<textarea aria-label={`${item.title} 작업 메모`} disabled={workSaving} maxLength={IMAGE_PROJECT_WORK_NOTE_MAX_LENGTH} placeholder="결정한 내용, 필요한 자료, 다음 확인 사항을 기록하세요." value={item.note} onChange={(event) => setWorkDraft(updateImageProjectWorkItem(workDraft, item.id, { note: event.target.value }, project.purpose))} /><small>{item.note.length}/{IMAGE_PROJECT_WORK_NOTE_MAX_LENGTH}</small></label>
          </article>)}
        </div>
        <label className="image-project-note">프로젝트 전체 메모<textarea aria-label="프로젝트 전체 메모" disabled={workSaving} maxLength={IMAGE_PROJECT_NOTE_MAX_LENGTH} placeholder="세 작업에 공통으로 적용할 방향이나 보류 사항을 기록하세요." value={workDraft.projectNote} onChange={(event) => setWorkDraft(updateImageProjectNote(workDraft, event.target.value, project.purpose))} /><small>{workDraft.projectNote.length}/{IMAGE_PROJECT_NOTE_MAX_LENGTH}</small></label>
        {workError && <p className="image-batch-error" role="alert">{workError}</p>}
        {workValidationErrors.length > 0 && <p className="image-project-validation">{workValidationErrors[0]}</p>}
        {workNotice && <p className="image-project-save-notice" role="status">{workNotice}</p>}
        <div className="image-project-actions"><button className="button button-primary" disabled={workSaving || workValidationErrors.length > 0} type="submit">{workSaving ? "작업 보드 저장 중" : "작업 보드 저장"}</button></div>
      </form>}
      <div className="image-project-columns">
        <section className="image-project-details"><h2>기준 이미지와 전체 생성 설정</h2><dl>
          <div><dt>장면 설명</dt><dd><SettingValue name="story" label="스토리" value={batch.brief.story} /></dd></div>
          <div><dt>주체</dt><dd className="image-project-setting-list"><SettingValue name="subjectKind" label="종류" value={batch.brief.subjectKind} /><SettingValue name="subjectDetail" label="세부 주체" value={batch.brief.subjectDetail} /><SettingValue name="age" label="나이" value={batch.brief.age} /><SettingValue name="presentation" label="성별 표현" value={batch.brief.presentation} /><SettingValue name="peopleCount" label="인원" value={batch.brief.peopleCount} /></dd></div>
          <div><dt>캐스팅·의상</dt><dd className="image-project-setting-list"><SettingValue name="ethnicity" label="인종·민족 표현" value={batch.brief.ethnicity} /><SettingValue name="country" label="국가·문화권" value={batch.brief.country} /><SettingValue name="profession" label="직업·유형" value={batch.brief.profession} /><SettingValue name="wardrobe" label="의상" value={batch.brief.wardrobe} /></dd></div>
          <div><dt>장면 환경</dt><dd className="image-project-setting-list"><SettingValue name="era" label="시대" value={batch.brief.era} /><SettingValue name="environment" label="공간" value={batch.brief.environment} /><SettingValue name="weather" label="날씨" value={batch.brief.weather} /><SettingValue name="mood" label="분위기" value={batch.brief.mood} /></dd></div>
          <div><dt>촬영·조명</dt><dd className="image-project-setting-list"><SettingValue name="cameraAngle" label="카메라 각도" value={batch.brief.cameraAngle} /><SettingValue name="framing" label="프레이밍" value={batch.brief.framing} /><SettingValue name="perspective" label="시점" value={batch.brief.perspective} /><SettingValue name="lighting" label="조명" value={batch.brief.lighting} /></dd></div>
          <div><dt>출력</dt><dd className="image-project-setting-list"><SettingValue name="outputKind" label="형식" value={batch.outputPlan?.kind} /><SettingValue name="frameCount" label="프레임 수" value={batch.outputPlan?.frameCount} /></dd></div>
        </dl></section>
        <aside className="image-project-next"><p className="eyebrow">TRUSTED-LOCAL BOUNDARY</p><h2>프로젝트 보관 범위</h2><p>작업 상태와 메모는 현재 브라우저 세션에만 저장됩니다. 이미지 바이트, 업로드 원본, 계정 정보는 프로젝트 데이터에 복사하지 않습니다.</p><small>리터치, 다운로드, 공유와 서버 영속화는 승인된 후속 단계입니다.</small></aside>
      </div>
      <footer className="image-project-meta"><span>PROJECT {project.batchId}</span><span>VARIANT {project.variantId}</span><span>SELECTION R{project.selectionRevision}</span></footer>
    </div>}
  </section>;
}
