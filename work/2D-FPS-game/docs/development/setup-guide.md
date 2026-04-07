# Setup Guide

## 목적

`work/2D-FPS-game`를 바로 실행, 빌드, 테스트할 수 있는 개발 하네스 안내입니다.

## 명령어

```bash
npm install
npm run dev
npm run type-check
npm run lint
npm test
npm run build
```

## 구성

- `index.html`: Vite 엔트리
- `src/main.ts`: 앱 셸 및 Phaser 부트스트랩
- `src/scenes/MainScene.ts`: 최소 플레이 가능 씬
- `src/domain/player/PlayerLogic.ts`: 엔진 비종속 순수 로직
- `tests/PlayerLogic.test.ts`: 단위 테스트
- `assets/data/game-balance.json`: 외부화된 수치 데이터

## 완료 기준

1. `npm install` 성공
2. `npm run type-check` 성공
3. `npm run lint` 성공
4. `npm test` 성공
5. `npm run build` 성공
