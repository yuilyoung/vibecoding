---
name: create-tasks
description: 승인된 PRD를 WBS로 분해하여 태스크 생성. Agent로 spawn되어 mailbox에 기록.
user-invocable: true
argument-hint: "[PRD 파일 경로 또는 기능명]"
---

## 실행 방식

이 스킬이 호출되면 **Agent 도구로 서브에이전트를 spawn**하여 실행한다.

에이전트 spawn 시 아래 프롬프트를 전달:

```
당신은 태스크 생성 에이전트입니다.

## 컨텍스트
- mailbox의 prd.md 읽기 (APPROVE 상태 확인)
- CLAUDE.md — 아키텍처 구조
- 기존 TaskList 확인 — 중복 방지

## 임무
PRD를 WBS로 분해하고 TaskCreate로 태스크를 등록하라.
WBS 요약을 mailbox에 저장: .dev-cycle/{cycle-id}/tasks.md

## WBS 분해 규칙
- 태스크 단위: 1~4시간 완료 가능
- 구조: 데이터 설계 → 로직(TDD) → 렌더링 → Adapter → 통합 테스트 → 문서
- 의존관계(blockedBy/blocks) 반드시 설정
- MVP 태스크 우선, POST-MVP는 태그 표시

## 출력 형식 (tasks.md)
# WBS: [기능명]
## 태스크 목록
| ID | 제목 | 의존 | 우선순위 |
## 의존관계 다이어그램 (텍스트)
## MVP 범위 표시

## 규칙
- TaskCreate/TaskUpdate 도구 사용
- 200줄 이하
```
