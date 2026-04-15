# 하네스 문서 디렉토리

이 폴더는 **Claude/Codex 공용 작업환경(하네스)** 전용 문서만 보관한다.
프로젝트 고유 문서는 각 프로젝트의 `work/{프로젝트명}/docs/` 아래에서 관리한다.

## 폴더 구조

```text
docs/
├── development/   — 작업환경 하네스, 운영 모델, 베이스라인
├── guides/        — 공용 에이전트 사용 가이드
└── handoffs/      — 비전 ↔ 울트론 브리지 (codex 훅이 참조하는 단일 소스)
```

> 핸드오프 파일은 `codex/hooks/preflight-check.mjs`, `codex/hooks/postflight-sync.mjs`가
> 루트 경로를 하드코딩하므로 여기에만 둔다. 프로젝트 폴더에 사본을 만들지 말 것.

## 공용 진입 문서

- `../AGENTS.md` — Claude/Codex 공용 계약
- `development/agent-workspace-harness-checklist.md` — 작업환경 하네스 상태
- `development/active-workspace-baseline.md` — 현재 활성 베이스라인
- `development/common-agent-environment.md` — 공용/전용 계층 설명
- `development/claude-codex-operating-model.md` — 비전/울트론 운영 모델
- `guides/cross-agent-quickstart.md` — 공용 명령 사용법

## 프로젝트 고유 문서 위치

| 프로젝트 | 경로 |
|----------|------|
| 2D-FPS-game | `../work/2D-FPS-game/docs/` |
