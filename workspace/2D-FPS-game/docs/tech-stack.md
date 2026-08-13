# Tech Stack — Phase 1

## Frontend (Phaser.js)

| 항목 | 기술 | 버전 | 선정 근거 |
|------|------|------|----------|
| Framework | Phaser | 4.0 (2026.02) | Web 네이티브, 16배 모바일 성능, 씬 구조가 Unity와 유사 |
| Language | TypeScript | 5.3+ | 타입 안정성, 자동완성, 리팩토링 안전성 |
| Bundler | Vite | 5.0+ | HMR < 100ms, Tree-shaking |
| Package Manager | npm | — | Node.js 내장 |

## Backend (Supabase)

| 항목 | 기술 | 선정 근거 |
|------|------|----------|
| Backend | Supabase | PostgreSQL 기반, 실시간, $25/mo, JWT 인증 |
| 실시간 | Supabase Realtime | 리더보드 실시간 업데이트 |
| 서버리스 | Edge Functions | Deno 기반, 검증 로직 |
| WebSocket | Socket.io | 멀티플레이 필요 시 추가 |

## 백엔드 도입 기준

| 기능 | 필요 여부 |
|------|----------|
| 리더보드/클라우드세이브/멀티플레이/업적 | 필요 |
| 로컬 단일플레이/게임 설정값 | 불필요 |

## API 설계

```
POST   /api/v1/players           # 계정 생성
GET    /api/v1/players/:id       # 프로필 조회
POST   /api/v1/scores            # 점수 등록
GET    /api/v1/scores?limit=100  # 리더보드 조회
POST   /api/v1/saves             # 게임 저장
GET    /api/v1/saves/:playerId   # 저장 불러오기
POST   /api/v1/achievements      # 업적 해제
```

## 성능 목표

| 지표 | 목표값 |
|------|--------|
| FPS | 60fps (데스크탑), 30fps (모바일) |
| Draw Calls | < 50 / 프레임 |
| 번들 크기 | < 2MB |
| 메모리 | < 150MB (모바일) |
| 첫 로드 | < 3초 |
| 기준 해상도 | 1280 × 720 (FIT) |

## 배포

| 대상 | 플랫폼 | 이유 |
|------|--------|------|
| Frontend | Netlify | 글로벌 CDN, Preview Deploy |
| Backend | Railway | GitHub 연동, 간단한 DevOps |
| 멀티플레이 | Fly.io | 35+ 리전, 저지연 |

## Phase 2 — Unity

| 항목 | 기술 |
|------|------|
| Engine | Unity 2D (2023 LTS) |
| Language | C# |
| Target | PC / iOS / Android |
| VCS | Git + Git LFS |
