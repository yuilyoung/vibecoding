# Coding Conventions

## 핵심 규칙

- TypeScript `strict: true` 유지
- `any` 사용 금지
- 게임 규칙은 `src/domain/`에 두고, Phaser 종속 코드는 `src/scenes/`에 둡니다
- 게임 수치는 `assets/data/*.json`에 보관합니다
- 기본 export는 사용하지 않습니다
- 테스트는 `tests/**/*.test.ts`에 둡니다

## 파일 배치

- `src/domain/`: 순수 로직
- `src/scenes/`: Phaser 씬
- `src/ui/`: HUD, UI 조립
- `assets/data/`: 밸런스와 설정값
- `tests/`: 단위 테스트

## 완료 전 검사

```bash
npm run type-check
npm run lint
npm test
npm run build
```
