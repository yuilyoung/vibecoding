# 환경·오브젝트 시스템 스펙

## Phase 2: 맵 오브젝트

### 인터랙티브 오브젝트 목록

| 오브젝트 | 동작 | 트리거 |
|----------|------|--------|
| **드럼통** | 피격 시 폭발 (범위 80px, 데미지 40), 체인 폭발 가능 | 총알/폭발 피격 |
| **지뢰** | 근접 시 1초 후 폭발 (범위 50px, 데미지 50) | 액터 접근 40px |
| **보급 상자** | 파괴 시 랜덤 아이템 드롭 (탄약/체력/무기) | 총알 피격 |
| **엄폐물(파괴형)** | HP 보유, 파괴 가능한 벽 | 총알/폭발 피격 |
| **바운스 벽** | 총알 반사 (bounce 탄도 전용) | 탄도 충돌 |
| **텔레포터** | 쌍으로 배치, 진입 시 상대 지점으로 이동 | 액터 접근 |

### 구현 계획

```typescript
// src/domain/map/MapObjectLogic.ts
interface MapObject {
  id: string;
  type: "barrel" | "mine" | "crate" | "cover" | "bounce-wall" | "teleporter";
  position: { x: number; y: number };
  health?: number;        // 파괴형만
  blastRadius?: number;   // 폭발형만
  blastDamage?: number;
  active: boolean;
}
```

### 체인 폭발 로직

```
드럼통 A 피격
  → ExplosionLogic 범위 체크
    → 범위 내 드럼통 B 발견
      → 드럼통 B 폭발 트리거 (0.15초 딜레이)
        → 연쇄 반복 (최대 깊이 5)
```

### 파일 변경 예상

| 파일 | 변경 |
|------|------|
| `src/domain/map/MapObjectLogic.ts` | 신규 — 오브젝트 상태 관리 |
| `src/domain/map/MapObjectRuntime.ts` | 신규 — 충돌/트리거 처리 |
| `src/domain/combat/ExplosionLogic.ts` | 확장 — 오브젝트 체인 폭발 |
| `assets/data/map-objects.json` | 신규 — 오브젝트 배치 데이터 |
| `tests/MapObjectLogic.test.ts` | 신규 |

---

## Phase 3: 환경 시스템

### 바람 시스템

| 항목 | 설명 |
|------|------|
| 방향 | 0~360도, 매 라운드 랜덤 또는 점진 변화 |
| 세기 | 0(무풍)~3(강풍), HUD에 화살표로 표시 |
| 영향 대상 | `arc`, `bounce` 탄도 (windMultiplier > 0인 투사체) |
| 영향 방식 | 매 프레임 `vx += windForce.x * multiplier * dt` |
| `linear`, `beam` | 영향 없음 (windMultiplier = 0) |

```typescript
// src/domain/environment/WindLogic.ts
interface WindState {
  angleDegrees: number;  // 0=오른쪽, 90=아래
  strength: number;      // 0~3
  forceX: number;        // 계산된 x 성분
  forceY: number;        // 계산된 y 성분
}
```

### 날씨 시스템

| 날씨 | 게임플레이 효과 | 시각 효과 |
|------|----------------|----------|
| **맑음** | 없음 (기본) | 밝은 조명 |
| **비** | 이동속도 -15%, 지뢰 비활성화 | 비 파티클, 어두운 톤 |
| **안개** | 시야 범위 축소 (300px→150px) | 포그 오버레이 |
| **사막풍** | 바람 세기 ×2, 모든 탄도에 약한 영향 | 모래 파티클 |
| **폭풍** | 바람 방향 매 5초 변경, 이속 -10% | 번개 플래시 |

```typescript
// src/domain/environment/WeatherLogic.ts
interface WeatherState {
  type: "clear" | "rain" | "fog" | "sandstorm" | "storm";
  movementMultiplier: number;  // 1.0 = 기본
  visionRange: number;         // px, 기본 300
  windStrengthMultiplier: number;
  duration: number;            // ms, 0 = 영구
}
```

### 라운드별 환경 변화

```
라운드 시작
  → WindLogic: 새 바람 방향/세기 결정
  → WeatherLogic: 날씨 결정 (랜덤 or 시퀀스)
  → HUD 업데이트: 바람 화살표 + 날씨 아이콘 표시
  → 전투 중: 바람/날씨가 실시간 영향
```

### 파일 변경 예상

| 파일 | 변경 |
|------|------|
| `src/domain/environment/WindLogic.ts` | 신규 — 바람 상태 관리 |
| `src/domain/environment/WeatherLogic.ts` | 신규 — 날씨 효과 관리 |
| `src/domain/combat/ProjectileRuntime.ts` | 확장 — 바람 영향 적용 |
| `src/domain/player/PlayerLogic.ts` | 확장 — 날씨별 이속 보정 |
| `src/scenes/MainScene.ts` | 확장 — 시야 제한, 파티클 효과 |
| `assets/data/game-balance.json` | 확장 — wind/weather 섹션 |
| `tests/WindLogic.test.ts` | 신규 |
| `tests/WeatherLogic.test.ts` | 신규 |

---

## Phase 5: 탈것 시스템 (후순위)

| 탈것 | 특성 |
|------|------|
| **탱크** | 이속 -30%, HP +200, 주포(arc, 고데미지) |
| **바이크** | 이속 +50%, HP 변동 없음, 사이드카 사격 |
| **포탑** | 고정 위치, 자동 조준, 높은 DPS |

### 탑승 로직

```
플레이어 → 탈것 근접 + E키
  → PlayerLogic 이동/무기 오버라이드
  → 탈것 HP가 0이 되면 강제 하차 + 폭발
  → 재탑승: 쿨다운 5초
```

탈것 상세 스펙은 Phase 1~3 완료 후 별도 문서로 작성한다.
