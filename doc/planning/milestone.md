# 마일스톤 (Milestone)

프로젝트: Unity 기반 4v4 2D FPS 게임
작성일: 2026-04-05
작성자: planner 에이전트

---

## 1. 프로젝트 전체 일정 개요

| 마일스톤 | 기간 | 목표 |
|----------|------|------|
| M0 — 사전 준비 | Week 1–2 | 환경 세팅, 기획 완료, 아키텍처 설계 |
| M1 — 코어 프로토타입 | Week 3–5 | 단일 씬 이동, 사격, 충돌 구현 |
| M2 — MVP | Week 6–9 | 로컬 4v4 대전 가능 상태 |
| M3 — 네트워크 통합 | Week 10–13 | 멀티플레이 네트워크 동기화 |
| M4 — 콘텐츠 & 폴리시 | Week 14–17 | 맵 2종, 무기 3종, UI 완성 |
| M5 — QA & 릴리즈 | Week 18–20 | 버그 수정, E2E 테스트, 출시 빌드 |

전체 기간: 약 20주 (5개월)
기준일: 2026-04-05
예상 MVP 완료: 2026-06-07
예상 정식 출시: 2026-08-23

---

## 2. M0 — 사전 준비 (Week 1–2, 2026-04-05 ~ 2026-04-18)

### 목표
- 개발 환경 및 협업 도구 세팅 완료
- 기획 산출물 전체 완성 (페르소나, PRD, WBS, FSD, MVP, 마일스톤)
- 아키텍처 설계 완료 (C4 모델, ERD, API 계약)
- Unity 프로젝트 초기화 및 버전 관리 세팅

### 완료 기준 (Definition of Done)
- [ ] `doc/planning/` 하위 6개 문서 모두 작성 완료 및 검증 통과 (90점 이상)
- [ ] Unity 2D 프로젝트 생성, Git 저장소 연동
- [ ] 개발 브랜치 전략(Git Flow) 정의 문서 작성
- [ ] CI/CD 파이프라인 초안 구성
- [ ] 아키텍처 설계서 승인 완료

### 산출물
- `doc/planning/*.md` — 기획 문서 6종
- `doc/architecture/*.md` — 아키텍처 문서
- Unity 프로젝트 초기 구조

---

## 3. M1 — 코어 프로토타입 (Week 3–5, 2026-04-19 ~ 2026-05-09)

### 목표
- 2D 탑다운 씬에서 캐릭터 이동 구현
- 기본 사격 메카닉 (발사, 탄환 이동, 충돌 감지)
- 단순 HP 시스템 (피해 계산, 사망 처리)
- 로컬 싱글플레이 환경에서 동작 확인

### 완료 기준 (Definition of Done)
- [ ] 캐릭터가 WASD 또는 방향키로 8방향 이동 가능
- [ ] 마우스 방향을 향해 발사 가능 (단일 탄환)
- [ ] 탄환이 벽 또는 캐릭터에 충돌 시 소멸
- [ ] 피격 시 HP 감소, HP 0 시 캐릭터 사망 처리
- [ ] 단위 테스트: 이동, 사격, 충돌, HP 모듈 각각 커버리지 80% 이상

### 산출물
- `Assets/Scripts/Player/PlayerMovement.cs`
- `Assets/Scripts/Combat/BulletController.cs`
- `Assets/Scripts/Combat/HealthSystem.cs`
- 테스트 코드 (Unity Test Runner)

---

## 4. M2 — MVP (Week 6–9, 2026-05-10 ~ 2026-06-06)

### 목표
- 4v4 팀 구성 (Red Team / Blue Team)
- 라운드 시스템 (라운드 시작·종료·승패 판정)
- 기본 맵 1종 (장애물 포함 탑다운 맵)
- 기본 무기 1종 (소총)
- 로컬 멀티 입력 또는 AI 더미 봇 대체

### 완료 기준 (Definition of Done)
- [ ] 8명의 캐릭터(4v4)가 동일 씬에 배치되어 구분 가능
- [ ] 팀별 스폰 지점 설정, 라운드 시작 시 각 팀 스폰
- [ ] 한 팀이 전멸하면 라운드 종료, 점수 카운트
- [ ] 설정된 라운드 수 달성 시 게임 종료 및 승팀 표시
- [ ] 기본 HUD (HP, 탄약, 팀 스코어, 라운드 수) 표시
- [ ] 통합 테스트: 라운드 시작부터 종료까지 전체 플로우 검증

### 산출물
- `Assets/Scripts/GameManager/RoundManager.cs`
- `Assets/Scripts/Team/TeamManager.cs`
- `Assets/Scenes/Map_01.unity`
- `Assets/Scripts/UI/HUDController.cs`

---

## 5. M3 — 네트워크 통합 (Week 10–13, 2026-06-07 ~ 2026-07-04)

### 목표
- Unity Netcode for GameObjects (NGO) 또는 Mirror 기반 네트워크 통합
- 4명 동시 접속 멀티플레이 서버 구성
- 클라이언트-서버 간 플레이어 상태 동기화
- 매칭룸 (방 생성/참가) 기능

### 완료 기준 (Definition of Done)
- [ ] 로컬 네트워크 환경에서 4v4 멀티플레이 가능
- [ ] 플레이어 이동, 사격, HP가 모든 클라이언트에 동기화
- [ ] 호스트(서버) 기준 권위 처리 (Anti-cheat 기반)
- [ ] 방 생성 및 참가 UI 동작 확인
- [ ] 네트워크 레이턴시 100ms 이하에서 게임플레이 가능
- [ ] 통합 테스트: 4개 클라이언트 동시 연결 시나리오 검증

### 산출물
- `Assets/Scripts/Network/NetworkManager.cs`
- `Assets/Scripts/Network/PlayerNetworkSync.cs`
- `Assets/Scripts/Lobby/LobbyManager.cs`
- 서버 설정 문서

---

## 6. M4 — 콘텐츠 & 폴리시 (Week 14–17, 2026-07-05 ~ 2026-08-01)

### 목표
- 맵 추가 1종 (총 2종)
- 무기 추가 2종 (총 3종: 소총, 산탄총, 저격총)
- 사운드 이펙트 및 비주얼 이펙트 추가
- 로비 UI, 결과 화면, 캐릭터 선택 화면 완성
- 게임 밸런스 1차 조정

### 완료 기준 (Definition of Done)
- [ ] 맵 2종 모두 플레이 가능 상태 (경계 충돌, 장애물 배치 완료)
- [ ] 무기 3종의 스탯(데미지, 연사속도, 탄창) 차별화 확인
- [ ] 사격, 피격, 사망 사운드 및 이펙트 적용
- [ ] 게임 시작부터 결과까지 전체 UI 흐름 완성
- [ ] 5회 이상 내부 플레이테스트 완료, 주요 밸런스 이슈 수정

### 산출물
- `Assets/Scenes/Map_02.unity`
- `Assets/Scripts/Weapons/` (ShotgunController, SniperController)
- `Assets/Audio/`, `Assets/VFX/`
- 완성된 UI Prefab 세트

---

## 7. M5 — QA & 릴리즈 (Week 18–20, 2026-08-02 ~ 2026-08-23)

### 목표
- 전체 기능 E2E 테스트 자동화
- 버그 수정 및 성능 최적화
- 출시 빌드 생성 (PC/Windows)
- 릴리즈 노트 및 기술 문서 작성

### 완료 기준 (Definition of Done)
- [ ] 심각도 Critical/High 버그 0건
- [ ] E2E 테스트 커버리지 주요 시나리오 전체 통과
- [ ] 평균 FPS 60 이상 유지 (권장 사양 기준)
- [ ] 빌드 사이즈 500MB 이하
- [ ] 릴리즈 노트, API 문서, 사용자 가이드 완성

### 산출물
- 출시용 Windows 빌드
- `doc/release/release-notes.md`
- `doc/api/api-doc.md`

---

## 8. 위험 요소 및 대응 방안

| 위험 요소 | 영향도 | 대응 방안 |
|-----------|--------|-----------|
| 네트워크 동기화 기술 복잡도 | 높음 | M3 착수 전 네트워크 프레임워크 PoC 완료 |
| 멀티플레이 버그 재현 어려움 | 중간 | 자동화 테스트 환경 및 로그 시스템 구축 |
| 팀원 역할 병목 | 중간 | WBS 기반 명확한 담당자 분리 |
| 요구사항 변경 | 중간 | MVP 범위 고정, 추가 기능은 M4 이후 반영 |
| Unity 버전 호환성 | 낮음 | LTS 버전 고정 (Unity 2022 LTS) |
