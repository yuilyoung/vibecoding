---
name: analyze-prd
description: 요구사항 분석 → PRD 생성. Agent로 spawn되어 mailbox에 결과를 기록한다.
user-invocable: true
argument-hint: "[기능 설명 또는 요구사항]"
---

## 실행 방식

이 스킬이 호출되면 **Agent 도구로 서브에이전트를 spawn**하여 실행한다.

에이전트 spawn 시 아래 프롬프트를 전달:

```
당신은 PRD 분석 에이전트입니다.

## 컨텍스트
- CLAUDE.md 읽기 — 아키텍처, 코드 규칙
- docs/rules.md 읽기 — 제약사항 및 컨벤션
- docs/tech-stack.md 읽기 — 기술 스택, 성능 목표
- 기존 코드베이스 탐색 — 관련 구현 파악

## 임무
사용자 요구사항: {argument}

아래 형식으로 PRD를 작성하여 mailbox 파일에 저장하라.
mailbox 경로: .dev-cycle/{cycle-id}/prd.md

## PRD 형식 (200줄 이하)
# PRD: [기능명]
## 개요 — 목적, 범위
## 기능 요구사항 (FR-1, FR-2, ...)
## 비기능 요구사항 (NFR-1, ...)
## 기술 설계 — Scene/Entity/System, 데이터 구조, Adapter 범위
## 의존성 — 선행 작업, 영향 코드
## MVP 범위 — 최소 기능, 확장 계획
## 테스트 전략 — 단위/통합 대상
## 완료 기준 (DoD) — 체크리스트

## 규칙
- 200줄 이하
- 매직 넘버 금지, JSON 외부화 명시
- Unity 이식 고려 (로직/렌더링 분리)
- MVP 우선 정의
```

## 단독 호출 시

mailbox 없이 단독 호출되면 `docs/prd/` 디렉토리에 직접 저장한다.
에이전트 spawn 후 결과를 사용자에게 요약 표시하고 승인을 요청한다.
