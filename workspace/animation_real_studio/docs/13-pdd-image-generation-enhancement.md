# PDD — Image generation enhancement

Status: Sprint 1 approved vertical slice; IMG-009 U8 architecture complete and implementation gated, 2026-08-20.

## Product outcome

Animation Real Studio should turn one safe creative brief into one to three visibly different image candidates, let the creator compare independent progress and failures, and retain one deliberate selection. The slice extends the trusted-local experiment; it does not make it a production or public service.

## Users and jobs

- A creator chooses a fictional adult human, animal, or bird and directs casting ethnicity, country/cultural context, background, camera, light, point of view, wardrobe, and profession without hand-writing provider syntax.
- A creator requests up to three variants in one batch and keeps useful results if another variant fails.
- A creator configures text/2D input, all scene controls, PNG/GIF output, rights acknowledgement, and 1–3 candidates in one form with one submit action; no duplicated legacy form remains on `/real`.
- A creator selects or reselects one completed candidate as the current result.
- An operator can explain precisely which parts are implemented, experimental, blocked by external evidence, or planned.

## Requirements

| ID | Product requirement | Outcome |
| --- | --- | --- |
| IMG-001 | Structured subject controls | Human, animal, and bird choices use safe domain vocabulary; human casting ethnicity and country/cultural context are explicit and never inferred from an image. |
| IMG-002 | Structured scene controls | Era, weather, environment, camera angle, framing, lighting/mood, first/second/third-person perspective, presentation, age, and people count are explicit in one unified form. |
| IMG-003 | Adult-safe role and wardrobe controls | Fictional K-Pop idol, fashion model, announcer, existing professions, and bikini/rash-guard/monokini/one-piece/micro-bikini plus existing wardrobe combinations are validated. |
| IMG-004 | One-to-three batch generation | One request creates one to three independently identified variants. |
| IMG-005 | Independent status and partial success | A failed variant cannot erase a completed variant. |
| IMG-006 | Result selection | Only a completed candidate from the same batch can be selected; same-selection is idempotent. |
| IMG-007 | Three-layer MVVM architecture | Presentation, Business, and Data dependencies are replaceable and composed through DI. |
| IMG-008 | Automated verification and progress truth | Domain, HTTP, ViewModel, browser, build, and traceability checks describe current evidence. |
| IMG-009 | Retouch roadmap | AI and manual face/body retouch use the schema-first U8 contract for consent, mask, revision, provenance, safety, retention, and export disclosure; U9–U12 remain unavailable behind external-evidence and implementation gates. |
| IMG-010 | Automated unified defaults | One immutable Business profile initializes the full `/real` form and supplies subject-specific automatic values without resetting unrelated scene settings. |
| IMG-011 | Selected-image project continuation | A confirmed completed candidate continues into a personal project setup and actionable three-item workboard that preserve the normalized generation brief and output plan. |

## Safety and privacy boundaries

- Human subjects are fictional, non-identifying adults age 20+. An adult university student is age 20 or older.
- Human story text must explicitly attest `fictional`/`non-identifying` or `가상`/`비식별`; keyword and name-context checks supplement this boundary but are not identity recognition.
- Consensual, non-graphic sensual, erotic, seductive, and provocative styling is allowed only for those adults. Adult swimwear includes bikini, rash guard, monokini, one-piece swimsuit, and micro bikini; micro-bikini direction explicitly requires opaque, non-explicit coverage.
- Ethnicity and country are creator-selected casting/cultural direction. They are never inferred from a 2D reference and never assert a real person's identity or nationality.
- `school_inspired` remains non-sexual adult editorial fashion. Combining it with sensual or erotic direction is rejected as age-coded ambiguity.
- Animals and birds cannot receive human professions or wardrobe.
- Protected-work, real-person, minor/teen/age-ambiguous, explicit sexual activity, pornography, and coercive requests remain blocked before provider work.
- Batch records exclude source bytes, source filenames, disposable paths, and unrestricted provider diagnostics.

## Scope

Sprint 1 includes IMG-001 through IMG-008, IMG-010, and IMG-011 as a trusted-local vertical slice. IMG-009 U8 is an architecture/backlog contract only; its detailed boundary is [19-retouch-protocol-architecture.md](./19-retouch-protocol-architecture.md). Authentication, database persistence, billing, public sharing, actual video generation, automatic identity/shape replication, and pixel-level editing are excluded.

## Success measures

- All eleven IDs remain traceable across PDD, FSD, TDD, and WBS.
- One and three variant flows pass deterministic HTTP and browser checks.
- Contract tests prove partial failure and selection invariants without invoking a live provider.
- Live image quality remains a separate manual gate using rights-held, non-identifying fixtures.

## IMG-009 activation rule

U8 design completion does not activate retouch. U9–U12 require named owners, deadlines and evidence for the unresolved ARS-001 decisions, the V1 interview threshold, and separate Product Owner approval. No route, UI action, provider, artifact store, persistence adapter or export may be added before that gate.
# IMG-011 · 선택 결과의 개인 프로젝트 전환

- 완료 후보 하나를 서버에서 선택 확정한 뒤에만 다음 단계 CTA를 제공한다.
- 다음 단계에서는 프로젝트 이름, 사용 목적, 창작 의도를 구체화한다.
- 프로젝트 작업공간은 선택 이미지, 원래 장면·캐스팅·촬영·출력 설정과 목적별 3개 작업을 보여주며, 작업 상태·항목 메모·공통 메모·파생 진행률을 세션에 저장한다.
- trusted-local 세션 범위이며 로그인, 공유, 서버 재시작 복구, My Studio 목록은 이번 범위에 포함하지 않는다.
