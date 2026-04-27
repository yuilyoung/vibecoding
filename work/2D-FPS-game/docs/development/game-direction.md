# 게임 방향성: 브롤스타즈 + 웜즈 하이브리드

## 컨셉

탑다운 실시간 팀전 슈터(브롤스타즈)를 기본으로, 웜즈/포트리스의 무기 다양성·환경 시스템·오브젝트 상호작용을 결합한다.

## 유지하는 것

- 탑다운 시점
- 실시간 전투 (턴제 아님)
- 팀전 구조 (BLUE vs RED)
- Phaser 3 엔진 (2D)
- 기존 매치 플로우 (stage-entry → team-select → deploy → combat)

## 웜즈에서 가져오는 것

| 시스템 | 설명 |
|--------|------|
| 무기 다양성 | 포물선 탄도, 바운스, 확산, 범위 폭격 등 6종+ |
| 폭발 오브젝트 | 드럼통, 지뢰, 보급 상자 |
| 바람 시스템 | 투사체 궤적에 실시간 영향 |
| 날씨 효과 | 비(이속 감소), 안개(시야 제한), 사막풍(탄도 편향) |
| 탈것 | 탱크, 바이크 등 탑승 가능 오브젝트 (후순위) |

## 웜즈에서 빼는 것

| 시스템 | 이유 |
|--------|------|
| 지형 파괴 | 탑다운 뷰에서 비트맵 파괴는 비용 대비 효과 낮음 |
| 사이드뷰 전환 | 코드 전면 재작성 필요, 현재 구조와 비호환 |
| 턴제 | 실시간 유지 확정 |

## 우선순위 로드맵

```
Phase 1 — 물리 엔진 + 무기 시스템 (기반)
Phase 2 — 맵 오브젝트 + 폭발 체인 (인터랙션)
Phase 3 — 환경 시스템: 바람·날씨 (게임플레이 깊이)
Phase 4 — 비주얼 에셋 교체 (사용자 경험)
Phase 5 — 탈것 시스템 (확장)
```

## 현재 실행 로드맵 (2026-04-27 갱신)

실제 워크스페이스 기준으로는 Phase 6까지 완료되었고, 다음 실행 페이즈는 아래와 같이 정리한다.

```
Phase 6 — Wind/Weather hardening + zone/effective weather + refactor (completed)
Phase 7 — Tactical Combat Depth
  - bot intent states: pressure / hold / retreat / flank
  - cover-aware positioning and retreat anchors
  - weapon-role clarity and bot weapon selection
  - deterministic playtest and tuning loop
Phase 8 후보
  - environment audio polish
  - asset/UI readability pass
  - vehicle system or progression expansion
```

## Phase 7 방향

- 목표는 기능 수를 늘리는 것이 아니라 전투 판단의 질을 올리는 것이다.
- 핵심 페르소나는 "짧은 세션에서도 전투 의도가 읽히는 탑다운 슈터를 원하는 플레이어"다.
- 설계 원칙:
  - AI와 무기 판단은 `game-balance.json`에서 조정 가능해야 한다.
  - domain 로직은 Phaser 비의존을 유지한다.
  - weather/wind 등 Phase 6 시스템은 Tactical Combat Depth의 입력값으로 재사용한다.
  - 테스트와 플레이테스트 로그 없이 밸런스 조정만 먼저 하지 않는다.

## Phase 7 공통 용어

- `tactical.intent`: `pressure | hold | retreat | flank`
- `tactical.targetCoverIndex`: 더미가 노리는 커버 슬롯 인덱스, 없으면 `null`
- `tactical.targetCoverEffect`: `vision-jam | shield | repair | null`
- `tactical.chosenWeaponId`: 현재 더미가 선택한 무기 ID
- `tactical.chosenWeaponRole`: 무기 역할 요약값

QA, 밸런스 조정, 이후 에이전트 작업은 위 필드명을 그대로 사용한다.

## 상세 스펙

- [무기 시스템 스펙](./weapon-systems.md)
- [환경·오브젝트 시스템 스펙](./environment-systems.md)
