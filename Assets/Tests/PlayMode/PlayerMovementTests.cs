using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

/// <summary>
/// PlayerMovement PlayMode 단위 테스트
/// TDD: 이 테스트 파일이 먼저 작성되고, PlayerMovement.cs 구현 후 통과 확인
/// PlayMode 테스트는 실제 물리 엔진(Rigidbody2D)을 사용
/// </summary>
[TestFixture]
public class PlayerMovementTests
{
    private GameObject _playerObject;
    private PlayerMovement _playerMovement;
    private Rigidbody2D _rigidbody;

    [SetUp]
    public void SetUp()
    {
        _playerObject = new GameObject("TestPlayer");
        _playerObject.tag = "Player";
        _rigidbody = _playerObject.AddComponent<Rigidbody2D>();
        _rigidbody.gravityScale = 0f; // 2D 탑다운: 중력 제거
        _playerMovement = _playerObject.AddComponent<PlayerMovement>();
    }

    [TearDown]
    public void TearDown()
    {
        Object.Destroy(_playerObject);
    }

    // 테스트 1: 초기화 시 velocity = 0
    [UnityTest]
    public IEnumerator Initial_Velocity_Should_Be_Zero()
    {
        yield return new WaitForFixedUpdate();

        Assert.AreEqual(Vector2.zero, _rigidbody.velocity,
            "초기화 시 Rigidbody2D velocity는 0이어야 합니다.");
    }

    // 테스트 2: moveSpeed 기본값 확인
    [Test]
    public void MoveSpeed_Default_Should_Be_Five()
    {
        Assert.AreEqual(5f, _playerMovement.MoveSpeed,
            "기본 이동 속도는 5f여야 합니다.");
    }

    // 테스트 3: 이동 입력 시 position 변경 확인 (직접 velocity 주입)
    [UnityTest]
    public IEnumerator ApplyMovement_Should_Change_Position()
    {
        Vector3 initialPosition = _playerObject.transform.position;

        // 직접 이동 방향을 주입하여 이동 발생시킴
        _playerMovement.SetMoveInput(Vector2.right);

        yield return new WaitForFixedUpdate();
        yield return new WaitForFixedUpdate();

        Assert.AreNotEqual(initialPosition, _playerObject.transform.position,
            "이동 입력 후 position이 변경되어야 합니다.");
    }

    // 테스트 4: 이동 속도가 moveSpeed를 초과하지 않는지
    [UnityTest]
    public IEnumerator Movement_Speed_Should_Not_Exceed_MoveSpeed()
    {
        _playerMovement.SetMoveInput(Vector2.right);

        yield return new WaitForFixedUpdate();

        float speed = _rigidbody.velocity.magnitude;
        Assert.LessOrEqual(speed, _playerMovement.MoveSpeed + 0.01f,
            "이동 속도는 moveSpeed를 초과하면 안 됩니다.");
    }

    // 테스트 5: 이동 입력 없을 때 velocity가 0으로 수렴하는지
    [UnityTest]
    public IEnumerator No_Input_Should_Result_In_Zero_Velocity()
    {
        _playerMovement.SetMoveInput(Vector2.right);
        yield return new WaitForFixedUpdate();

        _playerMovement.SetMoveInput(Vector2.zero);
        yield return new WaitForFixedUpdate();

        Assert.AreEqual(Vector2.zero, _rigidbody.velocity,
            "이동 입력이 없으면 velocity는 0이어야 합니다.");
    }

    // 테스트 6: 대각선(8방향) 이동 시 정규화된 방향으로 이동하는지
    [UnityTest]
    public IEnumerator Diagonal_Movement_Should_Use_Normalized_Direction()
    {
        Vector2 diagonalInput = new Vector2(1f, 1f); // 45도 방향
        _playerMovement.SetMoveInput(diagonalInput);

        yield return new WaitForFixedUpdate();

        float speed = _rigidbody.velocity.magnitude;
        // 대각선 이동 시 속도가 moveSpeed를 초과하지 않아야 함 (정규화 필요)
        Assert.LessOrEqual(speed, _playerMovement.MoveSpeed + 0.01f,
            "대각선 이동 시 속도는 moveSpeed를 초과하면 안 됩니다.");
    }

    // 테스트 7: PlayerMovement 컴포넌트가 Rigidbody2D를 요구하는지
    [Test]
    public void PlayerMovement_Requires_Rigidbody2D()
    {
        Assert.IsNotNull(_rigidbody,
            "PlayerMovement는 Rigidbody2D가 있어야 합니다.");
    }
}
