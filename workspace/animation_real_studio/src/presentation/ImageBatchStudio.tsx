import type { ChangeEvent, FormEvent } from "react";
import { IMAGE_BATCH_STORY_MAX_LENGTH, IMAGE_BATCH_STORY_MIN_LENGTH, type ImageBatchBrief, type ImageBatchRepository, type SubjectDetail } from "../business/image-batch";
import { useImageBatchViewModel } from "./useImageBatchViewModel";

type SelectGroup = { key: keyof ImageBatchBrief; label: string; humanOnly?: boolean; options: ReadonlyArray<{ value: string; label: string }> };
const groups: SelectGroup[] = [
  { key: "age", label: "나이", humanOnly: true, options: [{ value: "adult_20s", label: "20대 성인" }, { value: "adult_30s", label: "30대 성인" }, { value: "adult_40s", label: "40대 성인" }, { value: "adult_50_plus", label: "50대 이상 성인" }] },
  { key: "presentation", label: "성별 표현", humanOnly: true, options: [{ value: "unspecified", label: "지정 안 함" }, { value: "feminine", label: "여성적" }, { value: "masculine", label: "남성적" }, { value: "androgynous", label: "중성적" }] },
  { key: "ethnicity", label: "인종·민족 표현", humanOnly: true, options: [{ value: "unspecified", label: "지정 안 함" }, { value: "east_asian", label: "동아시아" }, { value: "southeast_asian", label: "동남아시아" }, { value: "south_asian", label: "남아시아" }, { value: "black", label: "흑인" }, { value: "white", label: "백인" }, { value: "middle_eastern", label: "중동" }, { value: "latino_hispanic", label: "라티노·히스패닉" }, { value: "multiracial", label: "다인종" }] },
  { key: "country", label: "국가·문화권", humanOnly: true, options: [{ value: "unspecified", label: "지정 안 함" }, { value: "south_korea", label: "대한민국" }, { value: "japan", label: "일본" }, { value: "china", label: "중국" }, { value: "united_states", label: "미국" }, { value: "united_kingdom", label: "영국" }, { value: "france", label: "프랑스" }, { value: "thailand", label: "태국" }, { value: "vietnam", label: "베트남" }, { value: "india", label: "인도" }, { value: "brazil", label: "브라질" }] },
  { key: "peopleCount", label: "사람 수", humanOnly: true, options: [{ value: "one", label: "1명" }, { value: "two", label: "2명" }, { value: "group", label: "3명 이상" }] },
  { key: "era", label: "시대", options: [{ value: "contemporary", label: "현대" }, { value: "nineties", label: "1990년대" }, { value: "historical", label: "20세기 초" }, { value: "future", label: "근미래" }] },
  { key: "weather", label: "날씨", options: [{ value: "clear", label: "맑음" }, { value: "rain", label: "비" }, { value: "snow", label: "눈" }, { value: "fog", label: "안개" }, { value: "storm", label: "폭풍" }] },
  { key: "environment", label: "환경", options: [{ value: "city", label: "도시" }, { value: "interior", label: "실내" }, { value: "coast", label: "해안" }, { value: "forest", label: "숲" }, { value: "studio", label: "스튜디오" }] },
  { key: "cameraAngle", label: "카메라 각도", options: [{ value: "eye_level", label: "눈높이" }, { value: "low_angle", label: "로우 앵글" }, { value: "high_angle", label: "하이 앵글" }, { value: "three_quarter", label: "3/4 앵글" }, { value: "overhead", label: "오버헤드" }, { value: "dutch", label: "더치 앵글" }] },
  { key: "framing", label: "프레이밍", options: [{ value: "portrait", label: "얼굴 중심" }, { value: "upper_body", label: "상반신" }, { value: "full_body", label: "전신" }, { value: "hands_detail", label: "손 디테일" }] },
  { key: "lighting", label: "조도", options: [{ value: "soft_daylight", label: "부드러운 자연광" }, { value: "golden_hour", label: "골든아워" }, { value: "neon_night", label: "네온 야간" }, { value: "low_key", label: "로우키" }, { value: "high_key", label: "하이키" }] },
  { key: "mood", label: "분위기", options: [{ value: "calm", label: "차분함" }, { value: "joyful", label: "즐거움" }, { value: "tense", label: "긴장" }, { value: "mysterious", label: "신비" }, { value: "dramatic", label: "극적" }] },
  { key: "perspective", label: "시점", options: [{ value: "first_person", label: "1인칭" }, { value: "second_person", label: "2인칭" }, { value: "third_person", label: "3인칭" }] },
  { key: "wardrobe", label: "복장", humanOnly: true, options: [{ value: "bikini", label: "비키니 · 성인 20+" }, { value: "rash_guard", label: "래시가드 · 성인 20+" }, { value: "monokini", label: "모노키니 · 성인 20+" }, { value: "one_piece_swimsuit", label: "원피스 수영복 · 성인 20+" }, { value: "micro_bikini", label: "마이크로 비키니 · 성인·비노골적" }, { value: "lingerie", label: "란제리 · 성인 20+" }, { value: "school_inspired", label: "성인 school-inspired · 비성적" }, { value: "casual", label: "캐주얼" }, { value: "formal", label: "정장" }] },
  { key: "profession", label: "인물 직업·유형", humanOnly: true, options: [{ value: "kpop_idol", label: "K-Pop 아이돌 · 가상 성인" }, { value: "fashion_model", label: "패션 모델 · 가상 성인" }, { value: "announcer", label: "아나운서 · 가상 성인" }, { value: "flight_attendant", label: "승무원" }, { value: "police_officer", label: "경찰" }, { value: "office_worker", label: "회사원" }, { value: "adult_university_student", label: "성인 대학생" }, { value: "other_professional", label: "기타 전문직" }] },
];
const subjectDetails: Record<ImageBatchBrief["subjectKind"], ReadonlyArray<{ value: SubjectDetail; label: string }>> = {
  human: [{ value: "fictional_adult", label: "비식별 가상 성인 · 20세 이상" }],
  animal: [{ value: "dog", label: "개" }, { value: "cat", label: "고양이" }, { value: "horse", label: "말" }, { value: "wildlife", label: "야생동물" }],
  bird: [{ value: "songbird", label: "명금류" }, { value: "raptor", label: "맹금류" }, { value: "waterbird", label: "물새" }],
};
const referenceOptions = [
  { key: "preserveSubjectVisuals" as const, title: "주체의 시각 특성", description: "실루엣·포즈·색감" },
  { key: "preserveBackgroundLayout" as const, title: "배경 배치·조명", description: "공간 구조·빛·팔레트" },
  { key: "preserveCameraComposition" as const, title: "카메라 구도", description: "프레이밍·시점·원근" },
];

function regeneratedStory(brief: ImageBatchBrief) {
  if (brief.subjectKind === "human") return "A fictional adult age 20+ makes an original, calm decision in a cinematic scene with non-identifying features.";
  const subject = brief.subjectDetail === "dog" ? "dog" : brief.subjectDetail === "cat" ? "cat" : brief.subjectDetail === "horse" ? "horse" : brief.subjectKind === "bird" ? "bird" : "wild animal";
  return `An original ${subject} moves naturally through the scene with cinematic light and no people.`;
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

export function ImageBatchStudio({ repository, onContinue }: { repository: ImageBatchRepository; onContinue?: (batchId: string) => void }) {
  const vm = useImageBatchViewModel(repository);
  const human = vm.brief.subjectKind === "human";
  const alert = vm.policyMessage || vm.error;
  const pollingUncertain = vm.pollState === "retrying" || vm.pollState === "disconnected";
  const lastSuccessfulPoll = vm.lastSuccessfulPollAt === null ? "확인 기록 없음" : new Date(vm.lastSuccessfulPollAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const selectedVariant = vm.batch?.selection ? vm.batch.variants.find((variant) => variant.id === vm.batch?.selection?.variantId) : null;
  const canContinue = Boolean(selectedVariant?.status === "completed" && selectedVariant.delivery?.asset?.dataUri && vm.selectingVariantId === null && !pollingUncertain);
  function submit(event: FormEvent) { event.preventDefault(); void vm.submit(); }
  async function chooseReference(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const revision = vm.beginSourceInputRead();
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      input.value = "";
      vm.setSourceInputError("2D 원본은 PNG, JPEG 또는 WebP 파일만 사용할 수 있습니다.", revision);
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      input.value = "";
      vm.setSourceInputError("2D 원본은 6 MB 이하 파일만 사용할 수 있습니다.", revision);
      return;
    }
    try {
      const dataUrl = await readFile(file);
      vm.setSourceInput({ kind: "attested_original_2d", referenceImage: { mimeType: file.type as "image/png" | "image/jpeg" | "image/webp", dataUrl }, referenceFocus: vm.referenceFocus }, `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`, revision);
    } catch (error) {
      input.value = "";
      vm.setSourceInputError(error instanceof Error ? error.message : "2D 원본 파일을 읽을 수 없습니다.", revision);
    }
  }

  return <div className="unified-image-page">
    <header className="unified-image-hero">
      <p className="eyebrow">IMAGE STUDIO / ONE WORKFLOW</p>
      <h1 id="image-studio-title">한곳에서 설정하고,<br /><i>최대 세 후보를 비교하세요.</i></h1>
      <p>중복되던 이미지 설정을 하나의 제작 흐름으로 합쳤습니다. 참조, 장면, 촬영, 출력 형식을 정한 뒤 한 번만 생성합니다.</p>
    </header>
    <nav className="photo-process-rail" aria-label="이미지 제작 순서"><ol><li><b>01</b><span>입력 방식</span></li><li><b>02</b><span>통합 설정</span></li><li><b>03</b><span>스토리·출력</span></li><li><b>04</b><span>후보 선택</span></li><li><b>05</b><span>나의 프로젝트</span></li></ol></nav>
    <form className="photo-studio unified-image-studio" aria-labelledby="image-studio-title" onSubmit={submit}>
      <section className="photo-control-panel photo-mode-panel">
        <div className="photo-section-head"><span>01</span><div><p>MODE &amp; REFERENCE</p><h2>어떤 재료로 시작할까요?</h2></div></div>
        <div className="mode-grid" role="radiogroup" aria-label="실사 이미지 생성 방식">
          <button type="button" className={vm.mode === "text_to_photo" ? "selected" : ""} role="radio" aria-checked={vm.mode === "text_to_photo"} onClick={() => vm.setMode("text_to_photo")}><b>텍스트 → 실사</b><small>스토리와 통합 설정으로 새 이미지를 만듭니다.</small></button>
          <button type="button" className={vm.mode === "animation_2d_to_photo" ? "selected" : ""} role="radio" aria-checked={vm.mode === "animation_2d_to_photo"} onClick={() => vm.setMode("animation_2d_to_photo")}><b>2D 애니메이션 → 실사</b><small>권리를 보유한 원본의 선택 요소를 출발점으로 씁니다.</small></button>
        </div>
        {vm.mode === "animation_2d_to_photo" && <><label className="photo-reference"><span>2D 원본 한 장</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseReference(event)} /><small>PNG · JPEG · WebP / 6 MB 이하 / 실존 인물·미성년자·원작 캐릭터 제외</small>{vm.sourceLabel && <b>{vm.sourceLabel}</b>}</label><p id="photo-reference-egress" className="photo-reference-disclosure">원본은 이번 요청에만 전달되며 작업공간 정리 후 보관하지 않습니다.</p></>}
        {vm.mode === "animation_2d_to_photo" && <fieldset className="reference-focus-options"><legend>반영할 시각 요소</legend><div>{referenceOptions.map((option) => <button type="button" key={option.key} className={vm.referenceFocus[option.key] ? "selected" : ""} aria-pressed={vm.referenceFocus[option.key]} onClick={() => vm.toggleReferenceFocus(option.key)}><b>{option.title}</b><small>{option.description}</small></button>)}</div><small>최소 하나를 유지하며 스토리 지시가 우선합니다.</small></fieldset>}
      </section>

      <section className="photo-control-panel unified-settings-panel">
        <div className="photo-section-head"><span>02</span><div><p>ALL IMAGE SETTINGS</p><h2>중복 없이 장면 설정을 한 번에 정하세요.</h2></div></div>
        <div className="image-batch-grid unified-settings-grid">
          <label>등장 주체<select aria-label="등장 주체" value={vm.brief.subjectKind} onChange={(event) => vm.updateBrief("subjectKind", event.target.value as ImageBatchBrief["subjectKind"])}><option value="human">사람 · 비식별 가상 성인 20+</option><option value="animal">동물</option><option value="bird">새</option></select></label>
          <label>세부 주체<select aria-label="세부 주체" value={vm.brief.subjectDetail} onChange={(event) => vm.updateBrief("subjectDetail", event.target.value as SubjectDetail)}>{subjectDetails[vm.brief.subjectKind].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {groups.filter((group) => human || !group.humanOnly).map((group) => <label key={group.key}>{group.label}<select aria-label={group.label} value={String(vm.brief[group.key])} onChange={(event) => vm.updateBrief(group.key, event.target.value)}>{group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}
        </div>
        {!human && <p className="image-batch-rule">동물과 새에는 사람의 나이·성별 표현·직업·복장을 적용하지 않습니다.</p>}
        {human && <p className="image-batch-rule">인종·민족과 국가는 선택한 캐스팅·문화 연출값이며 이미지에서 신원이나 국적을 인식하지 않습니다. 모든 인물 유형은 비식별 가상 성인 20세 이상입니다.</p>}
        {human && <p className="image-batch-rule">성인 수영복은 비노골적이고 불투명한 신체 커버리지를 전제로 합니다. 아동·10대·연령 모호·노골적 성행위·강압 표현은 차단됩니다.</p>}
        {vm.brief.wardrobe === "school_inspired" && <p className="image-batch-rule">성인 대학생(20세 이상)의 비성적 editorial school-inspired 의상으로만 생성합니다.</p>}
      </section>

      <section className="photo-control-panel photo-story-panel">
        <div className="photo-section-head"><span>03</span><div><p>STORY &amp; OUTPUT</p><h2>장면과 결과 형식을 정하세요.</h2></div></div>
        <label className="image-batch-story">장면과 행동<textarea aria-label="장면과 행동" minLength={IMAGE_BATCH_STORY_MIN_LENGTH} maxLength={IMAGE_BATCH_STORY_MAX_LENGTH} value={vm.brief.story} onChange={(event) => vm.updateBrief("story", event.target.value)} /><span><small>{vm.brief.story.length}/{IMAGE_BATCH_STORY_MAX_LENGTH} · 실존 인물, 미성년자, 원작 캐릭터는 사용할 수 없습니다.</small><button type="button" onClick={() => vm.updateBrief("story", regeneratedStory(vm.brief))}>현재 설정으로 기본 지시 만들기</button></span></label>
        <div className="photo-output"><span>결과 형식</span><div className="output-grid" role="radiogroup" aria-label="이미지 결과 형식"><button type="button" role="radio" aria-checked={vm.outputKind === "still"} className={vm.outputKind === "still" ? "selected" : ""} onClick={() => vm.setOutputKind("still")}><b>실사 PNG</b><small>각 후보를 9:16 이미지로 반환합니다.</small></button><button type="button" role="radio" aria-checked={vm.outputKind === "motion_gif"} className={vm.outputKind === "motion_gif" ? "selected" : ""} onClick={() => vm.setOutputKind("motion_gif")}><b>모션 GIF</b><small>각 후보 스틸을 결정적 pan/zoom GIF로 조립합니다.</small></button></div>{vm.outputKind === "motion_gif" && <label className="gif-frame-control"><span>GIF 프레임 수 <b>{vm.frameCount}프레임</b></span><input aria-label="GIF 프레임 수" type="range" min={2} max={30} value={vm.frameCount} onChange={(event) => vm.setFrameCount(Number(event.target.value))} /><small>10fps · 최대 30프레임 · 추가 AI 생성 호출 없음</small></label>}</div>
        <fieldset className="image-batch-count"><legend>동시 생성 수</legend>{([1, 2, 3] as const).map((count) => <button key={count} type="button" aria-pressed={vm.variantCount === count} className={vm.variantCount === count ? "selected" : ""} onClick={() => vm.setVariantCount(count)}>{count}장</button>)}</fieldset>
        <div className="photo-confirm"><label className="image-batch-consent"><input type="checkbox" checked={vm.rightsAccepted} aria-describedby={vm.mode === "animation_2d_to_photo" ? "photo-reference-egress" : undefined} onChange={(event) => vm.setRightsAccepted(event.target.checked)} /><span>요청과 2D 입력은 내가 권리를 보유한 원본이며, 사람은 비식별 가상 성인입니다. 결과는 trusted-local 세션에만 남습니다.</span></label><button className="button button-primary" disabled={!vm.canSubmit} type="submit">{vm.isSubmitting ? "배치 준비 중" : `${vm.variantCount}개 후보 생성`}<span>→</span></button></div>
        {alert && <p className="image-batch-error" role="alert">{alert}</p>}
      </section>
    </form>

    {vm.batch && <section className="image-batch-results unified-image-results" aria-live="polite">
      <header><div><p>BATCH {vm.batch.id}</p><h2>{vm.pollState === "disconnected" ? "작업 상태 연결이 끊겼습니다." : vm.pollState === "retrying" ? "서버 응답을 다시 확인하고 있습니다." : vm.batch.status === "partial" ? "일부 후보가 완성되었습니다." : vm.isActive ? "후보를 독립적으로 생성하고 있습니다." : vm.batch.status === "completed" ? "모든 후보가 완성되었습니다." : "배치가 종료되었습니다."}</h2></div><b>{pollingUncertain ? vm.pollState.toUpperCase() : vm.batch.status.toUpperCase()}</b></header>
      {pollingUncertain && <div className={`image-batch-connection ${vm.pollState}`} role={vm.pollState === "disconnected" ? "alert" : "status"}>
        <div><span>{vm.pollState === "disconnected" ? "CONNECTION LOST" : "RECONNECTING"}</span><b>{vm.pollState === "disconnected" ? "작업 상태 연결이 끊겼습니다." : "자동으로 서버 연결을 다시 확인하고 있습니다."}</b></div>
        <p>{vm.pollState === "disconnected" ? "API가 재시작되었다면 메모리에만 있던 기존 작업은 복구할 수 없을 수 있습니다. 자동 재연결은 계속 시도합니다." : "표시된 숫자는 마지막으로 확인된 예상 진행률이며, 현재 생성 엔진의 실시간 진행률이 아닙니다."}</p>
        <small>마지막 정상 확인 {lastSuccessfulPoll} · 연속 실패 {vm.consecutivePollFailures}회{vm.pollError ? ` · ${vm.pollError}` : ""}</small>
        {vm.pollState === "disconnected" && <button type="button" onClick={vm.startNewGeneration}>새 생성 시작</button>}
      </div>}
      <div className="image-variant-grid">{vm.batch.variants.map((variant) => {
        const selected = vm.batch?.selection?.variantId === variant.id;
        const activeVariant = variant.status === "in_progress";
        const progressLabel = activeVariant ? pollingUncertain ? `마지막 확인 ${variant.progress}%` : `예상 ${variant.progress}%` : `${variant.progress}%`;
        return <article className={`image-variant-card ${selected ? "selected" : ""}`} key={variant.id}>
          <div className="image-variant-state"><span>VARIANT {variant.index + 1}</span><b>{variant.status}</b></div>
          {variant.delivery?.asset ? <img src={variant.delivery.asset.dataUri} alt={`생성 후보 ${variant.index + 1}`} /> : <div className={`image-variant-placeholder ${pollingUncertain && activeVariant ? "is-stale" : ""}`} role="progressbar" aria-label={`후보 ${variant.index + 1} ${activeVariant ? "예상 " : ""}진행률`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={variant.progress} aria-valuetext={progressLabel}><b>{progressLabel}</b><span>{pollingUncertain && activeVariant ? "서버 상태 확인 대기" : variant.progress === 90 && vm.isActive ? "결과 검증·완료 대기" : variant.phase}</span></div>}
          <p>{variant.treatment}</p>
          {variant.error && <small className="image-variant-error">{variant.error.code} · {variant.error.message}</small>}
          {variant.status === "completed" && <button type="button" aria-pressed={selected} disabled={vm.selectingVariantId !== null} onClick={() => void vm.selectVariant(variant.id)}>{selected ? `선택됨 · revision ${vm.batch?.selection?.revision}` : "이 이미지 선택"}</button>}
        </article>;
      })}</div>
      {vm.batch.selection && <div className={`image-project-handoff ${canContinue ? "ready" : ""}`}>
        <div><span>05 / MY PROJECT</span><h3>{canContinue ? "선택한 이미지를 나만의 프로젝트로 이어가세요." : "선택 결과를 확인하고 있습니다."}</h3><p>프로젝트 이름, 사용 목적, 창작 의도를 정한 뒤 기준 이미지와 모든 생성 설정을 그대로 가져갑니다.</p></div>
        <button className="button button-primary" type="button" disabled={!canContinue} onClick={() => vm.batch && onContinue?.(vm.batch.id)}>이 이미지로 프로젝트 시작 <span>→</span></button>
      </div>}
    </section>}

    <aside className="retouch-roadmap" aria-label="보정 기능 로드맵"><span>SPRINT 2 / PLANNED</span><h2>얼굴·몸매 보정은 아직 제공하지 않습니다.</h2><p>AI 보정과 포토샵형 수동 보정은 영역 마스크, 되돌리기, 편집 이력, provenance와 안전 재검증이 준비된 뒤 구현합니다.</p></aside>
  </div>;
}
