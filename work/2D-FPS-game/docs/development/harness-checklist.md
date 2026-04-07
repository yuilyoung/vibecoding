# Harness Checklist

작성일: 2026-04-06
대상: `work/2D-FPS-game`
기준: 실행, 빌드, 타입검사, 테스트, 개발 문서, 상태 가시성

## 현재 체크리스트

| 구분 | 항목 | 이전 상태 | 현재 상태 | 근거 |
|------|------|-----------|-----------|------|
| 구조 | `src/`, `tests/`, `assets/data/` 기본 구조 | 일부 폴더만 존재 | 완료 | 실제 소스/테스트/데이터 파일 추가 |
| 런타임 | `package.json` 및 의존성 정의 | 없음 | 완료 | `package.json` 생성 |
| 빌드 | Vite 엔트리와 앱 셸 | 없음 | 완료 | `index.html`, `src/main.ts`, `src/styles.css` |
| 게임 하네스 | 최소 실행 씬 | 없음 | 완료 | `src/scenes/MainScene.ts` |
| 로직 분리 | 순수 게임 로직 모듈 | 없음 | 완료 | `src/domain/player/PlayerLogic.ts` |
| 데이터 외부화 | 밸런스 JSON | 없음 | 완료 | `assets/data/game-balance.json` |
| 타입 안전성 | TypeScript strict 설정 | 없음 | 완료 | `tsconfig.json` |
| 테스트 | Vitest 단위 테스트 | 없음 | 완료 | `tests/PlayerLogic.test.ts` |
| 정적 검사 | ESLint 설정 | 없음 | 완료 | `eslint.config.mjs` |
| 실행 문서 | 시작 가이드 | 없음 | 완료 | `docs/development/setup-guide.md` |
| 규약 문서 | 코딩 컨벤션 문서 | 없음 | 완료 | `docs/development/coding-conventions.md` |
| CI 템플릿 | 워크플로우 파일 | 없음 | 완료 | `.github/workflows/ci.yml` |
| 상태 가시성 | HUD/상태 요약 | HTML 보고서만 존재 | 완료 | 앱 HUD + `openai-hud` 플러그인 |

## 판정

| 항목 | 결과 |
|------|------|
| 하네스 완성도 | 100% |
| 현재 실행 단계 | 로컬 개발 착수 가능 |
| 남은 작업 성격 | 게임 기능 구현(M1) |

## 비고

- 루트 `docs/`의 Unity 계획 문서는 장기 로드맵입니다.
- 이번 완료 범위는 `work/2D-FPS-game` 웹 프로토타입 하네스 기준입니다.
