using NUnit.Framework;
using UnityEngine;
using UnityEngine.Events;

/// <summary>
/// HealthSystem EditMode 단위 테스트
/// TDD: 이 테스트 파일이 먼저 작성되고, HealthSystem.cs 구현 후 통과 확인
/// 커버리지 목표: 80% 이상
/// </summary>
[TestFixture]
public class HealthSystemTests
{
    private GameObject _gameObject;
    private HealthSystem _healthSystem;

    [SetUp]
    public void SetUp()
    {
        _gameObject = new GameObject("TestPlayer");
        _healthSystem = _gameObject.AddComponent<HealthSystem>();
    }

    [TearDown]
    public void TearDown()
    {
        Object.DestroyImmediate(_gameObject);
    }

    // 테스트 1: 초기 HP가 maxHP와 동일한지
    [Test]
    public void InitialHP_Should_Equal_MaxHP()
    {
        Assert.AreEqual(_healthSystem.MaxHP, _healthSystem.CurrentHP,
            "초기 CurrentHP는 MaxHP와 동일해야 합니다.");
    }

    // 테스트 2: 초기 MaxHP가 100인지
    [Test]
    public void MaxHP_Should_Be_100_By_Default()
    {
        Assert.AreEqual(100f, _healthSystem.MaxHP,
            "기본 MaxHP는 100이어야 합니다.");
    }

    // 테스트 3: TakeDamage 호출 시 HP 감소 확인
    [Test]
    public void TakeDamage_Should_Decrease_CurrentHP()
    {
        float initialHP = _healthSystem.CurrentHP;
        float damage = 25f;

        _healthSystem.TakeDamage(damage);

        Assert.AreEqual(initialHP - damage, _healthSystem.CurrentHP,
            "TakeDamage 후 CurrentHP가 정확히 감소해야 합니다.");
    }

    // 테스트 4: 여러 번 데미지 시 누적 감소 확인
    [Test]
    public void TakeDamage_Multiple_Times_Should_Accumulate()
    {
        _healthSystem.TakeDamage(30f);
        _healthSystem.TakeDamage(20f);

        Assert.AreEqual(50f, _healthSystem.CurrentHP,
            "데미지가 누적 적용되어야 합니다.");
    }

    // 테스트 5: HP 0 이하 시 IsAlive = false
    [Test]
    public void IsAlive_Should_Be_False_When_HP_Reaches_Zero()
    {
        _healthSystem.TakeDamage(100f);

        Assert.IsFalse(_healthSystem.IsAlive,
            "HP가 0이 되면 IsAlive는 false여야 합니다.");
    }

    // 테스트 6: HP 0 초과 시 IsAlive = true
    [Test]
    public void IsAlive_Should_Be_True_When_HP_Above_Zero()
    {
        _healthSystem.TakeDamage(50f);

        Assert.IsTrue(_healthSystem.IsAlive,
            "HP가 0보다 크면 IsAlive는 true여야 합니다.");
    }

    // 테스트 7: HP가 음수로 내려가지 않는지 (Clamp)
    [Test]
    public void CurrentHP_Should_Not_Go_Below_Zero()
    {
        _healthSystem.TakeDamage(150f);

        Assert.GreaterOrEqual(_healthSystem.CurrentHP, 0f,
            "CurrentHP는 0 미만이 되어서는 안 됩니다.");
    }

    // 테스트 8: 중복 사망(HP 이미 0인 상태에서 추가 데미지) 방지
    [Test]
    public void TakeDamage_After_Death_Should_Not_Change_HP()
    {
        _healthSystem.TakeDamage(100f); // 사망

        float hpAfterDeath = _healthSystem.CurrentHP;
        _healthSystem.TakeDamage(50f); // 사망 후 추가 데미지

        Assert.AreEqual(hpAfterDeath, _healthSystem.CurrentHP,
            "사망 후 추가 데미지는 HP를 변경하면 안 됩니다.");
    }

    // 테스트 9: OnDeath 이벤트가 정확히 1번만 호출
    [Test]
    public void OnDeath_Should_Be_Invoked_Exactly_Once()
    {
        int deathCallCount = 0;
        _healthSystem.OnDeath.AddListener(() => deathCallCount++);

        _healthSystem.TakeDamage(100f); // 사망
        _healthSystem.TakeDamage(50f);  // 이미 사망 상태에서 추가 데미지

        Assert.AreEqual(1, deathCallCount,
            "OnDeath 이벤트는 정확히 1번만 호출되어야 합니다.");
    }

    // 테스트 10: OnHealthChanged 이벤트가 데미지 시 호출되는지
    [Test]
    public void OnHealthChanged_Should_Be_Invoked_On_Damage()
    {
        bool eventFired = false;
        float receivedCurrent = -1f;
        float receivedMax = -1f;

        _healthSystem.OnHealthChanged.AddListener((current, max) =>
        {
            eventFired = true;
            receivedCurrent = current;
            receivedMax = max;
        });

        _healthSystem.TakeDamage(30f);

        Assert.IsTrue(eventFired, "OnHealthChanged 이벤트가 호출되어야 합니다.");
        Assert.AreEqual(70f, receivedCurrent, "이벤트에서 받은 currentHP가 정확해야 합니다.");
        Assert.AreEqual(100f, receivedMax, "이벤트에서 받은 maxHP가 정확해야 합니다.");
    }

    // 테스트 11: 음수 데미지 무시 (방어 로직)
    [Test]
    public void TakeDamage_Negative_Value_Should_Be_Ignored()
    {
        float initialHP = _healthSystem.CurrentHP;
        _healthSystem.TakeDamage(-10f);

        Assert.AreEqual(initialHP, _healthSystem.CurrentHP,
            "음수 데미지는 무시되어야 합니다.");
    }

    // 테스트 12: IDamageable 인터페이스 구현 확인
    [Test]
    public void HealthSystem_Should_Implement_IDamageable()
    {
        Assert.IsInstanceOf<IDamageable>(_healthSystem,
            "HealthSystem은 IDamageable 인터페이스를 구현해야 합니다.");
    }
}
