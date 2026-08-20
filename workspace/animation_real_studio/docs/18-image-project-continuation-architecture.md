# IMG-011 — 선택 이미지의 개인 프로젝트 작업공간

Status: image-project.v2 trusted-local vertical slice, 2026-08-20.

## 가정과 제품 계약

완료된 이미지 배치 후보 하나를 서버에서 선택 확정한 사용자만 3단계로 이동한다. /image-projects/{batchId}는 최신 배치를 다시 조회하고 선택된 결과를 프로젝트의 기준 이미지로 사용한다. 사용자는 프로젝트 이름, 사용 목적, 창작 의도를 확정한 뒤 목적별 3개 작업의 상태와 메모를 관리한다.

기존 화면은 선택 이미지와 생성 설정, 정적인 다음 절차만 표시했다. v2는 같은 trusted-local 범위 안에서 작업을 실제로 진행하고 새로고침 후 복구할 수 있는 세션 작업 보드를 제공한다. 이미지 바이트는 프로젝트 메타데이터 저장소에 복사하지 않는다.

로그인, 공유, 다운로드, 서버 재시작 복구, My Studio 목록, 픽셀 리터치와 공개 제작은 범위 밖이다. 따라서 이 작업공간은 ARS-001 또는 IMG-009 게이트를 충족하거나 우회하지 않는다.

## 계층과 의존성

~~~mermaid
flowchart LR
  V[Presentation: ImageProjectWorkspace] --> BP[Business: project policy and progress]
  V --> BR[Business port: ImageBatchRepository]
  V --> PR[Business port: PersonalImageProjectRepository]
  HB[Data: HttpImageBatchRepository] -.implements.-> BR
  LP[Data: LocalImageProjectRepository] -.implements.-> PR
  HB --> API[image-batch.v1 HTTP]
  LP --> SS[sessionStorage metadata only]
~~~

- Presentation은 로딩, 폼, 저장 잠금, 성공·실패 피드백과 사용자 확인만 소유한다.
- Business는 v2 스키마, 목적 allow-list, 정확히 3개인 작업 정의, 상태 전이 입력, 길이 검증, 진행률과 다음 행동 계산, 목적 변경 초기화를 소유한다.
- Data는 JSON 역직렬화, 전체 런타임 검증 호출, v1 읽기 마이그레이션과 v2 저장을 구현한다.
- 의존성은 Presentation → Business interfaces ← Data implementations 방향을 유지한다.
- composition root와 저장소 포트는 v1과 동일하며 새 서버, API, 데이터베이스는 추가하지 않는다.

## image-project.v2 스키마

| 필드 | 계약 |
| --- | --- |
| protocolVersion | image-project.v2 |
| batchId, variantId | 선택된 배치와 완료 후보의 식별자 |
| selectionRevision | 1 이상의 서버 selection revision |
| title | 공백 제거 후 2~60자 |
| purpose | social_short, campaign_visual, portfolio_piece 중 하나 |
| creativeIntent | 공백 제거 후 10~280자 |
| workItems | 목적별 고정 ID·제목·순서의 정확히 3개 항목 |
| workItems[].status | todo, in_progress, done 중 하나 |
| workItems[].note | 항목별 240자 이하 메모 |
| projectNote | 목적과 무관한 공통 메모, 600자 이하 |
| createdAt, updatedAt | canonical UTC ISO 시각, YYYY-MM-DDTHH:mm:ss.sssZ |

작업 제목과 순서는 사용자가 추가·삭제·재정렬할 수 없다. 진행률은 완료 작업 수 / 3으로 파생한다. 다음 행동은 배열 순서상 첫 in_progress, 없으면 첫 todo이며, 세 항목이 모두 done이면 완료 상태다.

유효한 image-project.v1은 정체성, selection revision, 제목, 목적, 창작 의도와 시각을 보존하고 목적별 기본 3개 작업과 빈 프로젝트 메모를 더해 메모리에서 v2로 읽는다. 읽기만으로 sessionStorage를 변경하지 않으며 다음 성공 저장부터 v2만 기록한다. 잘못된 v2와 알 수 없는 버전은 사용하지 않는다.

## 수명과 저장 시퀀스

~~~mermaid
sequenceDiagram
  actor U as 사용자
  participant V as ImageProjectWorkspace
  participant B as image-batch.v1
  participant P as Business project policy
  participant L as sessionStorage repository
  U->>V: 작업 상태·메모 변경
  U->>V: 작업 보드 저장
  V->>B: GET latest batch
  B-->>V: selected variant + revision
  V->>P: validate selection and work draft
  alt selection changed or invalid
    P-->>V: reject without persistence
    V-->>U: 최신 이미지 재확정 안내
  else valid
    P-->>V: immutable v2 project snapshot
    V->>L: metadata-only save
    L-->>V: saved snapshot
    V-->>U: explicit success feedback
  end
~~~

- 저장소는 애플리케이션 수명의 단일 composition root 인스턴스이며 데이터는 브라우저 탭 sessionStorage 수명이다.
- 초기 배치 조회와 각 저장은 소유 AbortController로 화면 해제 시 취소한다. 저장소 포트까지 signal을 전달하고 직렬화 직전 다시 확인한다. sessionStorage 읽기·쓰기는 짧고 동기적인 브라우저 작업이라 별도 worker를 만들지 않는다.
- 메타데이터 저장과 작업 보드 저장은 각각 saving 잠금으로 중복 제출을 막고, 저장 중 관련 입력·상태·화면 내부 이동 제어를 비활성화한다.
- 재시도는 자동 수행하지 않는다. 사용자는 오류 확인 후 명시적으로 다시 저장한다.

## 상태와 실패 처리

- selection 없음, 완료되지 않은 후보, delivery 없음은 정상 프로젝트로 표시하지 않는다.
- 모든 저장 직전에 최신 batch를 다시 조회한다. variant ID 또는 selection revision이 바뀌면 저장하지 않고 최신 이미지를 재확정하게 한다.
- 목적 변경은 기존 3개 작업 상태와 항목 메모를 초기화하므로 사용자의 명시적 확인이 필요하다. 프로젝트 공통 메모는 보존한다.
- 저장된 메타데이터가 전체 스키마 검증에 실패하면 자동 보정하거나 일부 필드를 신뢰하지 않고 새 프로젝트 확정 흐름을 사용한다.
- 저장소는 caller 객체를 그대로 직렬화하지 않는다. Business 검증을 통과한 allow-list 필드로 canonical snapshot을 재구성해 저장하고 깊게 분리된 결과를 반환한다.
- 배치 404 또는 API 재시작은 복구됐다고 표현하지 않고 새 이미지 생성 동작을 제공한다.

## 거절한 대안과 위험

- 자유 작업 추가·삭제는 스키마와 UI 복잡도를 키우고 목적별 수용 기준을 약화하므로 이번 슬라이스에서 제외한다.
- localStorage 또는 서버 DB는 탭 수명·계정 소유권·삭제 정책을 새로 요구하므로 사용하지 않는다.
- 이미지 data URI를 프로젝트 레코드에 저장하면 용량과 민감 데이터 경계를 깨므로 금지한다.
- sessionStorage는 탭 종료와 API 재시작을 넘는 복구를 제공하지 않는다. 화면에서 이 한계를 명시한다.

## 구현 순서와 검증

1. Business: v2 타입, 목적별 작업, 전체 검증, 진행률, v1 읽기 마이그레이션, 업데이트 함수.
2. Data: 검증된 v1/v2 역직렬화와 metadata-only v2 저장.
3. Presentation: 작업 카드, 3상태 제어, 항목·프로젝트 메모, 진행률·다음 행동, 저장 피드백, 목적 변경 확인.
4. Verification: Business/Data 단위 테스트, 생성→작업→저장→새로고침 E2E, v1 전환, 목적 변경, selection 경쟁, 390px 무오버플로와 전체 회귀.
