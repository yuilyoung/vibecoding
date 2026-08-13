# Development Rules & Constraints

## 프로젝트 구조 규칙
- **루트 디렉토리에 파일 직접 생성 금지** (설정 파일 제외)
- md 파일이 많아지면 하위 폴더로 분류 (예: `docs/prd/`, `docs/design/`)
- script, ts, json 등 모든 소스 파일은 적절한 하위 폴더에 배치
- 파일 간 참조는 **상대 경로** 사용
- 폴더가 커지면 인덱스 파일(`index.md` 또는 `README.md`)로 목록 관리
- 허용되는 루트 파일: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `CLAUDE.md`

## 문서 규칙
- **모든 문서는 200줄 이하** (CLAUDE.md, PRD, rules 포함)
- 초과 시 분리하여 참조 링크 사용
- **구조/상태/흐름 설명 시 Mermaid 다이어그램 필수 사용**
  - 아키텍처 → `graph TD` 또는 `C4Context`
  - 개발 흐름/사이클 → `flowchart` 또는 `sequenceDiagram`
  - 상태 변화 → `stateDiagram-v2`
  - 일정/진행 → `gantt`
  - 데이터 구조 → `classDiagram` 또는 `erDiagram`

## TypeScript 제약사항
- `strict: true` 필수
- `any` 타입 사용 절대 금지
- `strictPropertyInitialization: false` (Phaser 호환)
- `as` 타입 단언 최소화 — 타입 가드 우선

## 코딩 컨벤션
- 매직 넘버/문자열 금지 → `src/utils/constants.ts`
- 하나의 클래스/파일 = 하나의 역할
- 파일명: PascalCase (클래스), camelCase (유틸)
- 폴더명: kebab-case 또는 camelCase
- 인터페이스: `I` 접두사 사용하지 않음 (예: `Player`, not `IPlayer`)
- export default 사용하지 않음 — named export만

## 아키텍처 제약사항
- 게임 로직에 Phaser API 직접 호출 금지
- 렌더링 코드에 게임 규칙/계산 금지
- 엔진 API는 반드시 Adapter 패턴으로 래핑
- Scene 간 데이터 전달: Registry 또는 이벤트 버스
- 전역 상태 최소화 — Scene 로컬 상태 우선

## 데이터 관리
- 모든 게임 수치 → `assets/data/*.json`
- constants.ts: 물리 상수, UI 크기, 타이밍 값
- JSON: 적 스탯, 무기 데이터, 레벨 구성, 아이템
- 밸런스 데이터는 코드에 절대 하드코딩 금지

## 성능 제약사항
- 60fps 유지 (데스크탑), 30fps (모바일)
- Draw Call < 50/프레임
- 번들 < 2MB, 메모리 < 150MB (모바일)
- 스프라이트 < 1MB, 오디오 < 2MB (단일 파일)
- `update()` 루프에서 오브젝트 생성 금지 → 풀링 필수
- 텍스처 아틀라스 사용 필수

## 테스트 제약사항
- 게임 로직: 단위 테스트 필수 (Vitest)
- 렌더링/입력: 통합 테스트
- TDD: 테스트 먼저 작성 → 구현 → 리팩토링
- 테스트 파일: `__tests__/` 또는 `*.test.ts`

## Git 제약사항
- 브랜치: `main` / `dev` / `feature/*` / `fix/*`
- 커밋 접두사: `feat` / `fix` / `refactor` / `chore` / `docs` / `assets`
- Git LFS: 10MB 이상 에셋 파일
- main 직접 push 금지 — PR 필수

## Developer 에이전트 자체 리뷰 (완료 전 필수)

`/develop` 에이전트는 태스크 완료 전 아래 항목을 반드시 확인:

1. `npm run lint` — 린트 오류 0개
2. `npm run type-check` — 타입 오류 0개
3. 하드코딩 검사 — 매직 넘버/문자열 없음
4. `any` 타입 검사 — 사용 없음
5. 로직/렌더링 분리 확인
6. `npm test` — 전체 테스트 통과

문제 발견 시 즉시 수정 후 재검사. 통과 전 태스크 완료 금지.

## 금지 사항
- `eval()`, `Function()` 사용 금지
- `console.log` 프로덕션 코드 잔류 금지 (디버그용만)
- 순환 참조 (circular dependency) 금지
- `setTimeout`/`setInterval` 게임 루프 대용 금지
- Phaser Tween 시스템 직접 사용 금지 (이식성)
