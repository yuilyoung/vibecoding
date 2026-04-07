# API 계약 설계서

프로젝트: Unity 기반 4v4 2D FPS 게임
작성일: 2026-04-05
작성자: architect 에이전트
버전: v1.0

---

## 1. 문서 개요

본 문서는 클라이언트-서버 간 네트워크 메시지 명세를 정의한다.
Unity Netcode for GameObjects(NGO)의 ServerRpc / ClientRpc / NetworkVariable을 사용하며,
UGS Lobby / Relay REST API 연동 명세를 포함한다.

---

## 2. NGO 메시지 설계 원칙

| 원칙 | 내용 |
|------|------|
| 서버 권위 | 이동 검증, 데미지 계산, 팀 배정, 라운드 상태는 서버(호스트)가 단독 결정 |
| ServerRpc | 클라이언트 → 서버 요청 (소유자 클라이언트만 호출 가능) |
| ClientRpc | 서버 → 모든/특정 클라이언트 알림 |
| NetworkVariable | 서버 소유, 자동 동기화; 클라이언트는 읽기 전용 |
| 입력 검증 | ServerRpc 수신 시 입력값 범위 및 속도 검증, 비정상 값 즉시 거부 |

---

## 3. PlayerMovement — 이동 동기화

### 3.1 NetworkVariable (자동 동기화)

| 변수명 | 타입 | 소유자 | 설명 |
|--------|------|--------|------|
| `NetworkPosition` | `NetworkVariable<Vector2>` | 서버 | 서버 확정 위치 (NetworkTransform 사용) |
| `NetworkRotation` | `NetworkVariable<float>` | 서버 | 캐릭터 조준 각도 (라디안) |

NetworkTransform 컴포넌트가 위치·회전을 매 프레임 자동 동기화하므로 별도 RPC 불필요.

### 3.2 ServerRpc — 이동 입력 전달

```csharp
[ServerRpc]
public void MoveInputServerRpc(Vector2 moveInput, float aimAngle, ServerRpcParams rpcParams = default)
```

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| moveInput | Vector2 | 정규화된 이동 방향 (-1~1, 대각선 normalized) |
| aimAngle | float | 마우스 조준 각도 (라디안) |

**서버 검증 항목:**
- `moveInput.magnitude` > 1.01f → 거부 (비정상 속도)
- 이동 후 위치가 맵 경계 초과 → 보정 후 적용

### 3.3 클라이언트 예측 흐름

```
클라이언트:
  1. 입력 즉시 로컬 이동 적용 (예측)
  2. MoveInputServerRpc 호출

서버:
  3. 이동 검증 후 서버 위치 갱신
  4. NetworkTransform이 클라이언트에 자동 동기화

클라이언트:
  5. 서버 위치와 로컬 예측 위치 비교
     - 오차 <= 0.1 units: 보간으로 자연스럽게 보정
     - 오차 > 0.1 units: 서버 위치로 즉시 스냅
```

---

## 4. WeaponController — 발사 및 재장전

### 4.1 NetworkVariable

| 변수명 | 타입 | 소유자 | 설명 |
|--------|------|--------|------|
| `CurrentAmmo` | `NetworkVariable<int>` | 서버 | 현재 탄창 탄약 수 |
| `ReserveAmmo` | `NetworkVariable<int>` | 서버 | 보유 예비 탄약 수 |
| `IsReloading` | `NetworkVariable<bool>` | 서버 | 재장전 중 여부 |
| `EquippedWeaponIndex` | `NetworkVariable<int>` | 서버 | 장착 무기 인덱스 (0=소총, 1=산탄총, 2=저격총) |

### 4.2 ServerRpc — 발사 요청

```csharp
[ServerRpc]
public void FireWeaponServerRpc(Vector2 fireDirection, ServerRpcParams rpcParams = default)
```

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| fireDirection | Vector2 | 발사 방향 (정규화된 Vector2) |

**서버 검증 항목:**
- `IsReloading.Value == true` → 거부
- `CurrentAmmo.Value <= 0` → 자동 재장전 트리거
- `fireDirection.magnitude` 범위 확인

**서버 처리 흐름:**
```
1. 검증 통과 → CurrentAmmo -1
2. 탄환 생성 (서버에서 Spawn)
3. SpawnBulletClientRpc 호출 → 모든 클라이언트에 탄환 시각 효과
4. 서버에서 Physics2D 레이캐스트로 즉각 충돌 판정 (선택적)
```

### 4.3 ClientRpc — 발사 효과 동기화

```csharp
[ClientRpc]
public void SpawnBulletClientRpc(Vector2 origin, Vector2 direction, string weaponName, ClientRpcParams rpcParams = default)
```

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| origin | Vector2 | 총구 위치 |
| direction | Vector2 | 발사 방향 |
| weaponName | string | 무기 이름 (사운드 재생 분기용) |

### 4.4 ServerRpc — 재장전 요청

```csharp
[ServerRpc]
public void ReloadWeaponServerRpc(ServerRpcParams rpcParams = default)
```

**서버 처리:**
- `IsReloading.Value == true` → 중복 무시
- `CurrentAmmo.Value == MagazineSize` → 무시 (풀 탄창)
- `ReserveAmmo.Value <= 0` → 무시 (예비 탄약 없음)
- 그 외: 재장전 코루틴 시작, `IsReloading = true`
- 재장전 완료: 탄약 이전, `IsReloading = false`

---

## 5. HealthSystem — HP 및 사망

### 5.1 NetworkVariable

| 변수명 | 타입 | 소유자 | 설명 |
|--------|------|--------|------|
| `CurrentHP` | `NetworkVariable<float>` | 서버 | 현재 HP (0~100) |
| `IsDead` | `NetworkVariable<bool>` | 서버 | 사망 여부 |

### 5.2 ServerRpc — 피해 요청 (내부 호출)

```csharp
[ServerRpc(RequireOwnership = false)]
public void TakeDamageServerRpc(float damage, ulong attackerClientId, string weaponName, ServerRpcParams rpcParams = default)
```

BulletController가 충돌 감지 후 서버에서 직접 호출 (RequireOwnership = false).

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| damage | float | 적용할 데미지 값 (헤드샷 배율 포함, 서버에서 재계산) |
| attackerClientId | ulong | 공격자 클라이언트 ID (킬 이벤트 기록용) |
| weaponName | string | 사용 무기 이름 (킬 피드용) |

**서버 처리:**
```
1. IsDead 체크 → true면 무시
2. 팀킬 체크 → 동일 팀이면 무시
3. damage 범위 검증 (0 < damage <= 200)
4. CurrentHP = Mathf.Max(0, CurrentHP - damage)
5. OnHPChanged → 자동 동기화 (NetworkVariable)
6. CurrentHP == 0 → IsDead = true → OnPlayerDeadClientRpc 호출
```

### 5.3 ClientRpc — 사망 알림

```csharp
[ClientRpc]
public void OnPlayerDeadClientRpc(ulong killerClientId, string weaponName, ClientRpcParams rpcParams = default)
```

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| killerClientId | ulong | 킬러 클라이언트 ID |
| weaponName | string | 사용 무기 이름 |

수신 처리: 킬 피드 UI 업데이트, 사망 사운드 재생, 사망 애니메이션 트리거

---

## 6. RoundManager — 라운드 상태

### 6.1 NetworkVariable

| 변수명 | 타입 | 소유자 | 설명 |
|--------|------|--------|------|
| `CurrentRoundState` | `NetworkVariable<RoundState>` | 서버 | 현재 라운드 상태 |
| `RedTeamRoundWins` | `NetworkVariable<int>` | 서버 | Red 팀 획득 라운드 수 |
| `BlueTeamRoundWins` | `NetworkVariable<int>` | 서버 | Blue 팀 획득 라운드 수 |
| `CurrentRoundNumber` | `NetworkVariable<int>` | 서버 | 현재 라운드 번호 |
| `CountdownSeconds` | `NetworkVariable<int>` | 서버 | 준비 카운트다운 초 |

### 6.2 ClientRpc — 라운드 종료 알림

```csharp
[ClientRpc]
public void OnRoundEndClientRpc(TeamType winnerTeam, int redWins, int blueWins, ClientRpcParams rpcParams = default)
```

수신 처리: 라운드 결과 팝업 표시 (3초), 스코어 HUD 업데이트

### 6.3 ClientRpc — 매치 종료 알림

```csharp
[ClientRpc]
public void OnMatchEndClientRpc(TeamType winnerTeam, ClientRpcParams rpcParams = default)
```

수신 처리: 결과 화면 전환, KDA 스코어보드 표시

### 6.4 ClientRpc — 라운드 초기화 알림

```csharp
[ClientRpc]
public void OnRoundResetClientRpc(Vector2[] redSpawnPositions, Vector2[] blueSpawnPositions, ClientRpcParams rpcParams = default)
```

수신 처리: 플레이어 위치 스폰 포인트로 이동, HP/탄약 초기화 UI 갱신

---

## 7. TeamManager — 팀 배정

### 7.1 ServerRpc — 팀 변경 요청

```csharp
[ServerRpc]
public void RequestTeamChangeServerRpc(ServerRpcParams rpcParams = default)
```

**서버 검증:**
- 현재 팀의 반대 팀 빈 슬롯 여부 확인
- 빈 슬롯 없으면 거부 → `TeamChangeRejectedClientRpc` 호출
- 빈 슬롯 있으면 팀 변경 → `IsReady = false` 자동 해제 → `TeamChangedClientRpc` 호출

### 7.2 ClientRpc — 팀 변경 결과

```csharp
[ClientRpc]
public void TeamChangedClientRpc(ulong targetClientId, TeamType newTeam, ClientRpcParams rpcParams = default)
```

```csharp
[ClientRpc]
public void TeamChangeRejectedClientRpc(ulong targetClientId, ClientRpcParams rpcParams = default)
```

---

## 8. LobbyManager — UGS Lobby API 연동

UGS Lobby API는 HTTP REST 방식으로 UGS SDK를 통해 호출한다.

### 8.1 방 생성

```
POST UGS Lobby CreateLobby
  Request:
    - lobbyName: string (최대 20자)
    - maxPlayers: int (4/6/8)
    - isPrivate: false
    - data: { "status": "Waiting" }
  Response:
    - lobbyId: string
    - joinCode: string (방 탐색용)
```

### 8.2 방 목록 조회 (5초 주기 갱신)

```
GET UGS Lobby QueryLobbies
  Filter:
    - status == "Waiting"
    - availableSlots > 0
  Response:
    - results: Array<LobbyData>
      - lobbyId, name, maxPlayers, availableSlots, status
```

### 8.3 방 참가

```
POST UGS Lobby JoinLobbyById
  Request:
    - lobbyId: string
  Response:
    - lobby: LobbyData
    - relayJoinCode: string (Relay 연결용)
```

### 8.4 빠른 매칭 (QuickJoin)

```
POST UGS Lobby QuickJoinLobby
  Filter:
    - status == "Waiting"
    - availableSlots > 0
  Response:
    - lobby: LobbyData (기존 방) 또는 신규 방 자동 생성
```

### 8.5 Relay 연결 흐름

```
호스트:
  1. UGS Relay CreateAllocation → allocationId, joinCode 발급
  2. Lobby 데이터에 relayJoinCode 저장
  3. NGO NetworkManager.StartHost(relayServerData)

클라이언트:
  1. Lobby에서 relayJoinCode 조회
  2. UGS Relay JoinAllocation(joinCode)
  3. NGO NetworkManager.StartClient(relayServerData)
```

---

## 9. 이벤트 시스템 요약

| 이벤트 | 발신자 | 수신자 | 전달 방식 |
|--------|--------|--------|---------|
| 발사 효과 | 서버(WeaponController) | 모든 클라이언트 | ClientRpc |
| HP 변경 | 서버(HealthSystem) | 모든 클라이언트 | NetworkVariable 자동 동기화 |
| 사망 알림 | 서버(HealthSystem) | 모든 클라이언트 | ClientRpc (킬 피드 포함) |
| 라운드 상태 | 서버(RoundManager) | 모든 클라이언트 | NetworkVariable 자동 동기화 |
| 라운드 종료 | 서버(RoundManager) | 모든 클라이언트 | ClientRpc |
| 팀 변경 결과 | 서버(TeamManager) | 모든 클라이언트 | ClientRpc |
| 방 목록 갱신 | UGS Lobby API | 클라이언트 | Polling (5초 주기) |

---

## 10. 에러 코드 정의

| 코드 | 의미 | 처리 |
|------|------|------|
| E001 | 이동 속도 초과 | 서버 거부, 클라이언트 경고 없음 (자동 보정) |
| E002 | 팀킬 시도 | 서버 무시 |
| E003 | 재장전 중 발사 | 서버 거부 |
| E004 | 빈 탄창 발사 | 자동 재장전 트리거 |
| E005 | 팀 변경 불가 (빈 슬롯 없음) | TeamChangeRejectedClientRpc |
| E006 | 방 가득 참 | JoinLobby 실패 → UI 안내 메시지 |
| E007 | UGS 서비스 장애 | 재시도 3회 후 LAN 폴백 안내 |
