# Vision Ultron Operating Model

## 목표

- `비전 (Vision / Claude)`: 계획, 분해, handoff 작성
- `울트론 (Ultron / Codex)`: 구현, 검증, 실행 리포트 작성

## 에이전트 관계

- `비전`은 오케스트레이터다.
- `울트론`은 개발 코드 구현과 검증에 뛰어난 실행 에이전트다.
- `울트론`은 `비전`을 보완하고 돕는 형제 에이전트로 정의한다.

## 흐름

1. `비전`이 PRD/WBS/상태를 기준으로 작업을 분해한다.
2. `비전`이 `docs/handoffs/current-handoff.json`을 갱신한다.
3. `울트론`이 `codex/hooks/preflight-check.mjs`로 실행 기준을 확인한다.
4. `울트론`이 구현과 검증을 수행한다.
5. `울트론`이 `docs/handoffs/current-execution-report.md`를 갱신한다.
6. `울트론`이 `codex/hooks/postflight-sync.mjs`를 실행해 동기화 상태를 남긴다.
7. `비전`이 리포트를 읽고 다음 계획으로 이어간다.

## 왜 필요한가

- 계획과 구현의 역할을 분리할 수 있다.
- handoff 품질이 나빠지면 즉시 드러난다.
- 구현 결과가 다시 계획 루프로 자연스럽게 연결된다.

## 별칭 규칙

- 기본 호칭은 `비전`과 `울트론`을 사용한다.
- `Claude`, `Codex`는 엔진/도구 정체성을 설명할 때만 보조 표기로 사용한다.
