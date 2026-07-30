import { ChangeEvent, FormEvent, useEffect, useState } from "react";

type Route = "/" | "/create" | "/projects/demo-001" | "/safety";
type SourceRelationship = "original" | "inspired" | "licensed" | "";
type ReferencePurpose = "setting" | "lighting" | "composition" | "movement" | "";

const steps = ["장면 의도", "권리와 안전", "연출", "확인"];

const beats = [
  ["00–02", "Hook", "비에 젖은 지하철 승강장. 카메라가 빈 우산을 든 배달원의 손을 따라간다."],
  ["02–07", "Tension", "도착하지 않은 편지를 발견한 뒤, 멀리 선 인물과 시선이 마주친다."],
  ["07–11", "Turn", "그는 편지를 접어 주머니에 넣고, 처음으로 미소를 짓는다."],
  ["11–15", "Aftertaste", "막차 문이 닫히고 자막: ‘이번에는, 내가 먼저 갈게.’"],
];

function routeFromLocation(): Route {
  const pathname = window.location.pathname;
  return pathname === "/create" || pathname === "/projects/demo-001" || pathname === "/safety"
    ? pathname
    : "/";
}

function App() {
  const [route, setRoute] = useState<Route>(routeFromLocation());

  useEffect(() => {
    const onPopState = () => setRoute(routeFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(next: Route) {
    window.history.pushState({}, "", next);
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <header className="site-header">
        <button className="brand" onClick={() => navigate("/")} aria-label="Animation Real Studio 홈">
          <span className="brand-mark">AR</span>
          <span>ANIMATION<br />REAL STUDIO</span>
        </button>
        <nav aria-label="주요 메뉴">
          <button onClick={() => navigate("/safety")}>RIGHTS &amp; SAFETY</button>
          <button onClick={() => navigate("/projects/demo-001")}>MY STUDIO</button>
          <button className="nav-cta" onClick={() => navigate("/create")}>장면 의뢰하기 <span>↗</span></button>
        </nav>
      </header>
      <main>
        {route === "/" && <Home navigate={navigate} />}
        {route === "/create" && <Create navigate={navigate} />}
        {route === "/projects/demo-001" && <Project navigate={navigate} />}
        {route === "/safety" && <Safety navigate={navigate} />}
      </main>
      <footer>
        <span>ANIMATION REAL STUDIO / CONCEPT DEMO</span>
        <span>PRIVATE BY DEFAULT · ORIGINALS ONLY</span>
      </footer>
    </>
  );
}

function Home({ navigate }: { navigate: (route: Route) => void }) {
  return (
    <div className="home">
      <section className="hero layout-grid">
        <div className="hero-copy">
          <p className="eyebrow"><span className="pulse" /> ORIGINAL SHORT-FORM PRODUCTION STUDIO</p>
          <h1>상상한<br /><i>장면을</i><br />현실의 한 컷으로.</h1>
          <p className="hero-intro">좋아했던 감정과 관계를, 원작을 복제하지 않는 새로운 실사풍 쇼츠로 만듭니다. 당신의 한 장면은 먼저 기획되고, 승인된 뒤에만 제작됩니다.</p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => navigate("/create")}>내 장면 만들기 <span>→</span></button>
            <button className="button button-quiet" onClick={() => navigate("/safety")}>제작 기준 보기</button>
          </div>
        </div>
        <div className="hero-reel" aria-label="15초 세로 쇼츠 데모 프레임">
          <div className="reel-noise" />
          <div className="reel-top"><span>TAKE 01</span><span>00:15</span></div>
          <div className="reel-figure figure-one" />
          <div className="reel-figure figure-two" />
          <div className="reel-subtitle">이번에는, 내가 먼저 갈게.</div>
          <div className="reel-bottom"><span>9:16 / ORIGINAL CONCEPT</span><span className="live-dot">●</span></div>
        </div>
      </section>

      <section className="principles">
        <p className="section-label">THE STUDIO PROMISE</p>
        <div className="principle-grid">
          <article><span>01</span><h2>당신의 <em>감정</em>을<br />기획합니다.</h2><p>자유로운 이야기를 15초 안에 닿는 장면과 자막, 쇼트 리스트로 정리합니다.</p></article>
          <article><span>02</span><h2>원작 대신<br /><em>새로운 세계</em>를 만듭니다.</h2><p>특정 캐릭터·대사·장면을 재현하지 않고, 관계와 분위기를 오리지널 콘셉트로 바꿉니다.</p></article>
          <article><span>03</span><h2>결과는<br /><em>당신만</em> 봅니다.</h2><p>모든 제작본은 Private로 전달됩니다. 공개·공유는 별도의 확인이 필요합니다.</p></article>
        </div>
      </section>

      <section className="flow-section">
        <div><p className="section-label">HOW A SCENE BECOMES A SHORT</p><h2>의뢰부터<br />한 장면의 완성까지.</h2></div>
        <ol className="process-list">
          <li><b>01</b><div><h3>장면을 말해 주세요</h3><p>누구에게 어떤 일이 일어나고, 어떤 마음을 남기고 싶은지요. 사진·영상 참조가 있다면 공간과 빛, 카메라 감각만 함께 전할 수 있습니다.</p></div><span>↘</span></li>
          <li><b>02</b><div><h3>기획안을 함께 봅니다</h3><p>오리지널화된 로그라인과 15초 스토리보드를 확인합니다.</p></div><span>↘</span></li>
          <li><b>03</b><div><h3>Private로 전달됩니다</h3><p>승인된 버전만 영상·자막·썸네일 묶음으로 보관합니다.</p></div><span>↘</span></li>
        </ol>
      </section>

      <section className="safe-callout">
        <span className="callout-symbol">✦</span>
        <div><p className="section-label">ORIGINALS, NOT REPLICAS</p><h2>당신이 사랑한 이야기는<br />새로운 장면이 될 수 있습니다.</h2></div>
        <button className="button button-primary" onClick={() => navigate("/create")}>첫 장면 의뢰하기 <span>→</span></button>
      </section>
    </div>
  );
}

function Create({ navigate }: { navigate: (route: Route) => void }) {
  const [step, setStep] = useState(0);
  const [scene, setScene] = useState("");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePurpose, setReferencePurpose] = useState<ReferencePurpose>("");
  const [referenceError, setReferenceError] = useState("");
  const [referenceInputKey, setReferenceInputKey] = useState(0);
  const [relationship, setRelationship] = useState<SourceRelationship>("");
  const [mood, setMood] = useState("rainy-station");
  const [rightsAccepted, setRightsAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const sceneValid = scene.trim().length >= 30 && scene.trim().length <= 700;
  const referenceReady = referenceFile === null || (referencePurpose !== "" && referenceError === "");

  const canMove = step === 0 ? sceneValid && referenceReady : step === 1 ? relationship !== "" : step === 2 ? true : rightsAccepted;
  const reviewLabel = relationship === "inspired" ? "오리지널화 재작성 필요" : relationship === "licensed" ? "사람 검토 필요" : "기획안 생성 가능";

  function handleReferenceChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setReferenceFile(file);
    setReferencePurpose("");
    if (!file) {
      setReferenceError("");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "video/mp4"];
    if (!allowedTypes.includes(file.type)) {
      setReferenceError("JPEG·PNG·WebP 사진 또는 MP4 영상만 선택해 주세요.");
    } else if (file.size > 100 * 1024 * 1024) {
      setReferenceError("참조 파일은 100MB 이하만 선택할 수 있습니다.");
    } else {
      setReferenceError("");
    }
  }

  function clearReference() {
    setReferenceFile(null);
    setReferencePurpose("");
    setReferenceError("");
    setReferenceInputKey((key) => key + 1);
  }

  function advance() {
    setAttempted(true);
    if (!canMove) return;
    if (step < steps.length - 1) {
      setStep(step + 1);
      setAttempted(false);
    } else {
      setSubmitted(true);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    advance();
  }

  if (submitted) {
    return <StoryboardQueued navigate={navigate} relationship={relationship} />;
  }

  return (
    <div className="create-page">
      <section className="create-heading">
        <p className="eyebrow">NEW COMMISSION / 15 SEC / PRIVATE</p>
        <h1>한 장면을<br /><i>의뢰합니다.</i></h1>
        <p>실제 영상은 아직 만들어지지 않습니다. 이 데모는 안전한 제작 의뢰 경험만 보여 줍니다.</p>
      </section>
      <div className="wizard-shell">
        <aside className="wizard-steps" aria-label="의뢰 단계">
          {steps.map((label, index) => <div key={label} className={index === step ? "active" : index < step ? "done" : ""}><span>{String(index + 1).padStart(2, "0")}</span>{label}{index < step && <b>✓</b>}</div>)}
        </aside>
        <form className="wizard-card" onSubmit={submit}>
          {step === 0 && <>
            <p className="section-label">01 / SCENE INTENT</p><h2>어떤 순간을<br />보고 싶나요?</h2>
            <label htmlFor="scene">장면 설명 <small>30–700자</small></label>
            <textarea id="scene" value={scene} onChange={(e) => setScene(e.target.value)} placeholder="예: 비 오는 밤, 오랫동안 연락하지 못했던 두 친구가 막차가 떠나기 전 플랫폼에서 마주친다. 한 사람은 용서를 전하려 하고, 다른 사람은 대답 대신 우산을 건넨다." aria-describedby="scene-help scene-error" />
            <div className="field-meta"><span id="scene-help">인물 이름 대신 역할과 관계, 사건, 남기고 싶은 감정을 적어 주세요.</span><b>{scene.length}/700</b></div>
            {attempted && !sceneValid && <p className="field-error" id="scene-error" role="alert">장면 설명을 30자 이상 700자 이하로 작성해 주세요.</p>}
            <section className="reference-media" aria-labelledby="reference-media-title">
              <div className="reference-heading"><div><p className="section-label">OPTIONAL / VISUAL REFERENCE</p><h3 id="reference-media-title">장면의 공기를<br />보여 주세요.</h3></div><span>01 FILE</span></div>
              <p>사진 한 장 또는 무음 15초 이하 영상을 추가할 수 있습니다. 인물·캐릭터·원작 장면을 재현하지 않으며, 배경·빛·구도·움직임만 참고합니다.</p>
              <label className="reference-drop" htmlFor="reference-file"><input key={referenceInputKey} id="reference-file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={handleReferenceChange} /><span className="reference-drop-mark">＋</span><span><b>사진 또는 영상 선택</b><small>JPEG · PNG · WebP · MP4 / 100MB 이하</small></span></label>
              {referenceFile && <div className="reference-file" role="status"><div><span>REFERENCE ATTACHED</span><b>{referenceFile.name}</b><small>{referenceFile.type.startsWith("video/") ? "영상" : "사진"} · 실제 서비스에서는 격리 검사 후 사용됩니다.</small></div><button type="button" onClick={clearReference}>제거</button></div>}
              {referenceFile && !referenceError && <div className="reference-purpose"><span>이 자료에서 무엇을 참고하나요?</span><div>{([['setting', '배경 / 공간'], ['lighting', '조명 / 색감'], ['composition', '카메라 구도'], ['movement', '움직임 리듬']] as const).map(([value, label]) => <button type="button" key={value} className={referencePurpose === value ? "selected" : ""} onClick={() => setReferencePurpose(value)} aria-pressed={referencePurpose === value}>{label}</button>)}</div></div>}
              {referenceError && <p className="field-error" role="alert">{referenceError}</p>}
              {attempted && referenceFile && !referenceError && referencePurpose === "" && <p className="field-error" role="alert">참조 자료의 사용 목적을 하나 선택해 주세요.</p>}
            </section>
          </>}
          {step === 1 && <>
            <p className="section-label">02 / RIGHTS &amp; SAFETY</p><h2>이 장면은<br />어디에서 왔나요?</h2>
            <div className="choice-grid">
              <Choice checked={relationship === "original"} onChange={() => setRelationship("original")} title="내 오리지널 이야기" text="내가 만든 인물과 세계의 장면입니다." />
              <Choice checked={relationship === "inspired"} onChange={() => setRelationship("inspired")} title="기존 작품에서 영감" text="감정·관계만 참고하고, 고유 요소는 새로 만듭니다." />
              <Choice checked={relationship === "licensed"} onChange={() => setRelationship("licensed")} title="권리 또는 라이선스 보유" text="권한 주장은 운영자 증빙 검토가 필요합니다." />
            </div>
            {relationship && <div className={`review-note ${relationship}`}><span>✦</span><div><b>{reviewLabel}</b><p>{relationship === "inspired" ? "작품명, 캐릭터명, 고유 대사 대신 관계와 감정으로 다시 기획합니다." : relationship === "licensed" ? "권리 증빙이 확인되기 전까지 제작은 시작되지 않습니다." : "오리지널 요청도 제출 전 안전 기준을 확인합니다."}</p></div></div>}
            {attempted && !relationship && <p className="field-error" role="alert">원작 관계를 하나 선택해 주세요.</p>}
          </>}
          {step === 2 && <>
            <p className="section-label">03 / DIRECTION</p><h2>장면의 공기를<br />고릅니다.</h2>
            <div className="mood-grid">
              <button type="button" onClick={() => setMood("rainy-station")} className={mood === "rainy-station" ? "selected" : ""}><span className="mood rain" /><b>비 내린 플랫폼</b><small>젖은 금속 · 청색 조명</small></button>
              <button type="button" onClick={() => setMood("warm-room")} className={mood === "warm-room" ? "selected" : ""}><span className="mood warm" /><b>늦은 밤의 방</b><small>스탠드 조명 · 낮은 온기</small></button>
              <button type="button" onClick={() => setMood("fictional-set")} className={mood === "fictional-set" ? "selected" : ""}><span className="mood set" /><b>가상의 촬영 현장</b><small>오리지널 세트 · 메타픽션</small></button>
            </div>
            <div className="direction-spec"><div><span>FORMAT</span><b>9:16 vertical</b></div><div><span>DURATION</span><b>15 seconds</b></div><div><span>CAPTIONS</span><b>한국어 내장 자막</b></div></div>
          </>}
          {step === 3 && <>
            <p className="section-label">04 / CONFIRMATION</p><h2>제작 기준을<br />확인해 주세요.</h2>
            <div className="confirmation"><p><b>이 데모는 실제 제작을 시작하지 않습니다.</b> 실제 서비스에서는 제출 전 정책 검사, 기획안 확인, 사용자 승인이 순서대로 진행됩니다.</p><label className="check-row"><input type="checkbox" checked={rightsAccepted} onChange={(e) => setRightsAccepted(e.target.checked)} /><span>제3자 IP·실존 인물·원작 클립과 음원을 무단으로 사용하지 않으며, 참조 파일은 격리 검사·정제·삭제 정책을 거친 뒤에만 쓰인다는 점과 정책에 맞지 않는 요청은 재작성·검토·차단될 수 있음을 이해합니다.</span></label></div>
            {attempted && !rightsAccepted && <p className="field-error" role="alert">제작 기준을 확인해 주세요.</p>}
          </>}
          <div className="wizard-actions"><button type="button" className="button button-quiet" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>이전</button><button className="button button-primary" type="submit">{step === 3 ? "데모 스토리보드 보기" : "다음"} <span>→</span></button></div>
        </form>
      </div>
    </div>
  );
}

function Choice({ checked, onChange, title, text }: { checked: boolean; onChange: () => void; title: string; text: string }) {
  return <button type="button" className={`choice ${checked ? "selected" : ""}`} onClick={onChange} aria-pressed={checked}><span className="radio" /> <b>{title}</b><small>{text}</small></button>;
}

function StoryboardQueued({ navigate, relationship }: { navigate: (route: Route) => void; relationship: SourceRelationship }) {
  const needsReview = relationship !== "original";
  return <div className="storyboard-page"><section className="storyboard-intro"><p className="eyebrow">{needsReview ? "DEMO / REVIEW REQUIRED" : "DEMO / STORYBOARD READY"}</p><h1>{needsReview ? "먼저, 원작과\n거리를 둡니다." : "15초의 감정이\n준비되었습니다."}</h1><p>{needsReview ? "이 선택은 실제 생성으로 이어지지 않습니다. 운영자 검토 또는 오리지널화 재작성 뒤에만 제작할 수 있습니다." : "아래 기획안은 데모입니다. 승인하면 프로젝트는 생성 대기 상태로 보입니다."}</p></section><section className="storyboard-card"><div className="storyboard-head"><div><span>ORIGINAL LOG LINE</span><h2>막차가 떠나기 전, 두 친구는 말 대신 우산을 건넨다.</h2></div><b>{needsReview ? "REVIEW" : "15 SEC"}</b></div><div className="beats">{beats.map(([time, name, description]) => <article key={time}><span>{time}</span><b>{name}</b><p>{description}</p></article>)}</div><div className="storyboard-actions">{needsReview ? <button className="button button-primary" onClick={() => navigate("/create")}>의뢰 내용 고치기 <span>→</span></button> : <button className="button button-primary" onClick={() => navigate("/projects/demo-001")}>스토리보드 승인 (데모) <span>→</span></button>}<button className="button button-quiet" onClick={() => navigate("/safety")}>제작 기준 보기</button></div></section></div>;
}

function Project({ navigate }: { navigate: (route: Route) => void }) {
  return <div className="project-page"><div className="project-top"><div><p className="eyebrow">PROJECT / DEMO-001</p><h1>막차가 떠나기 전</h1><p>비 오는 승강장에서 말 대신 우산을 건네는 두 친구의 오리지널 장면.</p></div><span className="private-badge">● PRIVATE</span></div><div className="project-layout"><section className="project-main"><div className="status-card"><div><span className="status-kicker">CURRENT STATUS</span><h2><i>생성 대기</i> 중입니다.</h2><p>이 화면은 실제 생성 상태를 연결하지 않은 데모입니다. 실제 서비스에서는 승인된 스토리보드만 대기열에 들어갑니다.</p></div><span className="status-orb">03</span></div><div className="project-section"><div className="section-heading"><p className="section-label">APPROVED STORYBOARD</p><button onClick={() => navigate("/create")}>의뢰 수정 ↗</button></div><div className="mini-beats">{beats.map(([time, name]) => <div key={time}><span>{time}</span><b>{name}</b></div>)}</div></div><div className="project-section"><div className="section-heading"><p className="section-label">DELIVERY / DEMO PLACEHOLDER</p><span className="demo-label">DEMO</span></div><div className="delivery-card"><div className="delivery-poster"><span>15<br />SEC</span></div><div><h3>생성 결과는 여기에 전달됩니다.</h3><p>완성된 버전에는 MP4, VTT/SRT 자막, 썸네일, 제작 이력이 함께 보관됩니다.</p><div className="asset-row"><span>MP4</span><span>VTT</span><span>SRT</span><span>THUMBNAIL</span></div><button disabled className="button button-quiet">데모에서는 다운로드할 수 없습니다</button></div></div></div></section><aside className="project-aside"><p className="section-label">PRODUCTION RECORD</p><dl><div><dt>FORMAT</dt><dd>1080 × 1920</dd></div><div><dt>DURATION</dt><dd>00:15</dd></div><div><dt>VISIBILITY</dt><dd>Private by default</dd></div><div><dt>CAPTIONS</dt><dd>한국어 / included</dd></div><div><dt>VERSION</dt><dd>Storyboard v1</dd></div></dl><div className="next-action"><span>다음 행동</span><b>실제 서비스에서는<br />생성 결과를 기다립니다.</b></div></aside></div></div>;
}

function Safety({ navigate }: { navigate: (route: Route) => void }) {
  return <div className="safety-page"><section className="safety-hero"><p className="eyebrow">RIGHTS &amp; SAFETY / BEFORE PRODUCTION</p><h1>좋아하는 마음은<br /><i>복제하지 않아도</i><br />장면이 됩니다.</h1><p>Animation Real Studio는 특정 작품을 똑같이 재현하는 도구가 아닙니다. 당신이 느낀 관계·감정·갈등을 새로운 인물과 세계로 다시 기획합니다.</p></section><section className="safety-grid"><article className="safe"><span>CAN</span><h2>가능한 의뢰</h2><ul><li>“멀어진 친구와 다시 마주하는 긴장감”</li><li>“비 오는 학교 옥상의 청춘 드라마 톤”</li><li>“가상의 작품을 촬영하는 메타 영화 현장”</li></ul></article><article className="avoid"><span>PAUSE</span><h2>재작성 또는 검토</h2><ul><li>특정 캐릭터·고유 대사·정확한 장면 재현</li><li>실존 인물의 얼굴·목소리·행동 재현</li><li>권리를 주장하지만 증빙이 필요한 요청</li></ul></article></section><section className="safety-foot"><h2>무엇이 바뀌나요?</h2><p>작품명 대신 역할을, 고유 복장 대신 분위기를, 원 대사 대신 새로운 감정의 문장을 씁니다. 제작 전 기획안을 보여드리고, 사용자가 확인한 뒤에만 다음 단계로 갑니다.</p><button className="button button-primary" onClick={() => navigate("/create")}>안전하게 장면 시작하기 <span>→</span></button></section></div>;
}

export default App;
