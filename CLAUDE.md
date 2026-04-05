# 프로젝트 Rules

규칙은 `.claude/rules/`에 정의되어 있으며 모든 규칙을 강제 적용한다.

- `01-orchestrator.md` — 오케스트레이터(비전) 역할 및 메일박스 통신
- `02-dev-methodology.md` — 개발 전 필수 방법론 (페르소나·마일스톤·PRD·WBS·FSD·MVP·TDD·칸반보드)
- `03-subagents.md` — 서브에이전트 작업 할당 및 에이전트 간 토론/수정 규칙
- `04-workflow.md` — 전체 개발 워크플로우 (PRD 검증 → TDD → 테스트 → E2E)

## 에이전트 팀 구성

에이전트는 `.claude/agents/`에 정의되어 있으며 비전(오케스트레이터)이 프로젝트팀 단위로 운영한다.

```
비전 (오케스트레이터)
  └── pm                — PM (서브에이전트 조율, 진행 추적, HTML 보고서)
        └── 프로젝트팀
              ├── planner         — 기획자 (요구사항 수집, FSD, WBS, 마일스톤, MVP)
        │     ├── prd-generator   — PRD 문서 생성 (표준 구조 자동 생성)
        │     └── prd-validator   — PRD 문서 검증 (100점 기준, 90점 이상 승인)
        ├── architect       — 아키텍처 설계 (C4 모델, ERD, API 계약, ADR)
        ├── frontend        — 프론트엔드 (React/Next.js, E2E 테스트)
        ├── backend         — 백엔드 (API, DB, 통합 테스트)
        ├── app-developer   — 응용 개발 (모바일, 데스크톱, 게임, 자동화)
        ├── devops          — DevOps (CI/CD, 인프라, 모니터링, 배포)
        ├── git-manager     — Git 전문가 (로컬·GitHub 저장소 관리, 브랜치, PR)
        ├── code-reviewer   — 코드 리뷰 (100점 기준, 보안·성능·품질 검증)
        ├── doc-writer      — 기술 문서 (API 문서, 가이드, README, Changelog)
        └── qa              — QA 엔지니어 (테스트 검증, 버그 리포트, 90점 기준)
```

### PM 역할 및 지휘 체계

```
비전 (전략 결정·최종 승인)
  → PM에게 프로젝트 지시
    → PM이 서브에이전트 작업 조율 및 진행 추적
    → PM이 비전에게 HTML 보고서로 현황 보고
      → 블로킹 이슈 발생 시 즉시 에스컬레이션
```

### PRD 생성·검증 흐름

```
비전 → planner (요구사항 전달)
  → prd-generator (PRD 초안 생성)
  → prd-validator (검증 및 점수화)
    → 90점 미만: prd-generator에게 반려 → 수정 반복
    → 90점 이상: 비전에게 승인 요청
      → 승인 시: architect · frontend · backend · qa에게 PRD 배포
```

### 아키텍처 설계 흐름

```
prd-validator 승인 완료
  → architect (시스템 구조, ERD, API 계약, ADR 설계)
  → 비전에게 아키텍처 승인 요청
    → 승인 시: frontend · backend · app-developer · devops · doc-writer에게 설계 기준 배포
```

### 코드 리뷰 흐름

```
개발 에이전트 (frontend · backend · app-developer · devops) 구현 완료
  → code-reviewer (100점 기준 독립 검토)
    → 90점 미만: 해당 에이전트에게 수정 지시 반려 → 수정 후 재검토
    → 보안 Critical: 즉시 비전에게 긴급 알림
    → 90점 이상: 비전에게 승인 요청 → qa에게 테스트 요청
```
