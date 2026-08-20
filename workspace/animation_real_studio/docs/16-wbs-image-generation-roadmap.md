# WBS — Image generation roadmap

## Roadmap

| Roadmap | Sprint | Feature | Units | Requirement IDs | State |
| --- | --- | --- | --- | --- | --- |
| R1 Structured creation | S1 Batch candidate vertical slice | Safe brief, automated unified defaults, 1–3 variants, partial success, selection | U1 domain contract; U2 gateway; U3 batch use case; U4 HTTP; U5 ViewModel; U6 View; U7 verification | IMG-001, IMG-002, IMG-003, IMG-004, IMG-005, IMG-006, IMG-007, IMG-008, IMG-010 | Implemented; deterministic gate defined below |
| R1 Project continuation | S1 Selected-image personal project | Save-time revalidated selection, project setup, actionable workboard, full-setting reference | U7A project domain/repository/view; U7B race/full-setting verification; U7C v2 work state/migration | IMG-011 | Implemented; image-project.v2 trusted-local session scope |
| R2 Reversible enhancement | S2 Retouch protocol and prototype | AI-assisted and manual bounded edits | U8 consent/schema; U9 mask editor; U10 revision history; U11 safety/provenance; U12 export disclosure | IMG-009 | Designed, implementation gated |
| R3 Durable studio | S3 Production foundation | Identity, persistence, quota, cancellation, recovery | U13 database schema; U14 queue; U15 auth; U16 storage; U17 observability | IMG-004, IMG-005, IMG-006, IMG-007, IMG-008 | Deferred |

## Sprint 1 WBS

| Unit | Owner/layer | Dependency | Deliverable | Evidence |
| --- | --- | --- | --- | --- |
| U1 | Business | approved PDD/FSD | enums, immutable unified defaults, subject automation, validation, safe prompt mapping | domain/ViewModel unit tests |
| U2 | Data | U1 | `StudioPhotoProjectAdapter` | adapter contract tests |
| U3 | Business | U1–U2 | bounded parallel batch/partial status/selection | batch service tests |
| U4 | Data/communication | U3 | `image-batch.v1` create/get/select routes | HTTP tests |
| U5 | Presentation/Business port | U4 | repository interface, HTTP adapter, ViewModel | ViewModel tests/build |
| U6 | Presentation | U5 | one unified text/2D + structured-setting + still/GIF + batch form, per-variant cards, selection, planned-retouch notice | Playwright E2E |
| U7 | Verification | U1–U6 | skill validation, trace check, API/build/E2E evidence | gate commands |
| U7C | Business/Data/Presentation | U7A | fixed three-item work plan, v1→v2 read migration, progress/next action, status and note persistence | Business/Data unit + focused workboard E2E |

## Requirement trace matrix

| ID | PDD outcome | FSD behavior | TDD boundary | WBS unit | Test |
| --- | --- | --- | --- | --- | --- |
| IMG-001 | safe subjects and casting context | subject/ethnicity/country allow-lists | domain validation and prompt mapping | U1/U6 | invalid combinations + unique UI controls + exact payload |
| IMG-002 | directed scenes | scene enum DTO | domain prompt mapping | U1/U6 | enum validation + request payload |
| IMG-003 | adult-safe roles | fictional archetypes, expanded swimwear, classified intent and cross-field errors | Business policy before Data | U1/U6 | K-Pop/model/announcer independence; five swimwear types; animal/no-person plus allowed-adult, minor, explicit, real-person, and age-coded cases |
| IMG-004 | 1–3 variants | create protocol | bounded `Promise.all` | U3/U4 | count limits + overlap |
| IMG-005 | partial value | derived batch state | independent gateway operations | U3/U6 | partial failure API/UI |
| IMG-006 | deliberate selection | select protocol | Business same-batch invariant | U3/U4/U6 | invalid/idempotent/reselect |
| IMG-007 | replaceable layers | repository/gateway ports | Presentation/Business/Data + DI | U2/U5 | fake-repository ViewModel + Studio gateway adapter contracts |
| IMG-008 | trustworthy progress | stable errors/status | safe snapshots/evidence gate | U4/U7 | full API/build/E2E/trace |
| IMG-009 | safe retouch future | no v1 endpoint | future schema-first boundary | U8–U12 | absence and planned-label E2E |
| IMG-010 | one automated default profile | initial and subject-dependent default behavior | immutable Business profile copied into ViewModel lifetime | U1/U5/U6 | full-default/isolation unit test + initial payload E2E |
| IMG-011 | concrete personal project | selected-image setup, actionable three-item workboard and full setting handoff | selection revision revalidated at every save; metadata-only v2 session repository with v1 read migration | U7A/U7B/U7C | Business selection/schema/storage tests + work save/reload/migration/race/direct/mobile E2E |

## Definition of done

All IMG-001 through IMG-008, IMG-010, and IMG-011 rows require passing evidence after the latest edit; the app runs on loopback; progress documentation matches command output; reviewer and scoped drift evidence are recorded. IMG-009 remains explicitly designed and unavailable.
# IMG-011 · 개인 프로젝트 전환 WBS

- [x] 선택 성공 후에만 프로젝트 CTA 노출
- [x] 최신 selection/delivery 재조회와 오류 상태
- [x] 프로젝트 이름·목적·창작 의도 구체화
- [x] metadata-only `image-project.v2` 세션 저장과 유효한 v1 읽기 마이그레이션
- [x] 선택 이미지와 생성 설정을 보존한 프로젝트 작업공간
- [x] 목적별 고정 작업 3개, 작업 상태·메모·공통 메모, 진행률·다음 행동
- [x] 모든 저장의 selection revision 재검증과 목적 변경 초기화 확인
- [x] Business/Data 단위 테스트, E2E 작업 저장·복구·마이그레이션·경쟁 조건·직접 진입 실패·390px 검증
