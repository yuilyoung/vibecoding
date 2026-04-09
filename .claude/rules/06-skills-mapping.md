# 스킬-에이전트 매핑 강제 규칙

각 에이전트는 담당 스킬만 사용한다. 스킬 호출 시 반드시 해당 전문 에이전트가 수행.

## 에이전트별 허용 스킬

### planner
- `analyze-prd` — 요구사항 분석 → PRD 생성

### prd-generator
- `analyze-prd` — PRD 문서 작성

### prd-validator
- `review-prd` — PRD 기술적 타당성 검증

### create-tasks (에이전트)
- `create-tasks` — WBS 기반 태스크 분해

### pm
- `dev-cycle` — 전체 개발 사이클 오케스트레이션

### frontend
- `frontend-design` — UI 설계/구현
- `adapt` — 반응형 디자인
- `animate` — 애니메이션/모션
- `arrange` — 레이아웃/스페이싱
- `bolder` — 시각적 강화
- `clarify` — UX 카피 개선
- `colorize` — 컬러 전략
- `critique` — UX 평가
- `delight` — 마이크로인터랙션
- `distill` — UI 단순화
- `extract` — 디자인 시스템 추출
- `normalize` — 디자인 시스템 정합성
- `onboard` — 온보딩 플로우
- `typeset` — 타이포그래피
- `overdrive` — 고급 구현 (셰이더, 물리엔진)
- `polish` — 최종 품질 패스
- `quieter` — 시각 톤다운
- `optimize` — UI 성능 최적화

### backend / app-developer
- `develop` — TDD 기반 구현
- `harden` — 프로덕션 강화 (에러 핸들링, i18n)

### code-reviewer
- `review-code` — 코드 리뷰 및 품질 검증

### qa
- `verify` — 최종 검증 (테스트, DoD 체크)
- `audit` — 접근성/성능/보안 감사
- `critique` — UX 평가 (프론트엔드와 공유)
- `polish` — 최종 품질 패스 (프론트엔드와 공유)

### devops
- `harden` — 인프라 강화
- `optimize` — 성능 최적화

### architect
- `teach-impeccable` — 디자인 컨텍스트 초기 설정
