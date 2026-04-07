# FSD — 기능 상세 설계서

프로젝트: Unity 기반 4v4 2D FPS 게임
작성일: 2026-04-05
작성자: planner 에이전트

---

## 1. 문서 개요

본 문서는 Unity 기반 4v4 2D FPS 게임의 기능별 상세 설계를 기술한다.
각 기능의 화면 흐름, 상태 다이어그램, 입출력 명세, 예외 처리 시나리오를 포함한다.

---

## 2. 화면 흐름 (Screen Flow)

```
[메인 메뉴]
    │
    ├─ 게임 시작 → [로비 화면]
    │                  │
    │                  ├─ 방 생성 → [방 생성 모달] → [방 대기실]
    │                  └─ 방 참가 → [방 목록] → [방 대기실]
    │                                                │
    │                                                ├─ 팀 선택 (Red/Blue)
    │                                                ├─ 준비 완료 토글
    │                                                └─ 전원 준비 시 → [인트로 카운트다운]
    │                                                                     │
    │                                                                     └─ [게임 씬(전투)]
    │                                                                          │
    │                                                                          ├─ 라운드 진행
    │                                                                          ├─ 사망 시 → [사망 대기 화면]
    │                                                                          └─ 라운드 종료 → [라운드 결과 팝업]
    │                                                                               └─ 다음 라운드 또는 [최종 결과 화면]
    │                                                                                    │
    │                                                                                    └─ 로비 복귀 또는 재매칭
    │
    ├─ 설정 → [설정 화면]
    └─ 게임 종료
```

---

## 3. 기능 상세 설계

### 3.1 캐릭터 이동 시스템

#### 3.1.1 개요
- 컴포넌트: `PlayerMovement.cs`
- 입력: Keyboard (WASD / 화살표키)
- 출력: 캐릭터 위치 변경, 이동 방향 기반 애니메이션 상태 전환

#### 3.1.2 상태 다이어그램

```
[Idle]
  │
  ├─ 이동 키 입력 → [Moving]
  │                    │
  │                    └─ 장애물 충돌 → [Blocked] → 입력 유지 시 [Moving], 키 해제 시 [Idle]
  │
  └─ 사망 이벤트 → [Dead] (이동 불가)
```

#### 3.1.3 입출력 명세

| 항목 | 설명 |
|------|------|
| 입력 | Input.GetAxis("Horizontal"), Input.GetAxis("Vertical") |
| 이동 속도 | 5 units/sec (기본), 무기 장착 시 4~5 units/sec |
| 충돌 레이어 | "Wall", "Obstacle" 레이어와 충돌 시 이동 차단 |
| 회전 | atan2(mouseWorldPos - playerPos) 계산으로 회전각 결정 |

#### 3.1.4 예외 처리

| 예외 상황 | 처리 방식 |
|-----------|-----------|
| 대각선 이동 시 속도 과도 증가 | Vector2.normalized 적용하여 대각선 속도를 동일하게 유지 |
| 캐릭터 사망 상태에서 이동 키 입력 | `isDead` 플래그 체크, 입력 무시 |
| 씬 경계 이탈 시도 | 맵 경계 콜라이더 처리, 이탈 불가 |
| 네트워크 레이턴시로 인한 위치 오차 | 클라이언트 예측(Client Prediction) + 서버 보정(Reconciliation) |

---

### 3.2 무기 시스템

#### 3.2.1 개요
- 컴포넌트: `WeaponController.cs`, `BulletController.cs`
- 입력: 마우스 좌클릭 (발사), R키 (재장전), 숫자키 1-3 또는 마우스 휠 (무기 교체)
- 출력: 탄환 생성, 탄환 이동, 충돌 시 피해 처리

#### 3.2.2 무기 상태 다이어그램

```
[대기(Idle)]
  │
  ├─ 마우스 좌클릭 + 탄약 있음 → [발사(Firing)]
  │    └─ 발사 쿨다운 후 → [대기(Idle)]
  │
  ├─ 마우스 좌클릭 + 탄약 없음 → [빈 총 효과음] → [재장전(Reloading)]
  │
  ├─ R키 입력 + 탄약 부족 → [재장전(Reloading)]
  │    └─ 재장전 시간 경과 → [대기(Idle)]
  │
  └─ 무기 교체 키 입력 → [교체(Switching)]
       └─ 교체 완료 → [대기(Idle)]
```

#### 3.2.3 탄환 생성 및 이동

```
발사 이벤트 발생
  → Object Pool에서 Bullet 오브젝트 획득
  → 총구 위치(MuzzlePoint)에서 마우스 방향으로 Velocity 설정
  → Physics2D 처리 (Rigidbody2D 사용)
  → 충돌 감지 (OnTriggerEnter2D)
    → 적 캐릭터 레이어: IDamageable.TakeDamage(damage) 호출
    → 벽/장애물 레이어: Bullet 비활성화 (Pool 반환)
    → 사거리 초과 또는 일정 시간 경과: Bullet 비활성화
```

#### 3.2.4 무기별 상세 설계

**소총(Rifle)**
- 발사 방식: 반자동 (클릭당 1발) 또는 자동 (클릭 유지 시 연속 발사)
- 탄환 패턴: 단일 직선 탄
- 명중 영역 판정: OverlapCircle (탄환 반경 0.05)

**산탄총(Shotgun)**
- 발사 방식: 반자동 (클릭당 1회 발사)
- 탄환 패턴: 부채꼴 6발 동시 발사, 각도 편차 ±15도
- 사거리 제한: 10 units 초과 시 데미지 50% 감소

**저격총(Sniper)**
- 발사 방식: 반자동 (클릭당 1발)
- 탄환 패턴: 단일 직선 탄, 관통 (첫 번째 피격 대상만 데미지)
- 조준경 UI: 우클릭 시 줌인 (카메라 확대)

#### 3.2.5 예외 처리

| 예외 상황 | 처리 방식 |
|-----------|-----------|
| 재장전 중 발사 키 입력 | 무시 (isReloading 플래그 체크) |
| 이미 풀 탄창인 상태에서 R키 | 재장전 불필요 메시지 없이 무시 |
| 탄환 오브젝트 풀 부족 | 풀 크기 자동 확장 (MaxPoolSize 초과 시 로그 경고) |
| 동시 다중 발사 요청 (네트워크) | 서버에서 요청 순서대로 처리 |

---

### 3.3 HP 및 사망 시스템

#### 3.3.1 개요
- 컴포넌트: `HealthSystem.cs`
- 인터페이스: `IDamageable` (TakeDamage, Heal)

#### 3.3.2 HP 처리 흐름

```
TakeDamage(float damage) 호출
  → isDead 체크 (true면 무시)
  → currentHP = Mathf.Max(0, currentHP - damage)
  → OnHPChanged 이벤트 발생 (HUD 업데이트 트리거)
  → currentHP == 0 체크
    → true: OnDeath 이벤트 발생
      → 서버 권위 처리: ServerRpc → ClientRpc로 사망 상태 동기화
      → 캐릭터 비활성화 (콜라이더 비활성화, 이동 잠금)
      → TeamManager에 사망 알림 (전멸 체크)
```

#### 3.3.3 헤드샷 판정

```
탄환 충돌 영역 태그 확인
  → "HeadHitbox" 태그 → damage * 1.5 적용
  → "BodyHitbox" 태그 → damage * 1.0 적용
  → "LegHitbox" 태그 → damage * 0.75 적용 (선택적 구현)
```

#### 3.3.4 예외 처리

| 예외 상황 | 처리 방식 |
|-----------|-----------|
| 이미 사망한 캐릭터에 탄환 충돌 | isDead 체크로 TakeDamage 무시 |
| 음수 데미지 입력 (힐 오용 방지) | Mathf.Max(0, damage) 보정 |
| 동시 다중 피격 (네트워크 경쟁 조건) | 서버 권위 처리, NetworkVariable 사용 |

---

### 3.4 라운드 시스템

#### 3.4.1 개요
- 컴포넌트: `RoundManager.cs`
- 관계: TeamManager, UIManager, NetworkManager

#### 3.4.2 라운드 상태 다이어그램

```
[매치 시작]
    │
    ▼
[라운드 준비(Preparation)]
  - 카운트다운: 5초
  - 플레이어 이동/사격 잠금
    │
    ▼
[라운드 진행(InProgress)]
  - 플레이어 이동/사격 허용
  - 팀 전멸 감지
    │
    ├─ 한 팀 전멸 → [라운드 종료(RoundEnd)]
    │                 - 승리 팀 라운드 점수 +1
    │                 - 라운드 결과 팝업 표시 (3초)
    │                 - 스폰 초기화
    │
    │  최종 승자 없음              최종 승자 결정
    ▼                                   │
[다음 라운드 준비(Preparation)]    [매치 종료(MatchEnd)]
                                         - 결과 화면 표시
                                         - 로비 복귀 옵션
```

#### 3.4.3 승리 조건

- Best of 5 기준: 먼저 3라운드 획득 팀이 승리
- 동점 방지: 최대 5라운드 진행, 3라운드 달성 즉시 종료

#### 3.4.4 라운드 초기화 항목

| 초기화 대상 | 처리 내용 |
|------------|-----------|
| 플레이어 HP | 100으로 복구 |
| 플레이어 위치 | 팀별 스폰 포인트로 이동 |
| 탄약 | 기본 탄약으로 초기화 |
| 탄환 오브젝트 | 씬에 잔존하는 탄환 전부 제거 |
| 사망 상태 | 전원 isDead = false |

#### 3.4.5 예외 처리

| 예외 상황 | 처리 방식 |
|-----------|-----------|
| 라운드 중 플레이어 연결 끊김 | 해당 플레이어 사망 처리 후 계속 진행 |
| 두 팀 동시 전멸 (극단적 상황) | 라운드 무효 처리, 재진행 |
| 라운드 최대 시간 초과 | 생존 인원 더 많은 팀 승리, 동수 시 라운드 무효 |

---

### 3.5 네트워크 동기화 시스템

#### 3.5.1 개요
- 컴포넌트: `PlayerNetworkSync.cs`
- 프레임워크: Unity Netcode for GameObjects (NGO)
- 동기화 방식: 서버 권위 (Server Authority)

#### 3.5.2 동기화 항목 및 방법

| 데이터 | 동기화 방법 | 업데이트 주기 |
|--------|------------|--------------|
| 플레이어 위치 | NetworkTransform | 매 프레임 (보간 적용) |
| 플레이어 회전 | NetworkTransform | 매 프레임 |
| HP | NetworkVariable<float> | 변경 시 즉시 |
| 사망 상태 | NetworkVariable<bool> | 변경 시 즉시 |
| 탄환 발사 | ServerRpc → ClientRpc | 이벤트 발생 시 |
| 라운드 상태 | NetworkVariable<RoundState> | 변경 시 즉시 |

#### 3.5.3 클라이언트 예측 (Client Prediction)

```
클라이언트 입력 처리
  → 로컬에서 즉시 이동 적용 (예측)
  → 서버로 이동 입력 전송 (ServerRpc)
  → 서버에서 이동 처리 후 결과 반환 (ClientRpc)
  → 로컬 예측값과 서버 결과 비교
    → 오차 0.1 units 이하: 보간으로 자연스럽게 보정
    → 오차 0.1 units 초과: 즉시 서버 위치로 스냅
```

#### 3.5.4 예외 처리

| 예외 상황 | 처리 방식 |
|-----------|-----------|
| 호스트 연결 끊김 | 가장 낮은 클라이언트 ID로 호스트 이전 |
| 패킷 손실 (>5%) | 마지막 알려진 상태로 보간 유지 |
| 높은 레이턴시 (>200ms) | 화면에 연결 불안정 경고 표시 |
| 중복 RPC 수신 | Sequence Number 기반 중복 제거 |

---

### 3.6 로비 및 매칭 시스템

#### 3.6.1 화면 흐름

```
[로비 메인]
    │
    ├─ [방 생성 모달]
    │    - 방 이름 입력 (최대 20자)
    │    - 최대 인원 선택 (4/6/8)
    │    - 확인 → 방 대기실로 이동 (호스트)
    │
    └─ [방 목록 화면]
         - 방 목록 (이름, 현재/최대 인원, 상태)
         - 새로고침 버튼
         - 방 선택 후 참가 → 방 대기실로 이동
```

#### 3.6.2 방 대기실 상태

```
[방 대기실]
  - 플레이어 슬롯 8개 표시 (Red 4개 / Blue 4개)
  - 팀 변경 버튼 (균형 조건: 팀 인원 차이 1 이하)
  - 준비 완료 버튼 (토글)
  - 호스트: 게임 시작 버튼 (전원 준비 완료 시 활성화)
  - 채팅 입력창 (텍스트 채팅)
```

#### 3.6.3 예외 처리

| 예외 상황 | 처리 방식 |
|-----------|-----------|
| 방 참가 중 인원 초과 | "방이 가득 찼습니다" 메시지 후 방 목록 복귀 |
| 방 이름 중복 | 서버에서 고유 ID로 구분 (표시명 중복 허용) |
| 준비 완료 상태에서 팀 변경 | 준비 완료 자동 해제 후 팀 변경 |
| 한 팀이 0명인 상태에서 게임 시작 시도 | "팀 구성이 필요합니다" 경고, 시작 불가 |

---

### 3.7 HUD (Heads-Up Display)

#### 3.7.1 HUD 구성 요소 배치

```
┌─────────────────────────────────────────────┐
│ [팀 스코어]          [라운드 타이머]          │
│ Red 2 : 1 Blue                              │
│                                              │
│                                              │
│           [게임 뷰]                          │
│                                     [킬피드] │
│                                              │
│ [HP 바]    [무기 아이콘]   [탄약 표시]        │
│ ████░░  |  [소총]  |  30 / 90              │
└─────────────────────────────────────────────┘
```

#### 3.7.2 HP 바 상태 색상

| HP 비율 | 색상 |
|---------|------|
| 70% 이상 | 녹색 |
| 30%~70% | 노란색 |
| 30% 미만 | 빨간색 (점멸 효과) |

#### 3.7.3 킬 피드

- 최신 3건 표시, 오래된 항목부터 제거
- 형식: `[킬러 이름] ── [무기 아이콘] ──> [사망자 이름]`
- 표시 지속 시간: 4초 후 페이드 아웃

---

## 4. 데이터 구조

### 4.1 플레이어 데이터

```csharp
public class PlayerData
{
    public ulong ClientId;        // NGO 클라이언트 ID
    public string PlayerName;     // 플레이어 닉네임
    public TeamType Team;         // TeamType.Red / TeamType.Blue
    public int Kills;
    public int Deaths;
    public int Assists;
}
```

### 4.2 무기 데이터 (ScriptableObject)

```csharp
[CreateAssetMenu(menuName = "Weapons/WeaponData")]
public class WeaponData : ScriptableObject
{
    public string WeaponName;
    public float Damage;
    public float FireRate;        // 초당 발사 횟수
    public int MagazineSize;
    public int MaxAmmo;
    public float ReloadTime;      // 초
    public float BulletSpeed;
    public float Range;           // -1 = 무제한
    public int PelletCount;       // 산탄총용
    public float SpreadAngle;     // 산탄총 산개 각도
    public bool IsPiercing;       // 저격총 관통 여부
}
```

### 4.3 라운드 상태

```csharp
public enum RoundState
{
    WaitingForPlayers,
    Preparation,
    InProgress,
    RoundEnd,
    MatchEnd
}
```

### 4.4 팀 타입

```csharp
public enum TeamType
{
    None,
    Red,
    Blue
}
```

---

## 5. 씬 구조

```
Assets/
  Scenes/
    MainMenu.unity          // 메인 메뉴
    Lobby.unity             // 로비 및 방 대기실
    Map_01.unity            // 실내형 맵
    Map_02.unity            // 실외형 맵
    Prototype.unity         // 개발 테스트용 씬

  Scripts/
    Player/
      PlayerMovement.cs
      PlayerController.cs
    Combat/
      WeaponController.cs
      BulletController.cs
      HealthSystem.cs
    Team/
      TeamManager.cs
    GameManager/
      RoundManager.cs
      GameManager.cs
    Network/
      NetworkManager.cs
      PlayerNetworkSync.cs
    Lobby/
      LobbyManager.cs
      RoomManager.cs
    UI/
      HUDController.cs
      LobbyUIController.cs
      ResultUIController.cs
    Data/
      WeaponData.cs (ScriptableObject)
      PlayerData.cs

  Prefabs/
    Player/
      Player_Red.prefab
      Player_Blue.prefab
    Weapons/
      Bullet.prefab
    UI/
      HUD.prefab
      KillFeed.prefab

  ScriptableObjects/
    Weapons/
      Rifle.asset
      Shotgun.asset
      Sniper.asset
```

---

## 6. 이벤트 시스템

| 이벤트 | 발신자 | 수신자 | 설명 |
|--------|--------|--------|------|
| OnPlayerDead | HealthSystem | TeamManager, RoundManager, UIManager | 플레이어 사망 알림 |
| OnRoundEnd | RoundManager | UIManager, TeamManager | 라운드 종료 및 결과 |
| OnMatchEnd | RoundManager | UIManager | 매치 종료 |
| OnHPChanged | HealthSystem | HUDController | HP 변화 → HUD 업데이트 |
| OnAmmoChanged | WeaponController | HUDController | 탄약 변화 → HUD 업데이트 |
| OnKillEvent | HealthSystem | HUDController (킬 피드) | 킬 발생 알림 |

모든 이벤트는 C# 표준 event 패턴 또는 Unity 이벤트 시스템(UnityEvent)을 사용한다.
네트워크 이벤트는 NGO의 ServerRpc / ClientRpc를 통해 동기화한다.
