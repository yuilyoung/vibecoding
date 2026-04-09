# 무기 시스템 스펙

## 현재 상태

- 2종: Carbine(직선, 단발), Scatter(확산, 3펠릿)
- 직선 탄도만 지원, `WeaponLogic` 클래스가 발사율/탄약/재장전 관리
- 포물선, 바운스, 범위 폭발 없음

## 목표

웜즈식 무기 다양성 + 브롤스타즈식 실시간 운용. 최소 6종 무기.

## 탄도 유형 (새로 구현 필요)

| 유형 | 설명 | 적용 무기 |
|------|------|----------|
| `linear` | 직선 (현재) | Carbine, Scatter |
| `arc` | 포물선 — 중력 영향, 바람 영향 | Bazooka, Mortar |
| `bounce` | 벽/지형에 반사 | Grenade, Bouncer |
| `homing` | 목표 추적 (약한 유도) | Guided Missile |
| `aoe-call` | 지정 좌표에 범위 폭격 | Air Strike, Napalm |
| `beam` | 즉발 직선 히트스캔 | Laser, Sniper |

## 무기 목록

### Phase 1 (핵심 6종)

| 무기 | 탄도 | 데미지 | 특수 효과 |
|------|------|--------|----------|
| **Carbine** | linear | 20 | 기존 유지, 안정적 DPS |
| **Scatter** | linear | 12×3 | 기존 유지, 근거리 강력 |
| **Bazooka** | arc | 45 | 폭발 범위 60px, 넉백 |
| **Grenade** | bounce | 35 | 2회 반사 후 폭발, 범위 50px |
| **Sniper** | beam | 55 | 히트스캔, 긴 쿨다운 2초 |
| **Air Strike** | aoe-call | 30×5 | 지정 좌표에 5발 순차 폭격, 쿨다운 15초 |

### Phase 5 (확장)

| 무기 | 탄도 | 특수 효과 |
|------|------|----------|
| Mortar | arc | 높은 포물선, 장애물 너머 공격 |
| Guided Missile | homing | 발사 후 마우스로 유도 |
| Napalm | aoe-call | 범위에 지속 화염 지대 생성 |
| Bouncer | bounce | 3회 반사, 좁은 공간에서 강력 |
| EMP | aoe-call | 데미지 없음, 범위 내 적 3초 이속 50% 감소 |

## 구현 계획

### 1. ProjectileType 인터페이스 추가 (`src/domain/combat/`)

```typescript
interface ProjectileConfig {
  trajectory: "linear" | "arc" | "bounce" | "homing" | "aoe-call" | "beam";
  speed: number;
  gravity?: number;        // arc 전용
  bounceCount?: number;    // bounce 전용
  homingStrength?: number; // homing 전용
  blastRadius?: number;    // 폭발 무기
  knockback?: number;      // 넉백 거리 (px)
  windMultiplier?: number; // 바람 영향 계수 (0=무시, 1=전체)
}
```

### 2. WeaponLogic 확장

- 기존 `WeaponConfig`에 `projectile: ProjectileConfig` 필드 추가
- `tryFire()`는 유지, 탄도 처리는 새로운 `ProjectileRuntime`에 위임

### 3. ProjectileRuntime 신규 (`src/domain/combat/`)

- 프레임마다 탄도 유형별 위치 갱신
- `arc`: `vy += gravity * dt`, `vx += wind * windMultiplier * dt`
- `bounce`: 장애물 충돌 시 반사 벡터 계산, bounceCount 차감
- `homing`: 매 프레임 목표 방향으로 각도 보정
- `beam`: 즉발 레이캐스트, 첫 충돌 지점에 데미지
- `aoe-call`: 지연 후 지정 좌표에 폭발 시퀀스

### 4. ExplosionLogic 신규 (`src/domain/combat/`)

- 범위 내 모든 액터에 데미지 + 넉백 적용
- 거리 기반 데미지 감쇠: `damage * (1 - dist / blastRadius)`
- 오브젝트 체인 폭발 트리거 (드럼통 등)

### 5. 물리 엔진 활성화

- Phaser Arcade Physics 활성화 (`physics: { default: "arcade" }`)
- `arc` 탄도에 gravity 적용
- 넉백: 폭발 중심에서 바깥 방향 impulse

### 6. game-balance.json 확장

```json
{
  "weapons": {
    "carbine": { "trajectory": "linear", "damage": 20, ... },
    "bazooka": { "trajectory": "arc", "gravity": 300, "blastRadius": 60, ... }
  }
}
```

## 파일 변경 예상

| 파일 | 변경 |
|------|------|
| `src/domain/combat/ProjectileRuntime.ts` | 신규 — 탄도 유형별 물리 |
| `src/domain/combat/ExplosionLogic.ts` | 신규 — 범위 폭발 + 넉백 |
| `src/domain/combat/WeaponLogic.ts` | 확장 — ProjectileConfig 연동 |
| `src/domain/combat/WeaponInventoryLogic.ts` | 확장 — 6종 슬롯 관리 |
| `src/scenes/MainScene.ts` | 수정 — 물리 엔진, 탄도 렌더링 |
| `assets/data/game-balance.json` | 확장 — weapons 섹션 추가 |
| `tests/ProjectileRuntime.test.ts` | 신규 — 탄도 단위 테스트 |
| `tests/ExplosionLogic.test.ts` | 신규 — 폭발 단위 테스트 |
