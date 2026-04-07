# Agent Workspace Harness Checklist

작성일: 2026-04-06
대상: 저장소 루트 작업환경
범위: 에이전트가 실제로 일하는 운영 환경 전체

## 체크리스트

| 구분 | 항목 | 상태 | 근거 |
|------|------|------|------|
| 오케스트레이션 | 에이전트 역할 문서 존재 | 완료 | `.claude/agents/*.md` |
| 오케스트레이션 | 작업 흐름 규칙 존재 | 완료 | `.claude/rules/*.md` |
| 오케스트레이션 | PM 보고서 규칙 존재 | 완료 | `.claude/rules/04-workflow.md` |
| MCP | 루트 MCP 정의 존재 | 완료 | `.mcp.json` |
| MCP | 로컬 프로젝트 대상 MCP 포함 | 완료 | `serena`, `shrimp-task-manager` |
| Hook 실행 | 도구 가드 훅이 현재 환경에서 파싱 가능 | 완료 | `.claude/hooks/agent-tool-guard.mjs` |
| Hook 실행 | verify 전용 MCP 제한 훅 존재 | 완료 | `.claude/hooks/enforce-shrimp.mjs` |
| Hook 실행 | Write/Edit 경로 가드가 현재 경로 규칙과 일치 | 완료 | `.claude/hooks/write-guard.mjs` |
| Hook 로깅 | 편집 후 PM 로그 기록 가능 | 완료 | `.claude/hooks/post-edit-log.mjs` |
| 플러그인 | repo-local marketplace 등록 | 완료 | `.agents/plugins/marketplace.json` |
| 플러그인 | `openai-hud` 로컬 플러그인 존재 | 완료 | `plugins/openai-hud` |
| 상태 가시성 | HUD 상태 수집 스크립트 존재 | 완료 | `plugins/openai-hud/scripts/collect-status.mjs` |
| 상태 가시성 | 루트 작업환경 상태 수집 스크립트 존재 | 완료 | `plugins/openai-hud/scripts/collect-workspace-status.mjs` |
| 공용 계약 | 루트 공용 에이전트 계약 문서 존재 | 완료 | `AGENTS.md` |
| 공용 계약 | 비전/울트론 공용 환경 문서 존재 | 완료 | `docs/development/common-agent-environment.md` |
| 공용성 | Claude 기능 축소 없이 공용 계층 분리 | 완료 | 공용 계층 + `.claude/` 확장 계층 구조 |
| 울트론 실행 | 울트론 전용 실행 계층 존재 | 완료 | `codex/` |
| 울트론 실행 | 비전→울트론 handoff 템플릿 존재 | 완료 | `docs/handoffs/current-handoff.json` |
| 울트론 실행 | 울트론 실행 리포트 템플릿 존재 | 완료 | `docs/handoffs/current-execution-report.md` |
| 울트론 실행 | preflight / postflight 명령 존재 | 완료 | `npm run codex-preflight`, `npm run codex-postflight` |
| 기준 프로젝트 | 현재 활성 베이스라인 문서화 | 완료 | `docs/development/active-workspace-baseline.md` |
| 규칙 일관성 | Unity 장기계획 vs web prototype 실행기준 분리 명시 | 완료 | `docs/development/active-workspace-baseline.md` |

## 판정

| 항목 | 결과 |
|------|------|
| 에이전트 작업환경 하네스 | 구축 완료 |
| 공용 에이전트 환경 | 구축 완료 |
| 비전 planning + 울트론 execution 조합 | 구축 완료 |
| 현재 활성 실행 베이스라인 | `work/2D-FPS-game` 웹 프로토타입 |
| 장기 제품 로드맵 | 루트 `docs/`의 Unity 계획 |

## 주의사항

- "구축 완료"는 운영 환경 기준입니다.
- 제품 자체가 완성되었다는 뜻은 아닙니다.
- 기능 구현은 별도 마일스톤(M1 이후)로 진행합니다.
