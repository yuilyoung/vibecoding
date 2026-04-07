# Phase 1 → Phase 2 이식 가이드

## 재사용 가능 (이식 비용 低)

| 항목 | 방법 |
|------|------|
| 게임 수치/밸런스 | `assets/data/*.json` → Unity `JsonUtility.FromJson<T>()` |
| 타일맵 | Tiled TMX/JSON → Unity Tilemap Importer |
| 스프라이트/오디오 | 그대로 임포트 |
| 백엔드 API | 동일 Supabase 엔드포인트 → C# UnityWebRequest |
| GDD | `docs/` 폴더 그대로 참조 |

## 재작성 필요 (이식 비용 高)

| 항목 | Phaser → Unity |
|------|----------------|
| 물리 (70%) | Arcade Physics → Rigidbody2D |
| 씬 관리 (30%) | `this.scene.start()` → `SceneManager.LoadScene()` |
| 입력 (20%) | `keyboard.on()` → `Input.GetKeyDown()` |
| 애니메이션 (40%) | Phaser AnimManager → Unity Animator |
| UI (25%) | GameObjects.Text → Canvas/UI |

## 이식을 쉽게 만드는 아키텍처 규칙

1. **게임 로직 ↔ 렌더링 분리 필수**
   - `PlayerLogic.ts` (순수 로직) vs `PlayerRenderer.ts` (Phaser 종속)
   - Unity에서는 로직 클래스만 C#으로 포팅

2. **모든 수치 데이터는 JSON으로 외부화**
   - 적 스탯, 레벨 구성, 아이템 값 — 코드에 하드코딩 금지

3. **엔진 종속 코드는 Adapter 패턴으로 격리**
   - `InputAdapter`, `PhysicsAdapter`로 Phaser API 래핑
   - 이식 시 Adapter만 교체

4. **Phaser 전용 기능 사용 자제**
   - Phaser는 렌더링/입력만 담당
   - Tween, Physics 제약조건 등 Phaser 전용 기능 X
