# 준비 패키지 리뷰 보완 기록

작성일: 2026-07-30
상태: **설계·태스크 정합성 보완 완료 / 제품 가설은 아직 미검증**

## 확정한 MVP 경계

`01-prd.md`의 “자동 SNS 게시 제외”는 **무인 자동 공개**와 사용자 개인 채널 직접 연결을 뜻한다. 사용자가 요청한 운영 범위를 반영해 다음은 MVP P0에 포함한다.

- 스튜디오가 소유·관리하는 단일 Studio Channel
- 권리 재검사와 지정 운영자의 명시적 승인
- `private` 업로드, YouTube 처리 상태 폴링, 자막 업로드, 감사 이력

Creator Channel OAuth 연결, 무인 공개 전환, 공개 갤러리와 Analytics 대시보드는 P1이다. 이 보완 기록과 `05-platform-and-youtube-operations.md`가 YouTube 관련 PRD 세부의 최신 기준이다.

## 전문 스킬 기준

프로젝트 로컬 스킬은 다섯 개다.

1. `adaptation-intake`
2. `rights-safety-gate`
3. `vertical-short-director`
4. `media-delivery-ops`
5. `youtube-distribution-ops`

다섯 번째 스킬은 `media-delivery-ops`의 private delivery 뒤, 운영자 승인과 정책 재검사를 거친 `video_version`만 입력으로 받아 외부 배포를 수행한다.

## YouTube 운영 상태의 명확한 의미

| 상황 | Studio 상태 | 필수 운영 행동 |
|---|---|---|
| 영상이 YouTube 처리 중 | `youtube-processing` | `processingDetails`를 폴링하며 외부 URL을 성공으로 표시하지 않는다. |
| 예약 취소 | `private-ready` | YouTube의 공개 예정 값을 제거하고 취소 감사 이벤트를 남긴다. |
| 공개 영상 철회 | `unpublishing → private-ready` | 먼저 YouTube privacy를 private로 전환한다. 삭제가 승인된 경우에만 `removed`로 진행한다. |
| YouTube에서 외부 삭제/변경 | `external-change-detected` | 일치하면 Studio 상태를 조정하고, 권한/ID/정책 충돌은 `manual-review`로 보낸다. |
| YouTube 삭제 실패 | `external-delete-pending` | 재시도·운영 경보를 남기며 Studio 원본 삭제 완료와 혼동하지 않는다. |

## 출시 게이트와 검증 상태

`tasks/mvp-readiness.json`과 `tasks/release-gates.json`을 함께 실행 백로그로 사용한다. 모든 P0 태스크와 `ARS-YT-06`이 끝나기 전에는 `ARS-022-RELEASE`를 통과할 수 없다.

현재는 PRD 검증 **계획**과 프론트 데모만 존재한다. 사용자 인터뷰(V1), 생성 품질(V2), 정책 fixture 실행(V3), 공급자 벤치마크(V4), 신뢰 흐름 사용성(V5)은 아직 실행 증거가 없으며 출시 완료로 주장하지 않는다.

## 책임이 필요한 미결정

| 결정 | 책임 역할 | 확정 태스크 |
|---|---|---|
| 보존 기간·삭제 SLA·연령 처리 | Product / Trust & Safety owner | ARS-001, ARS-003 |
| 데이터 지역·공급자 전송·키 관리 | Technical / Privacy owner | ARS-007, ARS-018 |
| Studio Channel OAuth·ToS·API 감사 | Studio operations owner | ARS-YT-01, ARS-YT-06 |
