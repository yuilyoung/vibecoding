# FSD — Image batch generation and selection

Protocol version: `image-batch.v1`.

## Functional contract

| ID | Behavior |
| --- | --- |
| IMG-001 | `brief.subjectKind` accepts `human`, `animal`, or `bird`; `subjectDetail` is allow-listed. Human `ethnicity` and `country` are independent allow-listed casting/cultural directions and are never inferred from media. |
| IMG-002 | `brief` carries era, weather, environment, camera angle, framing, lighting, mood, perspective, age, presentation, and people-count enums. `sourceInput` and `outputPlan` add optional owned 2D input and still/GIF output without a second form. |
| IMG-003 | `profession`, `wardrobe`, subject/age, and direction intent are cross-validated against the fictional-adult-20+ rules. Fictional K-Pop idol, fashion model, and announcer archetypes do not identify real people. Adult swimwear adds rash guard, monokini, one-piece, and opaque non-explicit micro bikini. `fictional_adult` requires an adult age option; `no_person` requires `not_applicable` and person-free story text. |
| IMG-004 | `variantCount` is an integer from 1 through 3; each variant receives a unique prompt treatment and operation ID. |
| IMG-005 | Batch state is derived from variant states and supports `queued`, `in_progress`, `completed`, `partial`, and `failed`. |
| IMG-006 | Selection accepts a completed variant ID from the same batch and returns a monotonically revisioned selection. |
| IMG-007 | Presentation calls an `ImageBatchRepository`; Business owns validation/state; Data owns HTTP and Studio-provider mapping. |
| IMG-008 | Errors use stable codes; deterministic tests cover validation, concurrency, partial failure, mapping, and keyboard-visible selection. |
| IMG-009 | Retouch endpoints are absent in v1; the UI labels retouch as a later gated sprint. |
| IMG-010 | `DEFAULT_IMAGE_BATCH_SETTINGS` is the immutable source for brief, mode, reference focus, output defaults, variant count, and acknowledgement. Subject changes use one Business mapping and preserve unrelated scene/story/output values. |
| IMG-011 | A server-confirmed completed selection opens `/image-projects/{batchId}`; save re-fetches the batch and rejects a changed variant or revision before storing metadata-only `image-project.v1`. |

## HTTP JSON protocol

### Create

`POST /api/image-batches`

```json
{
  "protocolVersion": "image-batch.v1",
  "variantCount": 3,
  "clientRequestId": "batch-request-uuid",
  "rightsAccepted": true,
  "brief": {
    "subjectKind": "human",
    "subjectDetail": "fictional_adult",
    "age": "adult_30s",
    "presentation": "unspecified",
    "ethnicity": "east_asian",
    "country": "south_korea",
    "peopleCount": "one",
    "era": "contemporary",
    "weather": "rain",
    "environment": "city",
    "cameraAngle": "low_angle",
    "framing": "upper_body",
    "lighting": "neon_night",
    "mood": "dramatic",
    "perspective": "third_person",
    "wardrobe": "micro_bikini",
    "profession": "kpop_idol",
    "story": "A fictional adult makes a calm decision in an original city scene."
  },
  "outputPlan": { "kind": "motion_gif", "frameCount": 12 }
}
```

An optional trusted-local `sourceInput` is forwarded to independent variant operations and discarded from batch state. `outputPlan.kind` is `still` or `motion_gif`; GIF frame count is 2–30. Response `202` contains the sanitized batch and output plan; `422` returns `{ error, errors[] }`; `409` reports duplicate submission; `503` reports a disabled provider.

`brief.story` is 20–400 characters. The compact mapper includes normalized ethnicity, country/cultural context, profession, and wardrobe in every human candidate, then rejects any mapping beyond the downstream 700-character contract instead of truncating it. Exhaustive enum-combination evidence observes a 678/700 maximum. Omitted legacy human `ethnicity`/`country` normalize to `unspecified`; nonhuman omissions normalize to `not_applicable`.

### Poll

`GET /api/image-batches/:batchId` returns the sanitized batch. Each variant contains its own `status`, `progress`, `phase`, safe `error`, and terminal delivery if available.

### Select

`POST /api/image-batches/:batchId/selection` with `{ "variantId": "..." }`. `200` returns the batch. Selecting the same variant preserves the revision. Selecting another completed variant increments it. Unknown, foreign, or non-completed variants return `409`.

## State and errors

```text
batch queued -> in_progress -> completed
                           -> partial
                           -> failed
variant queued -> in_progress -> completed | failed
selection none -> selected(revision 1) -> selected(revision n)
```

Stable errors include `batch_protocol`, `batch_count`, `batch_submission_id`, `batch_subject`, `batch_condition`, `batch_adult_safety`, `minor_or_ambiguous_blocked`, `real_person_blocked`, `explicit_sex_blocked`, `age_coded_sexualization_blocked`, `batch_duplicate`, `batch_not_found`, and `batch_selection_invalid`. `adult_non_graphic_allowed` is a successful classifier result, not an error.

Every human story must carry an explicit fictional/non-identifying attestation. `real_person_blocked` covers missing attestation plus bounded keyword/name-context matches; it is a deterministic pre-provider text boundary, not a claim that arbitrary names can be identified from text.

## Presentation behavior

- `/real` renders one H1, one form, one acknowledgement, and one submit action. The former upper batch and lower single-photo settings are consolidated into the lower production sequence; no workflow switcher or hidden legacy form remains.
- The form exposes text/2D mode, preservation focus, all IMG-001 through IMG-004 controls, still/GIF output, and 1–3 count with semantic labels and keyboard-operable buttons/selects. Human defaults are `east_asian` and `south_korea`; profession changes never mutate them.
- The ViewModel is the single owner of mode/reference/output/brief state, age-coded-fashion conflict messaging, submission, one polling timer, partial failure messages, selection commands, and immutable result state.
- The ViewModel clones one Business default profile per instance. The View renders only controlled values; it has no independent default state or duplicated default literals.
- Candidate cards show per-variant state. Completed cards expose Select; selection remains visible after the next poll.
- The planned-retouch panel explicitly says IMG-009 is unavailable.

IMG-010 acceptance requires unit evidence for full-profile initialization, subject automation, unrelated-field preservation, and per-ViewModel isolation, plus browser evidence that displayed defaults equal the initial request payload.

## Acceptance cases

IMG-001–IMG-003: casting/country allow-lists, human/nonhuman defaults, independent fictional archetypes, and every adult swimwear option are validated. English/Korean non-graphic adult sensual cases reach the gateway only for fictional adult humans age 20+; minor/teen/ambiguous, real-person, explicit/pornographic/coercive, non-human/no-person sensual, non-human wardrobe, erotic school-inspired, and subject/age-mismatch cases start no provider operation. IMG-004: three adapter calls overlap under an async test double. IMG-005: one failure plus two completions yields `partial`. IMG-006: selection is scoped and idempotent. IMG-007: a fake repository drives ViewModel submission, polling, policy conflict, partial failure, selection, and disposal; a gateway contract test drives the Studio adapter. IMG-008: the 400/401 ViewModel boundary and all three maximum-length domain-to-Studio mappings are tested, then API/build/E2E and delivery-validation pass. IMG-009: no callable retouch route or active UI action exists.
IMG-011 acceptance is covered by Business tests for selection matching and metadata-only storage, plus browser tests for the happy path, save-time selection races, all normalized settings, direct-entry failure, and 390px layout.

# IMG-011 · Image project continuation

## Functional acceptance

1. 완료되고 delivery가 있는 후보의 selection 응답이 성공해야 `이 이미지로 프로젝트 시작`이 활성화된다.
2. CTA는 `/image-projects/{batchId}`로 이동하며 해당 화면은 `ImageBatchRepository.get`으로 최신 selection을 다시 검증한다.
3. 사용자는 2~60자 제목, allow-list 목적, 10~280자 창작 의도를 확정한다.
4. 저장 계약 `image-project.v1`은 batch/variant/revision과 프로젝트 메타데이터만 sessionStorage에 보관하며 이미지 data URI를 복사하지 않는다.
5. selection 없음, 완료되지 않은 후보, delivery 없음, 404는 프로젝트 정상 상태가 아니라 새 이미지 생성으로 돌아갈 수 있는 오류 상태다.
