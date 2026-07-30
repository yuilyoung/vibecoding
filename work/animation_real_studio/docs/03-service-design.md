# 서비스·UX·데이터 설계

## 설계 결정

| 결정 | 선택 | 이유 |
|---|---|---|
| 제품 형식 | 웹 스튜디오 + 비동기 제작 파이프라인 | 요청·승인·긴 생성 작업·보관함을 한 흐름으로 관리한다. |
| 제작 단위 | `Project` 안의 `Brief → Storyboard → Generation Version` | 원본 요청과 재생성 결과를 혼동하지 않는다. |
| 공개 기본값 | `private` | 창작물·개인 정보·권리 위험을 최소화한다. |
| 요청 입력 | 텍스트와 구조화 필드 + 비식별 참조 미디어 한 건 | 권리를 가진 배경·조명·구도·움직임 참조만 격리·정제·정책 통과 뒤 사용한다. |
| 공급자 결합 | `VideoProvider` 어댑터 | 영상 모델·약관·가격이 변해도 도메인과 보관함을 유지한다. |
| 생성 시작 | 스토리보드의 사용자 승인 뒤 | 무의미한 비용과 원치 않는 결과를 줄인다. |

## 화면 정보 구조

```text
Public: Home / How it works / Safety & rights / Pricing (later) / Sign in
Private: Dashboard / New request wizard / Project detail / Library / Account
Ops: Review queue / Job monitor / Reports & takedowns / Audit search
```

### 요청 위저드

1. **장면 의도** — 장면 설명, 인물 역할·관계, 감정, 결말
2. **권리와 안전** — 원작 관계, 금지 고지, 라이선스 주장 시 검토 대기
3. **연출 선택** — 시대·장소·조명·카메라·대사/내레이션·자막 언어
4. **기획안 확인** — 정책 판정, 오리지널화된 로그라인, 15초 컷 보드 승인 또는 수정

프로젝트 상세 화면은 상단에 상태와 다음 행동 하나만 강조한다. 아래에는 원 요청 요약, 정책 판정, 스토리보드, 각 생성 버전, 다운로드·공유·삭제 기록을 시간순으로 보인다.

## 서비스 아키텍처

```text
Browser
  │ authenticated API + signed upload/download intent
Web application / BFF ── Project API ── PostgreSQL
       │                    │               └─ audit events / metadata
       │                    ├─ Policy gateway ── rule/model/human review queue
       │                    └─ Job queue ── Generation worker ── VideoProvider adapter
       │                                             │
       │                                      Transcode/QC worker
       │                                             │
       └──────────── CDN + signed URL ── Object storage + delivery manifest
Operations console ─────────── review, takedown, retry, observability
```

### 경계와 책임

- **Web/BFF**: 입력 검증, 인증·권한, 사용자 화면에 필요한 조합만 한다. 공급자 비밀키를 브라우저에 노출하지 않는다.
- **Policy gateway**: 요청·기획안·결과의 사전/사후 판정과 사유 코드를 남긴다. 경계 사례는 `needs-review`로 이동한다.
- **Generation worker**: 승인된 불변 storyboard 버전만 읽고, 멱등 키로 공급자 작업을 만든다. 공급자 웹훅과 폴링을 모두 안전하게 처리한다.
- **Media worker**: 파일 형식·길이·해상도·코덱 검사, 썸네일/자막/manifest 생성, 악성 파일 검사, 결과 정책 재검토를 한다.
- **Object storage/CDN**: 원본·파생 파일을 분리하고, 사용자별 서명 URL만 발급한다. 공개는 공유 레코드가 있을 때만 별도 경로로 허용한다.

## 상태 머신

```text
draft → upload-quarantine → asset-scan → policy-check
policy-check → blocked-rights | rewrite | needs-review | reference-approved | storyboard-draft
reference-approved → storyboard-draft
needs-review → blocked-rights | rewrite | storyboard-draft
storyboard-draft → awaiting-approval → queued
queued → generating → media-qc → moderation → delivered
generating | media-qc | moderation → failed (재시도 가능)
delivered → expired | deletion-requested → deleted
```

상태 전이는 서버만 수행한다. `deleted`는 사용자 화면에서 즉시 숨기며, 법적 보존 필요 여부와 실제 객체 삭제 완료는 감사 로그의 별도 필드로 관리한다.

## 핵심 데이터 모델

| 엔터티 | 주요 필드 | 용도 |
|---|---|---|
| `users` | id, auth_subject, locale, consent_version | 계정과 동의 버전 |
| `projects` | id, owner_id, title, visibility, lifecycle_state | 사용자 작업공간 |
| `request_briefs` | id, project_id, scene_text, structured_fields, source_claim, submitted_at | 사용자의 원 요청 (버전 불변) |
| `reference_assets` | id, project_id, original_key, sanitized_key, purpose, lifecycle_state, expires_at | 격리·정제된 선택 참조와 삭제 기한 |
| `asset_scans` | id, asset_id, stage, outcome, reason_codes, scanner_version | MIME·메타데이터·안전 검사 판정 |
| `asset_consents` | id, asset_id, consent_version, attested_at, withdrawn_at | 권리·처리·보존 동의 이력 |
| `asset_uses` | id, asset_id, storyboard_id, provider_id, transmitted_at | 승인 참조의 생성 입력 사용 감사 |
| `policy_decisions` | id, subject_type/id, stage, outcome, reason_codes, reviewer_id | 사전·사후 정책 판정 |
| `storyboards` | id, project_id, brief_id, version, logline, beats, approved_at | 생성 전 승인 산출물 |
| `generation_jobs` | id, storyboard_id, idempotency_key, provider_id, provider_job_ref, status, retry_count | 비동기 공급자 작업 |
| `video_versions` | id, project_id, job_id, version, quality_status, manifest_key | 전달 가능한 결과 버전 |
| `media_assets` | id, video_version_id, kind, object_key, checksum, mime, duration, dimensions | 영상·자막·썸네일 파일 |
| `share_links` | id, video_version_id, token_hash, expires_at, revoked_at | 만료·철회 가능한 공개 링크 |
| `review_cases` | id, project_id, type, status, assigned_to, resolution | 권리·안전·신고 운영 |
| `audit_events` | id, actor, action, subject, occurred_at, metadata | 변경 불가능한 감사 추적 |

원문 프롬프트, 모델 식별자, 공급자 응답은 사용자 보관 데이터와 운영 감사 데이터를 구분해 접근 제어한다. 개인정보가 포함될 수 있는 자유 입력은 최소 기간만 보관하고, 분석용 데이터는 식별자를 제거한다.

## API와 작업 계약 (초안)

| 인터페이스 | 목적 |
|---|---|
| `POST /projects` / `PATCH /projects/:id/brief` | 초안 생성·수정 |
| `POST /projects/:id/reference-assets/upload-intent` / `POST /reference-assets/:id/complete` | 격리 업로드 intent·스캔 시작 |
| `POST /projects/:id/submit` | 정책 사전 검사 시작 |
| `POST /projects/:id/storyboards/:version/approve` | 승인된 불변 입력으로 큐잉 |
| `GET /projects/:id` | 상태·버전·다음 행동 조회 |
| `POST /video-versions/:id/share` / `DELETE .../share` | 만료 링크 생성·철회 |
| `POST /video-versions/:id/deletion-request` | 사용자 삭제 요청 |
| `POST /provider/webhooks/:providerId` | 서명 검증된 공급자 이벤트 수신 |

`VideoProvider`는 최소한 `submit(storyboard)`, `getStatus(jobRef)`, `cancel(jobRef)`, `fetchArtifacts(jobRef)`와 capability profile(세로 비율, 길이, 오디오, 자막, 지역, 상업권)을 제공해야 한다.

## 결과 보관과 표시

결과는 **영상 파일만** 저장하지 않는다. 각 버전에 `video.mp4`, `captions.vtt`, `captions.srt`, `thumbnail.webp`, `manifest.json`을 연결한다. `manifest`에는 체크섬, 규격, 생성 시각, 품질 판정, 정책 판정, 제공자/모델 식별자, 삭제·보존 상태를 넣는다.

보관함 카드에는 썸네일, 상태, 제목, 최신 버전, 만료일을 보이고, 상세 재생 화면에는 자막 토글·다운로드·공유·철회·삭제를 둔다. 갤러리 게시에는 별도의 `publish_to_gallery=true` 확인을 요구하며 기본값은 거짓이다.

## 출시 전 보안·운영 체크

- 인증된 소유자·운영자만 프로젝트와 파일에 접근하는지 E2E로 검증한다.
- 웹훅 서명·재전송·중복 이벤트·공급자 URL 만료를 테스트한다.
- 객체 저장소는 공개 목록을 금지하고, 다운로드·공유 모두 시간 제한 URL을 사용한다.
- 비밀키는 비밀 저장소에 두고 로그·브라우저·클라이언트 번들에서 마스킹한다.
- 생성 비용 상한, 사용자별 쿼터, 대기열 포화, 공급자 장애, 삭제 SLA, 신고 처리 책임자를 운영 대시보드에서 관측한다.
