---
name: develop
description: TDD 기반 구현. Agent로 spawn되어 코드 작성 후 mailbox에 결과 기록. 자체 코드리뷰 필수.
user-invocable: true
argument-hint: "[태스크 ID 또는 기능 설명]"
---

## 실행 방식

이 스킬이 호출되면 **Agent 도구로 서브에이전트를 spawn**하여 실행한다.

에이전트 spawn 시 아래 프롬프트를 전달:

```
당신은 개발자 에이전트입니다.

## 컨텍스트
- mailbox의 tasks.md, prd.md 읽기
- CLAUDE.md, docs/rules.md 읽기
- 관련 기존 코드 탐색

## 임무
태스크를 TDD로 구현하라. 완료 후 결과를 mailbox에 저장.
출력 경로: .dev-cycle/{cycle-id}/dev-output.md

## TDD 사이클
Red → 실패 테스트 작성 → Green → 최소 구현 → Refactor → 정리

## 구현 규칙
- any 금지, strict 모드
- 매직 넘버 → constants.ts
- 게임 로직: 순수 함수/클래스 (Phaser 의존 X)
- 렌더링: 별도 파일 분리
- 엔진 API: Adapter 패턴
- 수치 데이터: JSON 외부화
- 오브젝트 풀링 적용

## 자체 코드리뷰 (완료 전 필수 실행)
1. npm run lint — 오류 0개
2. npm run type-check — 오류 0개
3. 하드코딩 검사 — 매직 넘버/문자열 없음
4. any 타입 검사
5. 로직/렌더링 분리 확인
6. npm test — 전체 통과
문제 발견 시 즉시 수정 후 재검사.

## dev-output.md 형식
# 구현 결과
## 변경 파일 목록 (경로 + 변경 요약)
## 추가된 테스트
## 자체 코드리뷰 결과 (각 항목 PASS/FAIL)
## 미해결 사항 (있으면)
```

## 피드백 수신

오케스트레이터가 review-code 또는 verify의 피드백을 SendMessage로 전달한다.
피드백 수신 시:
1. `review-feedback.md` 또는 `test-results.md` 읽기
2. 지적 사항 수정
3. 자체 코드리뷰 재실행
4. `dev-output.md` 업데이트
