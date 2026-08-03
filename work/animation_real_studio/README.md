# Animation Real Studio

사용자가 원하는 감정·관계·상황을 입력하면, 권리와 안전 기준을 먼저 통과시킨 뒤 **오리지널 실사풍 세로 숏폼**으로 기획·생성·전달하는 제작 스튜디오의 준비 패키지다.

## 현재 상태

- 단계: PRD, 검증 계획, 서비스 설계, 전문 스킬, 실행 백로그 준비 완료
- 구현 상태: 시작 전 (제공자 선정과 검증 스파이크가 선행 조건)
- 기존 `work/2D-FPS-game`은 변경하지 않는다.

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
- 현재는 `mock` 공급자만 사용합니다. 파일 바이트·공급자 키·실제 MP4를 전송하거나 저장하지 않습니다.
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