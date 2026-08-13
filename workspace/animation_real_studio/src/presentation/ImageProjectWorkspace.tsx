import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ImageBatch, ImageBatchRepository } from "../business/image-batch";
import { createDefaultImageProjectDraft, createPersonalImageProject, projectMatchesSelection, resolveSelectedImage, selectedImageMatches, validateImageProjectDraft, type ImageProjectPurpose, type PersonalImageProject, type PersonalImageProjectDraft, type PersonalImageProjectRepository } from "../business/image-project";

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
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [loadRevision, setLoadRevision] = useState(0);

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
        setEditing(!usableProject);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setLoadError(loadError instanceof Error ? loadError.message : "프로젝트 데이터를 불러오지 못했습니다.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [batchId, batchRepository, projectRepository, loadRevision]);

  const selected = useMemo(() => batch ? resolveSelectedImage(batch) : null, [batch]);
  const validationErrors = draft ? validateImageProjectDraft(draft) : [];

  async function saveProject(event: FormEvent) {
    event.preventDefault();
    if (!batch || !draft || validationErrors.length || saving) return;
    setSaving(true);
    setFormError("");
    try {
      const latestBatch = await batchRepository.get(batchId);
      if (!selectedImageMatches(batch, latestBatch)) {
        setBatch(latestBatch);
        setProject(null);
        setFormError("이미지 선택이 변경되었습니다. 최신 기준 이미지를 확인한 뒤 다시 프로젝트를 만들어 주세요.");
        return;
      }
      const nextProject = createPersonalImageProject(latestBatch, draft, project ? new Date(project.createdAt) : new Date());
      const saved = await projectRepository.save({ ...nextProject, createdAt: project?.createdAt ?? nextProject.createdAt, updatedAt: new Date().toISOString() });
      setBatch(latestBatch);
      setProject(saved);
      setEditing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "프로젝트를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="image-project-page image-project-loading" aria-live="polite"><p className="eyebrow">OPENING IMAGE PROJECT</p><h1>선택한 이미지를<br /><i>프로젝트로 준비 중입니다.</i></h1></section>;
  if (loadError || !batch || !selected?.ok || !draft) return <ErrorState message={loadError || "선택한 프로젝트 데이터를 확인할 수 없습니다."} navigate={navigate} retry={() => setLoadRevision((value) => value + 1)} />;

  const asset = selected.variant.delivery.asset;
  const purpose = purposeOptions.find((option) => option.value === draft.purpose) ?? purposeOptions[0];
  const steps = draft.purpose === "campaign_visual"
    ? ["핵심 카피 한 줄 확정", "가로·세로 파생 레이아웃", "채널별 배포 규격 점검"]
    : draft.purpose === "portfolio_piece"
      ? ["작품 소개문 다듬기", "같은 세계관의 연작 2점", "포트폴리오 순서와 캡션"]
      : ["3초 훅과 첫 프레임", "3개 숏의 장면 순서", "9:16 모션·자막 테스트"];

  return <section className="image-project-page">
    <header className="image-project-hero">
      <div><p className="eyebrow">MY IMAGE PROJECT / PRIVATE SESSION</p><h1>{project && !editing ? project.title : "선택 이미지를\n나만의 프로젝트로"}</h1><p>후보 선택은 끝났습니다. 이제 이 이미지가 어디에, 어떤 의도로 쓰일지 확정해 실제 제작 작업대로 이어갑니다.</p></div>
      <div className="image-project-source"><img src={asset.dataUri} alt="프로젝트 기준으로 선택한 이미지" /><span>SELECTED · REVISION {selected.revision}</span></div>
    </header>

    {editing ? <form className="image-project-setup" onSubmit={saveProject}>
      <div className="photo-section-head"><span>05</span><div><p>PROJECT SETUP</p><h2>프로젝트의 이름과 쓰임을 구체화하세요.</h2></div></div>
      <label>프로젝트 이름<input aria-label="프로젝트 이름" maxLength={60} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /><small>{draft.title.length}/60</small></label>
      <fieldset><legend>사용 목적</legend><div className="image-project-purpose-grid">{purposeOptions.map((option) => <button key={option.value} type="button" className={draft.purpose === option.value ? "selected" : ""} aria-pressed={draft.purpose === option.value} onClick={() => setDraft({ ...draft, purpose: option.value })}><b>{option.label}</b><small>{option.description}</small></button>)}</div></fieldset>
      <label>이 프로젝트에서 만들고 싶은 것<textarea aria-label="창작 의도" minLength={10} maxLength={280} value={draft.creativeIntent} onChange={(event) => setDraft({ ...draft, creativeIntent: event.target.value })} /><small>{draft.creativeIntent.length}/280</small></label>
      {formError && <p className="image-batch-error" role="alert">{formError}</p>}
      {validationErrors.length > 0 && <p className="image-project-validation">{validationErrors[0]}</p>}
      <div className="image-project-actions"><button className="button button-quiet" type="button" onClick={() => navigate("/real")}>이미지 다시 선택</button><button className="button button-primary" disabled={validationErrors.length > 0 || saving} type="submit">{saving ? "프로젝트 저장 중" : "나만의 프로젝트 만들기"}</button></div>
    </form> : project && <div className="image-project-workbench">
      <section className="image-project-summary"><div><p className="eyebrow">PROJECT INTENT</p><h2>{purpose.label}</h2><p>{project.creativeIntent}</p></div><button type="button" onClick={() => setEditing(true)}>기획 수정</button></section>
      <div className="image-project-columns">
        <section className="image-project-details"><h2>기준 이미지와 전체 생성 설정</h2><dl>
          <div><dt>장면 설명</dt><dd><SettingValue name="story" label="스토리" value={batch.brief.story} /></dd></div>
          <div><dt>주체</dt><dd className="image-project-setting-list"><SettingValue name="subjectKind" label="종류" value={batch.brief.subjectKind} /><SettingValue name="subjectDetail" label="세부 주체" value={batch.brief.subjectDetail} /><SettingValue name="age" label="나이" value={batch.brief.age} /><SettingValue name="presentation" label="성별 표현" value={batch.brief.presentation} /><SettingValue name="peopleCount" label="인원" value={batch.brief.peopleCount} /></dd></div>
          <div><dt>캐스팅·의상</dt><dd className="image-project-setting-list"><SettingValue name="ethnicity" label="인종·민족 표현" value={batch.brief.ethnicity} /><SettingValue name="country" label="국가·문화권" value={batch.brief.country} /><SettingValue name="profession" label="직업·유형" value={batch.brief.profession} /><SettingValue name="wardrobe" label="의상" value={batch.brief.wardrobe} /></dd></div>
          <div><dt>장면 환경</dt><dd className="image-project-setting-list"><SettingValue name="era" label="시대" value={batch.brief.era} /><SettingValue name="environment" label="공간" value={batch.brief.environment} /><SettingValue name="weather" label="날씨" value={batch.brief.weather} /><SettingValue name="mood" label="분위기" value={batch.brief.mood} /></dd></div>
          <div><dt>촬영·조명</dt><dd className="image-project-setting-list"><SettingValue name="cameraAngle" label="카메라 각도" value={batch.brief.cameraAngle} /><SettingValue name="framing" label="프레이밍" value={batch.brief.framing} /><SettingValue name="perspective" label="시점" value={batch.brief.perspective} /><SettingValue name="lighting" label="조명" value={batch.brief.lighting} /></dd></div>
          <div><dt>출력</dt><dd className="image-project-setting-list"><SettingValue name="outputKind" label="형식" value={batch.outputPlan?.kind} /><SettingValue name="frameCount" label="프레임 수" value={batch.outputPlan?.frameCount} /></dd></div>
        </dl></section>
        <aside className="image-project-next"><p className="eyebrow">NEXT PRODUCTION STEPS</p><h2>다음 제작 절차</h2><ol>{steps.map((step, index) => <li key={step}><span>0{index + 1}</span><b>{step}</b></li>)}</ol><small>이 프로젝트는 현재 로컬 API와 브라우저 세션에만 유지됩니다.</small></aside>
      </div>
      <footer className="image-project-meta"><span>PROJECT {project.batchId}</span><span>VARIANT {project.variantId}</span><span>SELECTION R{project.selectionRevision}</span></footer>
    </div>}
  </section>;
}
