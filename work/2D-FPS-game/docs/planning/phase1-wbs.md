# Phase 1 WBS — 물리 엔진 + 무기 시스템

> Handoff: [current-handoff.json](../handoffs/current-handoff.json)
> Task 데이터: [phase1-tasks.json](./phase1-tasks.json)

## 의존 관계

```
병렬 착수 (즉시)
  ├── T1: game-balance.json weapons 섹션
  ├── T2: WeaponConfig ↔ ProjectileConfig 연동
  ├── T4: BeamLogic 히트스캔
  └── T5: AirStrikeLogic 지연 폭격

T1+T2 완료 후
  ├── T3: WeaponInventoryLogic 확장
  └── T6: CombatRuntime 마이그레이션

T1~T6 완료 후
  └── T7: MainScene 물리 엔진 + 6종 무기 연동

T7 완료 후
  └── T8: HUD 무기 슬롯 + 폭발 범위

T7+T8 완료 후
  └── T9: 통합 테스트 + 빌드 검증
```

## Task 목록

| ID | 제목 | 담당 | 의존 | 상태 |
|----|------|------|------|------|
| T1 | game-balance.json weapons 섹션 추가 | app-developer | - | pending |
| T2 | WeaponConfig ↔ ProjectileConfig 연동 | app-developer | - | pending |
| T3 | WeaponInventoryLogic 다중 무기 확장 | app-developer | T1, T2 | pending |
| T4 | BeamLogic 히트스캔 레이캐스트 | app-developer | - | pending |
| T5 | AirStrikeLogic 지연 폭격 시퀀스 | app-developer | - | pending |
| T6 | CombatRuntime 마이그레이션 | app-developer | T2 | pending |
| T7 | MainScene 물리 엔진 + 무기 연동 | app-developer | T1~T6 | pending |
| T8 | HUD 무기 슬롯 + 폭발 범위 | frontend | T7 | pending |
| T9 | 통합 테스트 + 빌드 검증 | qa | T7, T8 | pending |

## 수용 기준

- 6종 무기 발사/전환 가능 (Carbine, Scatter, Bazooka, Grenade, Sniper, Air Strike)
- arc/bounce/beam/aoe-call 탄도 정상 동작
- 폭발 범위 데미지 감쇠 + 넉백 적용
- `npm run type-check && lint && test && build` 전부 통과
- 기존 매치 플로우 정상 유지
- [execution-report](../handoffs/current-execution-report.md) 작성 완료
