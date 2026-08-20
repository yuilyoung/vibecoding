# Image generation progress — 2026-08-12

## Current state

- Runtime: local UI `/real` plus loopback Studio API.
- Existing baseline before this sprint: ARS readiness checker 2/2, API 42/42, TypeScript/Vite build pass.
- Product discovery: `ARS-001` remains `pending_external_evidence` with four external decisions and 0/5 interviews recorded.
- Sprint 1 implementation: IMG-001 through IMG-008 and IMG-010 implemented behind `image-batch.v1`; IMG-011 selected-image project continuation now uses `image-project.v2` with save-time revision validation, a purpose-specific three-item workboard, progress/next-action derivation, notes, and metadata-only session storage; IMG-009 retouch remains a planned, gated Sprint 2.

## Delivered units

- PDD, FSD, TDD, WBS and eleven-ID trace matrix.
- Project-local `image-studio-sprint-delivery` skill and deterministic trace validator.
- Business domain validation, bounded three-variant orchestration, partial-result aggregation, and idempotent selection.
- Data adapters for the existing Studio image project service and browser HTTP.
- Presentation ViewModel for form state, submission, polling, partial failure, and selection.
- View controls for subject, era/weather/environment, camera angle, lighting/mood, perspective, adult-20+ wardrobe/profession including lingerie, count, result cards, and planned-retouch disclosure.
- 2026-08-20 project workboard: the third-stage personal project page now persists three fixed purpose-specific work items, todo/in-progress/done state, per-item notes, a shared project note, derived progress and the next action. Valid `image-project.v1` metadata opens as v2 in memory and is written as v2 only after the next successful save.
- Every project-details and workboard save revalidates the latest selected variant and selection revision. Purpose changes require explicit confirmation before purpose-specific work state resets; the shared project note is preserved.
- 2026-08-13 UI consolidation: `/real` now has one H1, one form, and one submit path. Text/2D reference, preservation focus, age/presentation/count/framing, all structured image settings, PNG/GIF, 1–3 candidates, partial results, and selection share one ViewModel and `image-batch.v1` request.
- 2026-08-13 default automation: one deeply frozen Business profile supplies every form default and subject-dependent automatic value; each ViewModel receives fresh nested copies and preserves unrelated scene, story, and output settings across subject changes.
- 2026-08-13 human casting expansion: the unified form adds independent ethnicity and country/cultural-context controls with Korean-first `east_asian`/`south_korea` defaults, plus fictional K-Pop idol, fashion-model, and announcer archetypes. It never infers identity, ethnicity, or nationality from uploaded media.
- Adult swimwear now includes bikini, rash guard, monokini, one-piece swimsuit, and micro bikini. Micro-bikini mapping explicitly requires opaque, non-explicit coverage; all variants remain fictional-adult-20+ only.
- English/Korean consensual non-graphic adult sensual direction is accepted for explicitly fictional adults age 20+. Minor/teen/age-ambiguous, real-person, explicit/pornographic/coercive, erotic school-coded, subject/age-mismatch, and no-person/person-story-conflict directions are rejected before provider calls.
- Fake-repository ViewModel tests cover submission, independent casting/archetype selection, subject automation, polling, partial failure, selection, abort-on-dispose, 400/401 story bounds, and erotic school-fashion conflicts. Exhaustive server tests cover every supported ethnicity × country × profession × wardrobe × variant mapping at the 400-character story boundary (maximum observed length 678/700).

## Verification contract

Run after the latest edit:

```powershell
npm run test:image-delivery
npm run test:ars-001
npm run test:api
npm run build
npm run test:e2e
```

Live visual quality remains a manual check with a rights-held, non-identifying fixture. Deterministic tests prove contracts and state behavior, not aesthetic quality.

## Latest deterministic evidence

- `npm run test:image-delivery`: trace 11/11, required evidence files 11/11, Business/Data plus ViewModel 18/18, including IMG-011 v2 schema and progress rules, v1 read migration, purpose-reset confirmation, selection matching, metadata-only project storage, Korean-first casting defaults, subject automation, polling recovery, and replacement-read isolation.
- `npm run test:ars-001`: 2/2; `npm run check:ars-001` still reports `ready:false` for the external-evidence gate.
- `npm run test:api`: 59/59, including the missing-output retry contract, casting/country legacy defaults, unsupported and human/nonhuman combination rejection, all adult swimwear options, exhaustive 700-character mapping bounds, bilingual adult/minor/explicit policy, and zero-provider safety checks.
- `npm run build`: TypeScript and Vite production build passed.
- `npm run test:e2e`: 28/28 across project creation, actionable work save/reload, v1→v2 recovery, purpose-reset confirmation, metadata and work-save selection races, save-time edit locking and unmount cancellation, all 20 normalized project settings, direct-entry error, 390px project reflow, Korean-first defaults, archetypes/swimwear, human↔nonhuman switching, 2D/GIF DTO, progress recovery, safety conflicts, partial selection, direction, and local-probe flows.
# 2026-08-13 · IMG-011 진행 증거

- 구현: 생성된 1~3개 후보 중 완료 이미지 선택 → 개인 프로젝트 구체화 → 목적별 작업공간.
- 데이터: selection revision을 기준으로 하며 sessionStorage에는 이미지 바이트 없이 프로젝트 메타데이터만 저장.
- 집중 검증: 이미지 프로젝트 Business/Data 및 기존 ViewModel 15/15, TypeScript/Vite build, 신규 Playwright 4/4.
- 전체 회귀: API 56/56, Playwright 25/25. 최초 독립 리뷰의 save-time revision 경쟁 조건, 전체 설정 인계, 문서 추적성 지적을 구현과 테스트로 보완했다.

# 2026-08-20 · IMG-011 작업 보드 증거

- 구현: 읽기 전용 다음 절차를 목적별 3개 작업, 상태, 항목·공통 메모, 파생 진행률과 다음 행동을 가진 실제 세션 작업 보드로 확장.
- 데이터: 전체 스키마를 검증하는 `image-project.v2`; 유효한 v1은 읽기만으로 저장소를 바꾸지 않고 메모리 전환 후 다음 성공 저장부터 v2로 기록.
- 안전 경계: 메타데이터·작업 저장 모두 최신 selection revision을 재확인하며 이미지 바이트, 리터치, 다운로드, 공유, 서버 영속화는 포함하지 않음.
- 검증: Business/Data 및 기존 ViewModel 18/18, API 59/59, Playwright 28/28, TypeScript/Vite build.
