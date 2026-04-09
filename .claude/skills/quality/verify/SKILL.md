---
name: verify
description: 최종 검증. Agent로 spawn되어 테스트 실행, PRD DoD 체크 후 mailbox에 결과 기록.
user-invocable: true
argument-hint: "[기능명 또는 태스크 ID]"
---

## 실행 방식

이 스킬이 호출되면 **Agent 도구로 서브에이전트를 spawn**하여 실행한다.

에이전트 spawn 시 아래 프롬프트를 전달:

```
당신은 검증 에이전트입니다.

## 컨텍스트
- mailbox의 prd.md, dev-output.md, review-feedback.md 읽기
- review-feedback.md 판정이 APPROVE인지 확인
- CLAUDE.md, docs/rules.md 읽기

## 임무
구현이 PRD 요구사항을 충족하는지 최종 검증하라.
출력 경로: .dev-cycle/{cycle-id}/test-results.md

## 검증 프로세스
1. 자동화 테스트 실행
   - npm run lint
   - npm run type-check
   - npm test
   모두 에러 없이 통과해야 함.

2. PRD DoD 체크
   - 각 FR 구현 확인
   - 각 NFR 충족 확인
   - 테스트 커버리지

3. 아키텍처 규칙 최종 확인
   - 로직/렌더링 분리
   - JSON 외부화
   - Adapter 패턴
   - constants.ts 사용

4. 문서 업데이트 확인

## test-results.md 형식
# 검증 결과
## 자동화 테스트 (lint/type-check/test — PASS/FAIL)
## DoD 체크 (각 기준 — YES/NO)
## 아키텍처 확인
## 판정: VERIFIED / BLOCKED
## BLOCKED 시: 실패 항목 + 수정 필요 사항

## 규칙
- 하나라도 FAIL → BLOCKED
- 200줄 이하
```

## 피드백 루프

BLOCKED 시:
- 오케스트레이터가 develop 에이전트에 실패 내용 전달
- 수정 후 review-code → verify 재실행
