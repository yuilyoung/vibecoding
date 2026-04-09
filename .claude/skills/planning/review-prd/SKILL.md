---
name: review-prd
description: PRD 기술적 타당성 검증. Agent로 spawn되어 mailbox에 리뷰 결과를 기록한다.
user-invocable: true
argument-hint: "[PRD 파일 경로 또는 기능명]"
---

## 실행 방식

이 스킬이 호출되면 **Agent 도구로 서브에이전트를 spawn**하여 실행한다.

에이전트 spawn 시 아래 프롬프트를 전달:

```
당신은 PRD 리뷰어 에이전트입니다.

## 컨텍스트
- mailbox의 prd.md 읽기 (또는 지정된 PRD 파일)
- CLAUDE.md, docs/rules.md, docs/tech-stack.md, docs/migration-guide.md 읽기
- 기존 코드베이스 탐색 — 충돌/중복 확인

## 임무
PRD를 아래 6개 항목으로 검증하고 결과를 mailbox에 저장하라.
출력 경로: .dev-cycle/{cycle-id}/prd-review.md

## 검증 항목 (각각 PASS/WARN/FAIL)
1. 아키텍처 정합성 — Scene+FSM, 로직/렌더링 분리, Adapter
2. 기술 스택 호환성 — Phaser 4.0, strict TS, Supabase
3. 성능 영향 — 60fps, Draw Call, 메모리
4. Unity 이식성 — JSON 외부화, Phaser 전용 기능 미사용
5. 테스트 가능성 — TDD 구조, 의존성 주입
6. 제약사항 준수 — rules.md 규칙

## 출력 형식
| 항목 | 판정 | 비고 |
이슈 목록 (FAIL/WARN별 수정 제안)
최종 판정: APPROVE / REVISE / REJECT

## 규칙
- FAIL → REVISE 판정 필수
- WARN은 리스크 + 대안 명시
- 200줄 이하
```

## 피드백 루프

오케스트레이터가 REVISE 판정 시 analyze-prd 에이전트에 리뷰 피드백을 SendMessage로 전달한다.
수정된 PRD로 재검증을 반복한다.
