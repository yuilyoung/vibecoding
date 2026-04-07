# Agent Environment Contract

이 저장소는 `비전(Vision, Claude 오케스트레이터)`과 `울트론(Ultron, Codex 실행 에이전트)`이 함께 사용할 수 있도록 계층형으로 구성된다.

## 원칙

- `Claude` 전용 설정은 `.claude/`에 둔다.
- 공용 운영 기준은 루트 문서로 둔다.
- 실제 구현과 검증의 활성 작업 기준은 `work/2D-FPS-game`이다.
- 루트 `docs/`는 장기 제품 로드맵과 아키텍처 기준을 담는다.

## 공용 진입점

- 작업환경 체크리스트: `docs/development/agent-workspace-harness-checklist.md`
- 활성 베이스라인: `docs/development/active-workspace-baseline.md`
- Claude/Codex 운영 모델: `docs/development/claude-codex-operating-model.md`
- 프로젝트 문서 인덱스: `docs/README.md`
- HUD 플러그인: `plugins/openai-hud`

## 상태 확인

- 작업환경 상태: `node plugins/openai-hud/scripts/collect-workspace-status.mjs`
- 프로젝트 상태: `node plugins/openai-hud/scripts/collect-status.mjs`
- 공용 루트 명령: `npm run workspace-status`, `npm run project-status`, `npm run next-tasks`
- Codex 실행 명령: `npm run codex-preflight`, `npm run codex-postflight`

## 베이스라인 규칙

- 실행, 빌드, 테스트는 `work/2D-FPS-game` 기준
- 제품 방향과 장기 목표는 루트 `docs/` 기준
- 두 기준이 충돌하면 실행 기준이 우선이다

## 에이전트별 해석

- `비전 (Vision / Claude)`: `.claude/settings.json`, `.claude/rules/`, `.claude/agents/`, `.claude/hooks/`를 추가로 사용한다.
- `울트론 (Ultron / Codex)`: 이 파일과 `docs/development/*.md`, `plugins/openai-hud/scripts/*.mjs`, `codex/` 계층을 우선 사용한다.

## 관계 정의

- `비전`은 계획, 분해, 승인, 오케스트레이션을 담당한다.
- `울트론`은 개발 구현, 검증, 실행 리포트를 담당한다.
- 둘은 상하 관계가 아니라 서로를 보완하는 형제 에이전트로 동작한다.

## 주의

- `.claude/`는 Claude 기능을 확장하는 전용 레이어다.
- 공용화는 Claude 기능을 제거하는 것이 아니라, 공통 계약을 루트에 추가하는 방식으로 유지한다.
