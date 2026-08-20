# IMG-009 — 가역 리터치 프로토콜 아키텍처

Status: U8 architecture complete; U9–U12 implementation gated, 2026-08-20.

## 목적과 현재 경계

IMG-009는 선택이 확정된 이미지에 AI 보조 또는 수동 리터치를 적용하더라도 원본을 덮어쓰지 않고, 동의·마스크·편집 revision·안전 판정·provenance·내보내기 고지를 하나의 검증 가능한 계보로 묶는 미래 계약이다. 이 문서는 `retouch-protocol.v1`의 개념 스키마, 계층 인터페이스, 상태 전이, 실패 처리와 활성화 조건만 확정한다.

이번 U8에는 라우트, 화면, 공급자 호출, 마스크 파일, 데이터베이스, 객체 저장소, 픽셀 편집, 다운로드와 내보내기를 구현하지 않는다. 현재 `/real`, `/image-projects/{batchId}`, `image-batch.v1`, `image-project.v2` 동작도 변경하지 않는다. 따라서 “설계 완료”는 리터치 기능 사용 가능, 정책 승인 또는 출시 승인을 뜻하지 않는다.

`tasks/ars-001-decision-log.json`의 D-001–D-004는 owner, deadline과 증거가 없는 외부 결정으로 남아 있다. 특히 공급자 데이터 사용·보존·지역, 비용, 언어·접근성, 라이선스 검증과 법적 책임을 이 문서가 기본값으로 정하지 않는다. 해당 값은 승인된 정책 포트를 통해서만 주입하며, 값이나 증거가 없으면 실패 폐쇄한다.

## 불변 식별자와 선택 결합

모든 리터치 aggregate는 다음 `SelectionBinding`을 공유한다.

| 필드 | 계약 |
| --- | --- |
| `batchId` | 원본 `image-batch.v1` 배치 ID |
| `variantId` | 같은 배치에서 완료되고 delivery가 있는 후보 ID |
| `selectionRevision` | 세션 생성 시점의 1 이상 선택 revision |
| `sourceDigest` | 선택된 원본 raster bytes의 SHA-256 digest |
| `sourceWidth`, `sourceHeight` | orientation 적용 후 원본 픽셀 크기, 양의 정수 |
| `sourceMediaType` | 미래 정책이 허용한 raster MIME; 클라이언트 자유 입력이 아님 |

- 세션 생성, revision 제출, 재실행과 내보내기 직전에 서버가 최신 선택을 다시 읽어 `batchId`, `variantId`, `selectionRevision`을 모두 비교한다.
- `sourceDigest`와 크기가 다르면 selection이 같더라도 다른 원본으로 취급한다. 암묵적 재샘플링이나 좌표 변환으로 통과시키지 않는다.
- 원본과 성공한 revision artifact는 불변이다. 새 편집은 기존 결과를 덮어쓰지 않고 부모를 가리키는 새 revision을 만든다.

## `retouch-protocol.v1` 개념 스키마

이 절은 미래 persistence와 통신 DTO가 공유할 Business 계약이다. 아직 직렬화 코드나 저장 테이블은 없다. 각 레코드의 `protocolVersion`은 `retouch-protocol.v1`이며 ID는 서버가 생성한다. 시각은 canonical UTC ISO 형식이다.

### 핵심 레코드

| 레코드 | 필수 필드 | 불변 조건 |
| --- | --- | --- |
| `RetouchSession` | `id`, `SelectionBinding`, `activeConsentId`, `headRevisionId?`, `state`, `createdAt`, `updatedAt` | 한 selection binding에 대한 작업 경계; 원본 bytes를 내장하지 않음 |
| `ConsentRecord` | `id`, `sessionId`, `policyVersion`, `scopes`, `rightsEvidenceRef`, `attestedAt`, `withdrawnAt?` | 정책이 발급한 범위와 증거 참조만 저장; 철회 이력은 삭제·수정하지 않음 |
| `RetouchMask` | `id`, `sessionId`, `maskRevision`, `sourceDigest`, `canvasWidth`, `canvasHeight`, `coordinateSpace`, `representation`, `artifactRef`, `artifactDigest`, `createdAt` | 원본 digest와 크기에 정확히 결합; mask revision은 단조 증가 |
| `EditRevision` | `id`, `sessionId`, `ordinal`, `parentRevisionId?`, `mode`, `operationCode`, `maskId`, `parameterSet`, `state`, `idempotencyKey`, `resultArtifactRef?`, `resultDigest?`, `createdAt`, `completedAt?` | 부모와 ordinal은 생성 후 불변; 성공 결과는 덮어쓰지 않음 |
| `SafetyDecision` | `id`, `sessionId`, `revisionId?`, `stage`, `outcome`, `reasonCodes`, `policyVersion`, `evidenceRefs`, `decidedAt` | `allow`, `block`, `review_required` 중 하나; 결정 부재를 allow로 간주하지 않음 |
| `ProvenanceEvent` | `id`, `sessionId`, `sequence`, `eventType`, `subjectType`, `subjectId`, `actorType`, `inputDigests`, `outputDigests`, `policyRefs`, `previousEventDigest?`, `eventDigest`, `occurredAt` | append-only, 세션 내 sequence 유일·단조 증가; 첫 event만 previous digest가 없음 |
| `ExportDisclosure` | `id`, `sessionId`, `revisionId`, `disclosureVersion`, `requiredNotices`, `provenanceSummaryRef`, `safetyDecisionId`, `acknowledgedAt?`, `exportedAt?` | 정확한 성공 revision에 결합; 필수 고지 누락 시 내보내기 금지 |
| `ArtifactDeletionIntent` | `id`, `sessionId`, `artifactRef`, `artifactDigest`, `reasonCode`, `policyDecisionRef`, `state`, `idempotencyKey`, `notBefore?`, `leaseOwner?`, `leaseExpiresAt?`, `attemptCount`, `lastSafeError?`, `createdAt`, `updatedAt`, `completedAt?` | `pending`, `leased`, `retryable_failure`, `legal_hold`, `completed` 상태; lease 필드는 leased일 때만 함께 존재; 완료 전 삭제됐다고 표시하지 않음 |

`rightsEvidenceRef`, `artifactRef`, `evidenceRefs`와 `provenanceSummaryRef`는 권한이 제한된 미래 저장소의 opaque reference다. 파일 경로, 서명 URL, provider raw response나 개인 데이터를 일반 DTO에 노출하지 않는다.

`RetouchSession`은 `SelectionBinding`을 직접 소유하고 모든 하위 레코드는 같은 session FK로 결합한다. 하위 레코드에 binding 값을 중복 저장해 서로 다른 값이 생기게 하지 않으며, 조회 DTO가 binding을 펼쳐 보여 주더라도 서버는 session의 불변 값을 기준으로 재구성한다.

### 마스크 좌표와 표현

- `coordinateSpace`는 v1에서 `source_pixel_top_left_v1`만 허용한다. 원점은 orientation 적용 후 원본의 좌상단 `(0, 0)`이고, x는 오른쪽, y는 아래쪽으로 증가한다.
- 유효 영역은 `0 <= x < sourceWidth`, `0 <= y < sourceHeight`다. 경계 밖 좌표, NaN/Infinity, 빈 선택 영역은 거부한다.
- `raster_alpha8`는 원본과 정확히 같은 width/height의 8-bit 단일 채널 mask artifact다. 0은 보호, 255는 최대 편집이며 중간값은 강도다.
- `vector_path_v1`은 같은 pixel 좌표의 bounded `M/L/Q/C/Z` path 집합이다. 렌더링 규칙, fill rule과 anti-aliasing version을 metadata에 고정하고 rasterization 결과 digest를 함께 기록해야 실행할 수 있다.
- mask DTO는 bytes나 path 본문을 포함하지 않는다. 검증된 artifact reference와 digest만 가진다. 저장소는 업로드 완료 전에 mask 레코드를 활성화하지 않는다.
- mask의 `sourceDigest`, canvas 크기 또는 rasterization version이 revision 원본과 다르면 `retouch_mask_source_mismatch`로 실패한다.

### 편집과 계보 규칙

- `mode`는 `manual` 또는 `ai_assisted`다. `operationCode`와 `parameterSet`은 버전된 Business allow-list로 제한한다. 자유 provider prompt는 v1 계약에 포함하지 않는다.
- 첫 revision의 `parentRevisionId`는 null이고 입력 digest는 원본 `sourceDigest`다. 후속 revision은 같은 세션의 성공 revision 하나만 부모로 지정한다.
- 분기는 허용하지만 각 revision의 부모는 하나다. UI의 head 변경은 별도 명령이며 과거 revision을 수정하지 않는다.
- AI 공급자와 로컬 수동 렌더러 모두 동일한 revision/provenance 계약을 사용한다. 공급자 job ID와 raw 진단은 Data 내부 또는 제한된 운영 증거로만 둔다.
- 동일한 `sessionId + idempotencyKey`는 동일한 정규화 명령에 한해 같은 revision을 반환한다. payload digest가 다르면 `retouch_idempotency_conflict`다.
- 동의 철회 후에는 새 revision, 재실행과 내보내기를 금지한다. 기존 artifact의 숨김·삭제·법적 보존은 미결정 `RetentionPolicyPort` 결과 없이는 자동 결정하지 않고 `retouch_retention_policy_unavailable`로 실패 폐쇄한다.

## 미래 persistence 스키마와 transaction

실제 DB 선택 전에도 다음 논리 테이블과 제약을 유지한다. binary artifact는 테이블에 직접 넣지 않고 소유권이 검증된 비공개 artifact store에 둔다.

| 논리 테이블 | 키와 필수 제약 |
| --- | --- |
| `retouch_sessions` | PK `id`; unique `(batch_id, variant_id, selection_revision, source_digest)`; active consent FK |
| `retouch_consents` | PK `id`; FK `session_id`; `withdrawn_at >= attested_at`; 정책/증거 참조 필수 |
| `retouch_masks` | PK `id`; FK `session_id`; unique `(session_id, mask_revision)` and `(session_id, artifact_digest)`; positive dimensions |
| `retouch_revisions` | PK `id`; FK session/parent/mask; unique `(session_id, ordinal)` and `(session_id, idempotency_key)`; parent는 같은 session |
| `retouch_safety_decisions` | PK `id`; FK session/revision; stage/outcome/policy version 필수 |
| `retouch_provenance_events` | PK `id`; unique `(session_id, sequence)`; update/delete 금지 |
| `retouch_export_disclosures` | PK `id`; unique `(revision_id, disclosure_version)`; 성공 revision과 allow 결정 FK |
| `retouch_artifact_deletion_intents` | PK `id`; FK `session_id`; unique `idempotency_key`; artifact digest/ref, policy decision, state와 attempt count 필수; lease owner/expiry는 leased일 때, safe error는 retryable failure일 때, completed 시각은 completed일 때 필수 |

`RetouchUnitOfWork`가 aggregate mutation과 그 mutation의 `ProvenanceEvent`, 필요한 `ArtifactDeletionIntent` 생성 및 기존 intent의 lease/완료/실패/legal-hold 전이를 같은 DB transaction에 기록하는 유일한 write 경계다. `ProvenanceLedger`는 이 테이블을 읽고 연속성과 digest chain을 검증하는 read port이며 별도 append API를 제공하지 않는다. 따라서 revision이나 삭제 완료만 커밋되고 provenance가 빠지는 성공 상태는 존재하지 않는다.

세션 생성은 selection 재검증 후 consent 기록, session과 첫 provenance event를 한 Unit of Work transaction으로 묶는다. revision 제출은 head/parent, consent, mask, pre-safety와 idempotency를 검증한 뒤 revision과 provenance event를 함께 기록한다. 결과 완료는 artifact digest 검증, post-safety, revision terminal state, provenance event와 늦거나 거부된 artifact의 삭제 intent를 원자적으로 기록한다. 내보내기는 최신 selection, 유효 consent, 성공 revision, post-safety allow, 연속된 provenance와 고지 준비를 같은 transaction snapshot에서 확인한다.

artifact 저장과 DB transaction은 하나의 원자 작업이 될 수 없으므로 artifact는 `pending -> verified -> attached` 수명을 사용한다. attach가 실패하거나 결과가 거부되면 Unit of Work가 durable 삭제 intent를 기록한다. 삭제 worker는 Unit of Work를 통해 `pending/retryable_failure -> leased -> completed | retryable_failure | legal_hold`로 compare-and-set 전이하고, lease expiry 후에만 재획득한다. worker가 artifact store의 idempotent delete를 먼저 호출하고, 그 확인 결과를 intent `completed` 상태와 완료 provenance로 같은 Unit of Work transaction에 기록한다. 실제 삭제 후 process가 종료돼 DB 완료가 남지 않아도 같은 delete key로 안전하게 재호출한다. 최대 보존 시간, lease/retry 한도와 법적 hold 우선순위는 `RetentionPolicyPort`가 승인된 뒤에만 설정하며, 미정이면 실행하지 않고 intent를 보존한다.

## 계층과 인터페이스

~~~mermaid
flowchart LR
  V[Presentation: future RetouchWorkspace] --> UC[Business: RetouchSessionUseCase]
  V --> EX[Business: RetouchExportUseCase]
  UC --> RP[Business port: RetouchProjectRepository]
  UC --> UW[Business port: RetouchUnitOfWork]
  UC --> CP[Business port: ConsentPolicyPort]
  UC --> SP[Business port: SafetyDecisionPort]
  UC --> PP[Business port: RetouchProviderPort]
  UC --> MP[Business port: MaskArtifactStore]
  UC --> RT[Business port: RetentionPolicyPort]
  EX --> DP[Business port: ExportDisclosurePolicy]
  EX --> PL[Business port: ProvenanceLedger read]
  RW[Business: ArtifactRetentionWorker] --> UW
  RW --> RT
  RW --> MP
  DB[Data: future DB repository] -.implements.-> RP
  DB -.implements.-> UW
  DB -.implements.-> PL
  AS[Data: future private artifact adapter] -.implements.-> MP
  PA[Data: future provider adapter] -.implements.-> PP
~~~

의존성은 `Presentation -> Business interfaces <- Data implementations`다. Presentation은 mask gesture와 명령 의도만 전달하며 정책, revision 생성, 재시도 또는 DTO 직렬화를 소유하지 않는다.

모든 비동기 포트 호출은 `protocolVersion`, `AbortSignal`과 상위 use case가 나눠 준 deadline budget을 받는다. 지원하지 않는 major version은 호출 전에 `retouch_protocol_unsupported`로 거부한다. read/decision 함수는 side-effect free하고 같은 정규화 입력에 결정적이어야 한다. append/put/transition/delete-intent 같은 mutation은 idempotency key를 요구한다. 취소나 timeout은 성공으로 변환하지 않으며, side effect가 시작됐을 수 있으면 같은 key로 상태를 조회·재조정한다. 각 Data 구현은 아래 fake와 동일한 contract suite를 통과해야 한다.

| 인터페이스 | 책임 / 입력 → 출력 | 실패·취소·멱등성 | 소유권과 test double |
| --- | --- | --- | --- |
| `RetouchSessionUseCase` | selection binding과 consent evidence → session; mask/edit command → revision snapshot | stable domain errors; 모든 비동기 명령은 `AbortSignal`; deadline은 호출자가 주입; create/submit은 idempotency key 필수 | Business application scope; fake ports로 상태·경쟁 조건 검증 |
| `RetouchExportUseCase` | revision과 대상 형식 → disclosure + export authorization | selection/consent/safety/retention 미확정 시 fail-closed; export key 멱등 | Business; fake disclosure/retention 정책 |
| `RetouchProjectRepository` | aggregate와 immutable snapshot 조회 | not-found/corrupt snapshot; read 취소·timeout; side-effect 없음 | Data가 구현, Business aggregate만 반환; in-memory query double |
| `RetouchUnitOfWork` | aggregate mutation + provenance + optional deletion-intent 생성, 또는 expected intent state + lease/terminal transition + provenance → committed snapshot | optimistic/lease conflict, constraint/transaction abort; mutation·intent key 멱등; 부분 성공 금지 | 유일한 DB write port; Data adapter가 transaction 소유; rollback/atomicity/fake-clock contract double |
| `ConsentPolicyPort` | 정책 version과 evidence reference → scope-bound consent decision | timeout/cancel; 미응답·미정책은 unavailable; allow 기본값 없음 | 승인된 Trust & Safety adapter; deterministic deny/allow/review fake |
| `SafetyDecisionPort` | stage, normalized inputs, digest refs → decision | bounded timeout; provider raw error를 safe code로 변환; 같은 evaluation key 멱등 | pre/post 정책 adapter; fixture-based fake |
| `RetouchProviderPort` | immutable parent/mask/operation refs → operation result refs | `AbortSignal`, hard deadline, capability mismatch; retry policy를 adapter가 임의 결정하지 않음 | Data adapter가 task 수명 job 소유; fake renderer/provider |
| `MaskArtifactStore` | verified raster/vector artifact put/get; deletion intent ID와 artifact ref/digest로 실제 delete | digest·dimension mismatch; 취소; put/delete key 멱등 | private storage adapter; byte-free metadata fake |
| `ProvenanceLedger` | ordered event/digest chain 읽기와 `isCompleteThrough(sequence)` 확인 | gap/digest mismatch; write API 없음; read side-effect 없음 | 같은 DB의 append-only table을 읽는 Data adapter; ordered in-memory fake |
| `RetentionPolicyPort` | subject kind, consent state, policy refs → retain/delete/hold instruction | 정책/owner/evidence 부재는 unavailable; 임의 기간 금지 | Product/Privacy 승인 adapter; unavailable fake가 기본 테스트 |
| `ExportDisclosurePolicy` | revision provenance + safety + destination → required notices | 누락/미지원 destination 차단; disclosure version 멱등 | Business policy adapter; notice fixture fake |

포트 DTO는 `retouch-protocol.v1`의 정규화된 ID, digest, enum, bounded metadata만 사용한다. `File`, DOM event, React state, HTTP response, DB row, provider SDK type과 로컬 경로는 Business 경계를 통과하지 않는다.

## 상태와 실행 시퀀스

~~~mermaid
stateDiagram-v2
  [*] --> consent_pending
  consent_pending --> ready: consent allow + selection/source verified
  consent_pending --> blocked: deny/review/unavailable
  ready --> validating: submit immutable edit command
  validating --> queued: mask + pre-safety valid
  validating --> blocked: validation/policy failure
  queued --> running: worker owns operation
  queued --> cancelled: cancel accepted before start
  running --> succeeded: artifact verified + post-safety allow
  running --> failed: provider/renderer/artifact failure
  running --> cancelled: cancellation confirmed
  running --> blocked: post-safety block/review
  succeeded --> validating: create child revision
  ready --> consent_withdrawn: consent withdrawn
  succeeded --> consent_withdrawn: consent withdrawn
  consent_withdrawn --> [*]
~~~

~~~mermaid
sequenceDiagram
  actor U as Creator
  participant V as Presentation
  participant UC as RetouchSessionUseCase
  participant B as image-batch.v1 repository
  participant C as Consent/Safety policies
  participant R as RetouchProjectRepository
  participant W as RetouchUnitOfWork
  participant M as MaskArtifactStore
  participant P as RetouchProviderPort
  U->>V: submit bounded edit
  V->>UC: submit(command, idempotencyKey, signal)
  UC->>B: get latest selected batch
  B-->>UC: selection + source identity
  UC->>R: load session + parent + consent
  UC->>M: verify mask digest/dimensions
  UC->>C: pre-edit decision
  alt stale, withdrawn, mismatch, deny/review/unavailable
    UC-->>V: stable blocked/error result, no provider call
  else valid
    UC->>W: atomically commit queued revision + submitted provenance
    UC->>P: execute immutable refs, signal, deadline
    P-->>UC: result artifact ref + digest
    UC->>C: post-edit decision
    UC->>W: atomically commit terminal revision + provenance + optional deletion intent
    UC-->>V: immutable revision snapshot
  end
~~~

Presentation/ViewModel은 페이지 수명 `AbortController`와 한 번에 하나인 사용자 명령 잠금을 소유한다. Business는 상태 전이와 deadline budget을 소유한다. Data worker는 provider task와 artifact stream만 소유하며 UI thread를 점유하지 않는다. 취소 요청은 성공으로 꾸미지 않고 provider 확인 전까지 `cancellation_requested` 운영 상태로 추적하되, 공개 revision terminal state는 확인된 `cancelled`, `failed`, `blocked`, `succeeded`만 사용한다.

## 안정 오류 계약

| 코드 | 의미 / 부작용 |
| --- | --- |
| `retouch_selection_stale` | 선택 variant/revision 변경; 저장·공급자 호출 없음 |
| `retouch_source_mismatch` | 원본 digest/크기 불일치; 세션 진행 없음 |
| `retouch_consent_required` / `retouch_consent_withdrawn` | 유효 scope 없음; 새 처리·내보내기 없음 |
| `retouch_policy_unavailable` | consent/safety 정책 미확정 또는 timeout; fail-closed |
| `retouch_mask_invalid` / `retouch_mask_source_mismatch` | 형식·좌표·digest·크기 오류; 실행 없음 |
| `retouch_revision_conflict` | stale parent/head/aggregate version; 자동 덮어쓰기 없음 |
| `retouch_idempotency_conflict` | 같은 key에 다른 command digest; 새 revision 없음 |
| `retouch_provider_unavailable` / `retouch_timeout` | 실행 실패; 성공 artifact나 export 권한 없음 |
| `retouch_result_invalid` | 결과 digest/크기/MIME 검증 실패; artifact attach 없음 |
| `retouch_safety_blocked` / `retouch_review_required` | terminal block 또는 별도 검토 필요; export 없음 |
| `retouch_disclosure_required` | 필수 고지/승인 누락; export artifact 생성 없음 |
| `retouch_retention_policy_unavailable` | 보존·삭제 지시 미확정; 자동 삭제 완료 주장 없음 |

클라이언트에는 code와 bounded message만 반환한다. 원본 prompt, provider payload, 경로, 개인 데이터, 법률 검토 내용과 raw stack은 노출하지 않는다.

## 위협과 실패 분석

| 위협/실패 | 예방 | 탐지와 복구 |
| --- | --- | --- |
| 권리 주장과 선택 asset 불일치 | consent를 selection binding과 evidence ref에 결합 | 최신 binding 재검증; block/review event 기록 |
| 저장 중 selection 변경 | 모든 mutation/export 직전 서버 재조회 | `retouch_selection_stale`; 사용자가 새 세션을 명시적으로 시작 |
| mask와 원본 불일치 | digest, dimensions, coordinate version 필수 | provider 전 차단; mask 재작성 |
| 중복 클릭/네트워크 재전송 | command digest + idempotency unique key | 동일 명령은 기존 revision, 다른 명령은 conflict |
| 취소와 완료 경쟁 | worker ownership과 Unit of Work compare-and-set terminal transition | 먼저 확정된 terminal만 채택; 늦은 artifact는 같은 transaction의 durable 삭제 intent로 격리 |
| 손상된 revision/artifact | parent FK, ordinal, checksum, MIME/dimension 검증 | head 승격 금지; failure provenance와 보상 삭제 intent |
| 필수 고지 없는 내보내기 | export use case가 disclosure를 선행 조건으로 확인 | export 생성 전 차단; 누락 event 기록 |
| consent 철회 후 재처리 | 철회 시각과 scope를 매 명령에 확인 | 새 작업 차단; 보존/삭제는 승인된 정책 지시로만 실행 |
| 보존 worker 실패 | versioned intent, lease, idempotent delete와 원자적 completion event | lease 만료 후 재획득; alert/retry/SLA는 정책 주입 후 설정; 완료 전 deleted 표시 금지 |
| provenance 변조/유실 | Unit of Work가 mutation과 append-only event를 한 transaction에 기록 | sequence/digest gap 시 조회·export 차단과 운영 검토 |
| AI provider가 mask 밖을 변경 | 결과-원본 차이 검증과 post-safety/QC 포트 | 허용 범위 초과 시 block/review; 원본·부모는 유지 |

## 활성화, migration과 rollback

1. **U8 (현재):** 문서와 trace만 추가한다. 런타임 flag, route, UI, provider와 persistence는 0개다.
2. **구현 승인 전 조건:** ARS-001 D-001–D-004에 책임 owner, deadline, 필요한 권리·보존·공급자 증거가 기록되고 V1 인터뷰 gate가 충족돼야 한다. 별도 Product Owner 승인을 다시 받아야 한다.
3. **U9 mask prototype:** 승인 후에만 rights-held/non-identifying fixture, fake repository와 local deterministic renderer로 시작한다. 외부 AI provider와 export는 계속 꺼 둔다.
4. **U10 revision persistence:** schema migration dry-run, unique/FK/append-only contract tests, backup/restore와 artifact reconciliation 증거 후 opt-in trusted-local flag로 활성화한다.
5. **U11 safety/provenance:** pre/post policy와 immutable ledger의 독립 fixture gate가 통과해야 AI-assisted adapter를 연결할 수 있다.
6. **U12 export disclosure:** retention/deletion과 disclosure 정책 증거, private delivery와 audit 검증 전에는 export를 구현하거나 노출하지 않는다.

DB migration은 additive nullable/새 테이블 → backfill/검증 → constraint 강화 순서다. protocol reader는 배포 전 버전과 현재 버전만 읽고 writer는 활성 버전 하나만 쓴다. rollback은 새 명령 수락 중지 → in-flight drain/cancel → 이전 reader 복구 순서이며, 생성된 revision과 provenance를 삭제하거나 과거 원본을 덮어쓰지 않는다. artifact 정리는 승인된 retention 지시와 reconciliation 결과를 따른다.

## U8 수용 기준과 다음 구현 테스트

- [x] consent, raster/vector mask, edit revision, provenance, safety decision, export disclosure의 versioned schema가 정의됐다.
- [x] session은 batch/variant/selection revision과 source digest/dimensions를 직접 소유하고 모든 하위 레코드는 불변 session FK로 결합된다.
- [x] 좌표계, 부모 revision, immutable provenance, consent withdrawal과 disclosure 차단 조건이 정의됐다.
- [x] 세 계층 의존성, 포트 책임, 입출력, 오류, 취소, timeout, 멱등성, 수명과 test double이 명시됐다.
- [x] persistence 제약, 단일 Unit of Work 원자성, durable 삭제 intent/lease, artifact 보상, migration과 rollback이 schema-first로 정의됐다.
- [x] 상태/sequence UML과 권리·경쟁·손상·보존 위협 분석이 포함됐다.
- [x] 미정인 권리·보존·공급자 값은 주입 계약으로만 남고 구현과 출시는 계속 차단된다.

향후 구현 테스트는 (1) stale selection/source/mask 거부, (2) consent 철회 경쟁, (3) idempotent duplicate와 payload conflict, (4) parent/head optimistic conflict, (5) 취소/완료 경쟁, (6) revision+provenance+삭제 intent transaction rollback, (7) corrupt artifact와 post-safety block, (8) provenance sequence/digest gap, (9) disclosure 없는 export 차단, (10) unavailable retention policy fail-closed, (11) deletion lease expiry/idempotent completion, (12) migration/rollback/reconciliation을 최소 계약으로 삼는다.

## 거절한 대안

- `image-project.v2`에 mask bytes나 편집 history를 덧붙이지 않는다. 세션 metadata 저장소에는 용량, 소유권, 삭제와 transaction 보장이 없다.
- 원본 파일을 제자리 수정하지 않는다. 비교, rollback, 안전 검토와 provenance를 잃는다.
- UI가 provider prompt, retry 또는 안전 결과를 직접 결정하지 않는다. 계층 경계와 일관된 정책 집행이 깨진다.
- 동의 checkbox 하나를 영구 권리 승인으로 간주하지 않는다. scope, policy version, evidence와 철회 이력이 필요하다.
- 미결정 보존 기간을 임의 숫자로 고정하거나 브라우저 삭제를 완료 증거로 사용하지 않는다.
