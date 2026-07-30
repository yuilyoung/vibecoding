# 플랫폼 아키텍처와 YouTube 배포 운영 설계

## 결정 요약

Animation Real Studio는 ‘생성 완료’와 ‘외부 게시 완료’를 다른 도메인으로 다룬다. 개인 보관함에 안전하게 전달된 버전만 YouTube 게시 후보가 되며, 게시 전에 권리·정책·소유자 승인을 다시 확인한다.

### 권장 배포 모델

| 모델 | 대상 | MVP 권장 여부 | 권한 원칙 |
|---|---|---|---|
| Studio Channel | 스튜디오가 선별·소유하는 오리지널 결과 | **권장** | 스튜디오 운영자의 YouTube 채널을 연결하고, 운영자 승인 뒤 게시한다. |
| Creator Channel | 각 사용자가 자신의 채널에 게시 | P1 | 해당 사용자가 OAuth로 자신의 채널을 연결하고, 업로드 직전에 다시 승인한다. |
| Public Gallery | 사이트 안에서 공개 | P1 | YouTube 게시와 별개로, 명시적 갤러리 옵트인이 필요하다. |

사용자 콘텐츠를 스튜디오 채널에 자동 게시하면 권리와 평판 위험이 커진다. 따라서 Studio Channel도 **기본값은 `upload-review`**이며, 완전 자동 공개는 채널 운영·권리 정책·API 감사가 증명된 뒤에만 고려한다.

## 권장 기술 구성

초기에는 TypeScript 모노레포와 관리형 서비스 조합을 권장한다. 특정 클라우드 종속을 피하려면 인터페이스를 `packages/contracts`에 두고, 공급자 구현만 `apps/worker`에 둔다.

| 계층 | 권장 구성 | 책임 |
|---|---|---|
| Frontend | Next.js + TypeScript 웹 앱 | 랜딩, 로그인, 요청 위저드, 스토리보드 승인, 보관함, YouTube 연결/게시 화면 |
| BFF/API | 서버 측 TypeScript API | 인증·권한, 도메인 명령, OAuth 콜백, 서명 URL 발급, 운영 API |
| Worker | 컨테이너 기반 TypeScript worker | 영상 공급자 호출, 트랜스코딩/QC, 정책 후검사, YouTube 업로드·폴링·자막 업로드 |
| Database | PostgreSQL | 프로젝트·버전·정책 판정·작업·YouTube 연결·배포·감사 이벤트의 트랜잭션 기준 |
| Object storage | S3 호환 비공개 저장소 (GCS/S3/R2 등) | MP4/VTT/SRT/썸네일/manifest의 원본·파생 파일, 체크섬과 보존 규칙 |
| Queue | 관리형 작업 큐 | 생성·QC·YouTube 업로드·상태 폴링의 재시도, 지연 작업, DLQ |
| Secret/KMS | 관리형 비밀 저장소와 KMS | 영상 공급자 키, YouTube OAuth refresh token 암호화, 키 교체 |
| Observability | 구조화 로그·트레이스·메트릭·경보 | job 실패율, 비용, 처리 지연, OAuth 오류, YouTube 게시 실패·처리 상태 |

프로덕션의 작은 시작점은 `web`, `api`, `worker` 세 배포 단위다. 웹 요청에서 영상 생성이나 YouTube 업로드를 직접 처리하지 않는다. 대용량 파일과 길게 실행되는 외부 호출은 항상 worker와 queue로 넘긴다.

```text
Browser → Web/BFF → PostgreSQL
                   ├─ Private object storage ← QC/transcode worker
                   ├─ Generation queue → video provider worker
                   └─ Distribution queue → YouTube adapter → YouTube Data/Analytics APIs
                                                     ↑              ↓
                          Ops console ← audit/event store ← status polling
```

## YouTube 연결과 토큰 관리

YouTube Data API는 채널 소유자의 OAuth 2.0 권한을 필요로 하며, 서비스 계정은 YouTube 채널에 연결되지 않아 사용할 수 없다. 서버 웹 앱 OAuth 흐름을 사용하고, 각 채널 연결을 별도 레코드로 보관한다. [Google OAuth 가이드](https://developers.google.com/youtube/v3/guides/authentication)

1. 사용자가 `Connect YouTube channel`을 선택한다.
2. 서버가 `state`, PKCE verifier, 요청 scope, 연결 대상 사용자/조직을 짧게 보존하고 Google 동의 화면으로 리디렉션한다.
3. 콜백에서 `state`를 검증하고 코드를 서버에서 교환한다. refresh token은 평문으로 DB에 저장하지 않고 KMS로 암호화한다.
4. 인증된 계정의 채널 목록을 조회해 사용자가 게시 채널을 명시적으로 선택한다.
5. `youtube_channel_connections`에 채널 ID, 소유자, 암호화된 토큰 참조, scope, 연결/갱신/철회 시각을 저장한다.
6. 사용자는 언제든 연결을 해제할 수 있다. 해제 즉시 작업 큐의 해당 채널 배포를 취소하고 refresh token을 폐기/삭제한다.

권한은 용도별 최소 scope로 분리한다. 업로드 전용과 관리·자막·분석을 하나의 동의 흐름으로 묶지 말고, 기능을 켤 때 추가 동의를 요청한다. 운영 서버가 studio 채널을 사용하는 경우에도 사람 개인의 장기 토큰을 공유하지 말고, 승인된 조직 계정과 비밀 관리 절차를 사용한다.

## YouTube 배포 상태 머신

```text
not-requested → draft → awaiting-owner-approval → policy-recheck
policy-recheck → blocked | queued → uploading → youtube-processing
youtube-processing → private-ready | scheduled | published | failed
private-ready | scheduled | published → metadata-sync | unpublishing → removed
```

- `policy-recheck`: 새로 바뀐 정책, 삭제 요청, 채널 연결 철회, 결제/쿼터 상태를 마지막으로 확인한다.
- `uploading`: 동일한 `video_version_id + channel_id`가 두 번 업로드되지 않도록 idempotency key를 사용한다.
- `youtube-processing`: `videos.insert`가 성공한 뒤 받은 YouTube video ID로 처리 상태를 폴링한다. YouTube는 업로드 직후 공개되지 않을 수 있으므로 `processingDetails.processingStatus`가 성공일 때만 다음 상태로 전이한다. [YouTube 동영상 구현 가이드](https://developers.google.com/youtube/v3/guides/implementation/videos)
- `removed`: YouTube 삭제 성공과 Studio 원본 삭제는 별개의 감사 이벤트다. 외부 삭제 실패는 재시도·운영 알림으로 처리한다.

## 업로드 작업 계약

`youtube_publications`은 `video_versions`의 자식이며, 같은 생성본을 여러 채널에 배포할 때 각각 독립된 레코드를 만든다.

| 필드 | 목적 |
|---|---|
| `id`, `video_version_id`, `channel_connection_id` | 내부 버전과 게시 채널 연결 |
| `state`, `idempotency_key`, `attempt_count`, `next_attempt_at` | 안전한 비동기 실행·재시도 |
| `youtube_video_id`, `youtube_url`, `processing_status` | YouTube 리소스와 처리 결과 |
| `title`, `description`, `tags`, `privacy_status`, `publish_at`, `playlist_id` | 게시 시점의 불변 메타데이터 스냅샷 |
| `caption_asset_id`, `thumbnail_asset_id` | 업로드할 검증된 파생 파일 |
| `policy_decision_id`, `approved_by`, `approved_at` | 외부 게시의 근거 |
| `last_synced_at`, `last_error_code`, `last_error_detail` | 운영·복구 정보 |

Worker 순서는 다음과 같다.

1. `delivery manifest`의 MP4(9:16, 15초), VTT/SRT, 썸네일, 체크섬, 사후 정책 통과를 검증한다.
2. 게시 제목·설명·태그가 원작 IP, 허위 출처, 개인정보를 포함하지 않는지 다시 검사하고 소유자 승인을 확인한다.
3. 재개 가능한 `videos.insert` 업로드로 영상과 `snippet`, `status` 메타데이터를 전송한다.
4. YouTube ID를 즉시 저장하고, 처리 상태·오류를 폴링한다. 미검증 API 프로젝트의 API 업로드는 private로 제한될 수 있으므로, 이 경우 `private-ready`에서 멈추고 API 감사 전 public 전이를 막는다. [YouTube video resource](https://developers.google.com/youtube/v3/docs/videos)
5. 처리 성공 뒤 `captions.insert`로 VTT/SRT 자막을 게시하거나 오류를 기록한다. 자막 파일의 언어·이름·video ID가 필요하며, 캡션 API의 `sync` 파라미터는 폐지됐으므로 생성된 timecode를 검증해 업로드한다. [YouTube captions guide](https://developers.google.com/youtube/v3/guides/implementation/captions)
6. 지원·권한이 확인된 경우에만 `thumbnails.set`, `videos.update`, `playlistItems.insert`를 실행한다. 사용자 선택 또는 운영 승인 없이는 공개 전환하지 않는다.
7. Studio DB의 게시 상태와 감사 로그를 갱신한다. YouTube URL만 보관하지 않고 YouTube ID, 요청/응답 요약, 상태 변경 시각을 남긴다.

## Shorts 규격과 게시 제약

MVP 산출물 15초·9:16은 현재 Shorts 분류 조건(세로 또는 정사각형, 최대 3분)에 들어간다. 길이를 1분 이상으로 넓힐 때는 활성 Content ID claim이 있는 Shorts가 전 세계 차단될 수 있으므로, 권리 검증을 더욱 강화한다. [YouTube Shorts 공식 안내](https://support.google.com/youtube/answer/15424877)

YouTube에서 자동 게시를 시작하기 전에는 다음을 출시 차단 항목으로 둔다.

- OAuth 동의 화면, redirect URI, 공개된 개인정보처리방침, 토큰 철회 처리를 검토한다.
- 업로드 API 프로젝트가 private 제한을 해제하려면 YouTube API 정책 준수 감사가 필요할 수 있다. 기본 할당량 초과 요청도 감사가 선행된다. [Quota and compliance audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- 채널별 일일 게시 상한·실패 재시도·중복 게시 방지·human approval을 운영 도구에서 설정한다.
- 배경 음악, 유명 IP, 인물 초상, 허위 표기, 연령 제한은 Studio 정책 통과와 별개로 YouTube 정책/Content ID 결과를 모니터링한다.

## YouTube 관리 화면

프로젝트 상세의 `Distribute` 탭에는 다음만 표시한다.

- 연결 채널, 연결 상태, 최소 권한, 마지막 갱신 시각, 연결 해제
- 검증된 버전 선택, 제목·설명·태그·자막·썸네일 미리보기, `private/unlisted/public/scheduled` 선택
- 게시 승인자, 상태 타임라인, YouTube video ID/URL, 오류 사유, 재시도/철회/삭제 요청
- Studio 원본 보관 상태와 YouTube 게시 상태의 차이

운영 콘솔에는 배포 대기열, API 쿼터, OAuth 오류, YouTube 처리 실패, 원작/권리 신고, 채널별 게시 이력, 조치 감사 로그를 둔다. YouTube Analytics API는 채널·영상별 조회수, 시청 시간, 좋아요 등을 기간·영상 필터로 조회할 수 있으므로, P1에서는 일 단위 동기화 후 내부 대시보드에 캐시한다. [YouTube Analytics reports.query](https://developers.google.com/youtube/analytics/reference/reports/query)

## 추가 태스크

| ID | 우선 | 작업 | 선행 | 완료 증거 |
|---|---|---|---|---|
| ARS-YT-01 | P0 | Studio channel과 Creator channel 중 MVP 배포 모델을 결정하고 OAuth/ToS 범위를 ADR로 승인 | ARS-003, ARS-007 | 승인 ADR, 개인정보·동의 카피 |
| ARS-YT-02 | P0 | `youtube_channel_connections`, `youtube_publications`, 배포 감사 이벤트 마이그레이션 작성 | ARS-010, ARS-YT-01 | 제약조건·권한·상태 전이 테스트 |
| ARS-YT-03 | P0 | 서버 OAuth 연결·토큰 KMS 암호화·해제 흐름 구현 | ARS-YT-02 | state/PKCE/토큰 철회 보안 테스트 |
| ARS-YT-04 | P0 | 재개 가능한 업로드·처리 폴링·idempotency·DLQ worker 구현 | ARS-015, ARS-YT-03 | sandbox/private 채널 E2E, 중복·실패 복구 증거 |
| ARS-YT-05 | P0 | 자막·썸네일·메타데이터·private 기본값 동기화 구현 | ARS-016, ARS-YT-04 | YouTube video ID/캡션/상태 검증 |
| ARS-YT-06 | P0 | 업로드 API 감사·쿼터·정책·운영 승인 출시 게이트 완료 | ARS-YT-04, ARS-018 | 감사 상태, quota runbook, 운영 승인 기록 |
| ARS-YT-07 | P1 | 게시 관리·철회·외부 삭제 화면과 운영 콘솔 구현 | ARS-YT-05 | 권한별 E2E, 감사 로그 |
| ARS-YT-08 | P1 | Analytics API 일 단위 동기화와 영상 성과 대시보드 구현 | ARS-YT-05 | 메트릭 데이터 사전, 채널/영상 필터 검증 |
