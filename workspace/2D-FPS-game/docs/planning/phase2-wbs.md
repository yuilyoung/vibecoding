# Phase 2 WBS — AI 고도화 + 진행도/언락 + 스테이지 로테이션

> Handoff: [current-handoff.json](../../../../docs/handoffs/current-handoff.json)
> Task 데이터: [phase2-tasks.json](./phase2-tasks.json)
> Phase 1 아카이브: root handoff archive removed during harness consolidation.

## 의존 관계

```
병렬 착수 (즉시)
  ├── T1: AiStateMachine
  ├── T2: LineOfSightLogic
  ├── T3: StageDefinition + StageRotationLogic
  ├── T4: ProgressionLogic (XP/레벨)
  ├── T7: HomingLogic
  └── T10: phaser-vendor 번들 분할

T4 완료 후
  ├── T5: UnlockLogic
  └── T6: ProgressionStorage

T1~T7 완료 후
  └── T8: MainScene Phase 2 통합

T8 완료 후
  └── T9: HUD 개선

T8+T9+T10 완료 후
  └── T11: 검증 게이트 + execution report
```

## Task 목록

| ID | 제목 | 담당 | 의존 | 상태 |
|----|------|------|------|------|
| T1 | AiStateMachine 순수 로직 | app-developer | - | pending |
| T2 | LineOfSightLogic 시야선/엄폐 | app-developer | - | pending |
| T3 | StageDefinition + StageRotationLogic | app-developer | - | pending |
| T4 | ProgressionLogic (XP/레벨) | app-developer | - | pending |
| T5 | UnlockLogic 무기 언락 | app-developer | T4 | pending |
| T6 | ProgressionStorage localStorage | app-developer | T4 | pending |
| T7 | HomingLogic 유도 탄도 타겟팅 | app-developer | - | pending |
| T8 | MainScene Phase 2 통합 | app-developer | T1~T7 | pending |
| T9 | HUD 개선 (XP/언락/폭발 범위) | frontend | T8 | pending |
| T10 | phaser-vendor 번들 분할 | devops | - | pending |
| T11 | 검증 게이트 + execution report | qa | T8, T9, T10 | pending |

## 수용 기준

- AI 상태머신(idle/patrol/chase/attack/retreat) + 시야선/엄폐 판정
- Homing 탄도 타겟 선정 + 조향 제한 적용
- XP/레벨 시스템 + 기본 2종 → 레벨 기반 4종 언락
- localStorage 진행도 영속화 (새로고침 유지)
- 최소 3개 스테이지 로테이션
- HUD: XP 바, 레벨, 언락 토스트, 폭발 범위 프리뷰
- phaser-vendor chunk < 800 kB (gzip < 250 kB)
- `npm run type-check && lint && test && build` 전부 통과
- 기존 117 테스트 + Phase 2 신규 테스트 전부 pass
- [execution-report](../../../../docs/handoffs/current-execution-report.md) 작성 완료
