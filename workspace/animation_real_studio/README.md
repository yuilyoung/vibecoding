# Animation Real Studio

사용자가 원하는 감정·관계·상황을 입력하면, 권리와 안전 기준을 먼저 통과시킨 뒤 **오리지널 실사풍 세로 숏폼**으로 기획·생성·전달하는 제작 스튜디오의 준비 패키지다.

## 현재 상태

- `/create`: 권리·안전 사전 확인과 로컬 스토리보드 프리뷰를 제공한다.
- `/real`: 텍스트 또는 권리를 보유한 2D 원본, 공통 장면 설정, PNG/GIF 출력, 1–3개 후보 생성·선택을 하나의 `image-batch.v1` 폼으로 제공한다.
- 사람은 인종·민족 표현과 국가·문화권을 독립적으로 선택하고, 비식별 가상 성인 K-Pop 아이돌·패션 모델·아나운서 및 성인 수영복 세부 유형을 지정할 수 있다. 업로드 이미지에서 신원·인종·국적을 추론하지 않는다.
- `/real`의 진행 숫자는 provider 실측값이 아닌 서버 예상치다. 폴링이 끊기면 마지막 확인값으로 전환하고 자동 재연결·메모리 작업 복구 한계를 결과 영역에서 안내한다.
- 실제 이미지 생성은 `STUDIO_HEADLESS_IMAGEGEN=1`을 명시한 신뢰 가능한 로컬 개발 환경에서만 동작한다. 공개·프로덕션 서비스는 아니다.
- 제품 발견 태스크 `ARS-001`의 외부 결정과 인터뷰 증거는 아직 별도 게이트로 남아 있다.
- 기존 `workspace/2D-FPS-game`은 변경하지 않는다.

## 문서 순서

1. [참고 자료와 가정](docs/00-reference-and-assumptions.md)
2. [PRD](docs/01-prd.md)
3. [PRD 검증 계획](docs/02-validation-plan.md)
4. [서비스·UX·데이터 설계](docs/03-service-design.md)
5. [전문 스킬과 책임 경계](docs/04-specialist-skills.md)
6. [참조 미디어 입력 설계](docs/07-reference-media-input-design.md)
7. [실행 태스크](tasks/mvp-readiness.json)

## 결정된 MVP 원칙

- 결과물은 기본 **비공개**다. 공개 갤러리와 공유는 사용자의 명시적 옵트인 뒤에만 가능하다.
- MVP는 15초, 9:16, 1080×1920의 세로 MP4와 자막·썸네일·버전 메타데이터를 한 묶음으로 제공한다.
- 특정 애니메이션 IP·캐릭터·대사·장면을 그대로 복제하는 요청, 권한 없는 실존 인물 재현은 생성 전에 차단 또는 검토 대기로 보낸다.
- AI 영상 공급자는 아직 고정하지 않는다. 공급자 어댑터와 실현 가능성 스파이크를 먼저 수행한다.
- 선택 참조는 비식별 배경·조명·구도·움직임 자료 한 건만 허용하며, 격리·정책 검사·정제 뒤에만 생성에 사용한다.

## 프로젝트 로컬 스킬

`/.codex/skills/`에는 요청 정리, 참조 미디어 격리·판정, 권리·안전 판정, 세로 숏폼 연출, 전달물 운영, YouTube 배포 운영을 위한 여섯 개의 재사용 스킬이 있다. 이들은 제작 기능 구현이 아니라, 이후 각 작업을 일관되게 수행하기 위한 작업 계약이다.

## 로컬 실행

터미널 두 개에서 아래 명령을 실행합니다.

```powershell
npm run dev:api
npm run dev
```

웹사이트는 `http://127.0.0.1:5173`에서 열립니다. 상단에 `LOCAL API`가 표시되면 API 프록시가 연결된 상태입니다.

- 오리지널 의뢰는 로컬 프로젝트와 15초 세로 스토리보드를 생성하고, 작업대에서 모의 렌더 상태를 확인할 수 있습니다.
- 영감·라이선스 의뢰는 권리 검토 상태에 머물며 큐에 넣을 수 없습니다.
- `/create`의 스토리보드 프리뷰는 로컬 고정 템플릿이며, `/real`의 trusted-local 이미지 생성과 분리되어 있습니다.
- `/real`의 2D 원본은 선택한 생성 요청에만 전달되며 배치 상태나 응답에 보관하지 않습니다.
- 실제 공급자 전환 조건은 [공급자 및 렌더링 ADR](docs/08-provider-and-rendering-adr.md)에 기록했습니다.

검증 명령:

```powershell
npm run test:api
npm run build
```
## Current MVP: local 2D still previews

Video APIs are deferred. An original request that passes the existing narrow local text precheck can complete a local-only workflow with four deterministic 1080x1920 SVG still previews and Korean caption drafts.

- The stills are fixed local templates, not AI-generated or photorealistic images.
- No user-media bytes, external provider, credential, upload, photo, video, or download is used.
- Inspired and licensed requests remain blocked for rights review.
- The documented five daily submissions and three hourly retries are not enforced yet because this local MVP has no authentication, persistent user quota, or retry endpoint.
## Trusted-local photorealistic still experiment

`STUDIO_HEADLESS_IMAGEGEN=1` is an opt-in local-development switch. With it enabled, `/real` submits one integrated batch request for one to three independent 9:16 candidates. The request can be text-only or include one user-attested original 2D PNG/JPEG/WebP under 6 MB; the selected source is staged only for each trusted-local provider invocation and is excluded from returned batch state. Each candidate returns either one still or a deterministic 2–30 frame/10fps pan/zoom GIF derived from its generated still. Progress is server-owned, capped at 90% until the artifact is validated, and reaches 100% only at terminal success. This path is not AI video, a public service, or a production media service. See [the experiment boundary](docs/11-trusted-local-photorealistic-experiment.md) and [the unified reference UX contract](docs/12-reference-guided-photorealistic-ux-redesign.md).

## Image batch Sprint 1

`/real` now presents one integrated `image-batch.v1` form and one submit path. It combines text or original-2D input, still or motion-GIF output, fictional adult humans age 20+, animals, and birds; era, weather, environment, camera, lighting, mood, perspective, adult wardrobe (including bikini and lingerie), and profession controls; one to three independent candidates; partial success; and idempotent result selection. Consensual non-graphic adult sensual styling is accepted, while minor/teen/age-ambiguous, real-person, explicit/pornographic/coercive, and erotic school-coded requests are blocked. The former direct photorealistic form is not mounted on this route.

- Architecture and traceability: `docs/13-*` through `docs/16-*`.
- Project skill: `.codex/skills/image-studio-sprint-delivery`.
- Delivery trace gate: `npm run test:image-delivery`.
- Face/body AI retouch and Photoshop-style manual retouch are planned for Sprint 2 and are not available.
- Product discovery task `ARS-001` remains `pending_external_evidence`; the batch implementation does not satisfy or bypass those external decisions/interviews.
# 선택 이미지로 개인 프로젝트 이어가기

생성 결과에서 완료 후보 하나를 선택하면 `이 이미지로 프로젝트 시작`이 활성화됩니다. 프로젝트 화면에서 이름, 사용 목적, 창작 의도를 정하면 선택 이미지와 원래 생성 설정을 기준으로 다음 제작 절차가 제시됩니다. 프로젝트 메타데이터는 현재 브라우저 세션에만 유지되며 로컬 API 재시작 후 생성 배치는 복구되지 않습니다.
