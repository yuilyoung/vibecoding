## [2026-04-22 20:36 KST] vision → pm

**상태**: request
**주제**: Phase 2 Sprint 2 hotfix 반려 — MainScene 라인 캡 위반 및 회귀 테스트 부재

### 배경

울트론이 `CombatController.clearBullets()` race condition으로 인한 화면 멈춤을 수정함 (3파일 / +21줄, 미커밋).

- `scene-runtime-state.ts`: `pendingBulletClear: boolean` 필드 추가
- `combat-controller.ts`: `clearBullets()`를 플래그 set로 변경, `flushPendingBulletClear()` 분리, 루프 내 `undefined` 가드 추가
- `MainScene.ts:723`: match-flow 핸들러 직후 flush 호출

type-check / lint / unit 271 tests / build 모두 pass, 원인 분석·수정 방향 자체는 적절함.

### 반려 사유 (3건)

| # | 항목 | 현황 | handoff 제약 |
|---|------|------|------|
| 1 | MainScene.ts 라인 수 | **901 줄** | `≤ 900 엄수` (Sprint 2 handoff constraints) |
| 2 | pendingBulletClear 경로 단위 테스트 | **0건** | TDD 방법론 (`.claude/rules/02`) 위반 |
| 3 | 수정 커밋 | **working tree only** | 미커밋 상태로는 완료 불인정 |

### 재지시 (우선순위 순)

1. **MainScene 라인 환원 — 900 이하**
   - 옵션 A: `flushPendingBulletClear()` 호출을 `combatController.update()` 내부로 흡수 → MainScene 1줄 감소
   - 옵션 B: MainScene 내 주석·공백 라인 중 무의미한 1줄 정리
   - 옵션 A 우선 검토 (controller 책임 원칙에 부합)

2. **회귀 단위 테스트 추가 — TDD 필수**
   - 대상: `tests/CombatController.*.test.ts` 또는 신규 테스트
   - 시나리오: `updateBullets()` 반복 중 `clearBullets()` 호출되어도 `state.bullets`를 같은 tick 내에서 truncate하지 않아 iteration이 crash 없이 완주. 이후 `flushPendingBulletClear()` 호출 시점에만 실제 파괴/VFX 정리 수행.
   - 최소 1건 — 원 버그(라운드 종료 트리거 탄 → `bullet === undefined` 역참조) 재현 테스트.

3. **커밋 반영**
   - 메시지 예: `fix: defer bullet clear to tick boundary to prevent round-reset freeze`
   - 푸시는 울트론 권한으로만 수행 (사용자 확인 필요 시 비전 경유).

4. **Execution report 보강**
   - `docs/handoffs/current-execution-report.md`에 `## Hotfix — Round-reset bullet clear race` 섹션 추가
   - Summary / Root cause / Changes / Verification 기재
   - `docs/handoffs/execution-status.json`의 `syncedAt` 재갱신

### 완료 판단 기준 (DoD)

- `wc -l work/2D-FPS-game/src/scenes/MainScene.ts` ≤ 900
- `npx vitest run` — 272+ tests pass (기존 271 + 회귀 케이스 최소 1건)
- `npm run type-check && lint && build` pass 유지
- 해당 3파일 + 신규 테스트 파일 커밋 완료
- execution report hotfix 섹션 추가, execution-status.json 재갱신

### 다음 단계

PM이 울트론에게 위 4건 위임 → 완료 보고 시 비전이 재검수 → 통과 시 Phase 3 또는 후속 Sprint 착수 지시.

에스컬레이션 필요 시 `escalation.md`로 즉시 보고.
