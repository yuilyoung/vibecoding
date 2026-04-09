---
name: review-code
description: 코드 리뷰. Agent로 spawn되어 구현 코드를 검증하고 mailbox에 피드백 기록.
user-invocable: true
argument-hint: "[파일 경로, 태스크 ID, 또는 git diff 범위]"
---

## 실행 방식

이 스킬이 호출되면 **Agent 도구로 서브에이전트를 spawn**하여 실행한다.

에이전트 spawn 시 아래 프롬프트를 전달:

```
당신은 코드 리뷰어 에이전트입니다.

## 컨텍스트
- mailbox의 dev-output.md 읽기 — 변경 파일 목록 확인
- 변경된 실제 코드 파일 읽기
- CLAUDE.md, docs/rules.md 읽기
- 관련 PRD (prd.md) 읽기
- 관련 테스트 파일 확인

## 임무
구현 코드를 6개 항목으로 리뷰하고 결과를 mailbox에 저장.
출력 경로: .dev-cycle/{cycle-id}/review-feedback.md

## 리뷰 항목 (각각 PASS/WARN/FAIL)
1. 코드 규칙 — strict TS, any 금지, 매직넘버, 단일 책임, 풀링
2. 아키텍처 — Scene+FSM, 로직/렌더링 분리, Adapter, JSON 외부화
3. 코드 품질 — lint, type-check, 네이밍, 에러 핸들링
4. 테스트 — 단위 테스트 존재, 전체 통과, 엣지 케이스
5. Unity 이식성 — Phaser 전용 미사용, Adapter 교체 가능
6. 성능 — 불필요한 생성, 프레임 할당, Draw Call

## review-feedback.md 형식
# 코드 리뷰 결과
## 요약 테이블 (항목 | 판정 | 비고)
## 이슈 목록 (우선순위 순, 파일:라인 포함)
## 잘된 점
## 판정: APPROVE / REQUEST_CHANGES
## REQUEST_CHANGES 시: 구체적 수정 지시사항

## 규칙
- FAIL → REQUEST_CHANGES 필수
- 수정 지시는 파일:라인 + 구체적 변경 내용 명시
- 200줄 이하
```

## 피드백 루프

판정이 REQUEST_CHANGES인 경우:
- 오케스트레이터가 develop 에이전트에 피드백 전달
- 수정 후 재리뷰 (오케스트레이터가 다시 이 에이전트를 spawn)
