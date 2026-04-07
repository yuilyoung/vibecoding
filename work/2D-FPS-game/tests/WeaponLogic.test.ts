import { WeaponLogic } from "../src/domain/combat/WeaponLogic";

describe("WeaponLogic", () => {
  it("allows an initial fire attempt and schedules the next ready time", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 200,
      bulletSpeed: 500,
      damage: 25,
      magazineSize: 6,
      reloadTimeMs: 1200,
      reserveAmmo: 24
    });

    const attempt = weapon.tryFire(1000);

    expect(attempt.allowed).toBe(true);
    expect(attempt.nextReadyAtMs).toBe(1200);
    expect(attempt.bulletSpeed).toBe(500);
    expect(attempt.damage).toBe(25);
    expect(attempt.ammoInMagazine).toBe(5);
    expect(attempt.reserveAmmo).toBe(24);
    expect(attempt.reason).toBe("ready");
  });

  it("blocks firing while the cooldown window is active", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 180,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 6,
      reloadTimeMs: 1200,
      reserveAmmo: 24
    });

    weapon.tryFire(0);
    const blocked = weapon.tryFire(90);

    expect(blocked.allowed).toBe(false);
    expect(weapon.getCooldownRemaining(90)).toBe(90);
    expect(blocked.reason).toBe("cooldown");
  });

  it("returns zero cooldown once the weapon is ready again", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 180,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 6,
      reloadTimeMs: 1200,
      reserveAmmo: 24
    });

    weapon.tryFire(0);

    expect(weapon.getCooldownRemaining(200)).toBe(0);
  });

  it("blocks firing when the magazine is empty and allows reload", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 10,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 2,
      reloadTimeMs: 500,
      reserveAmmo: 4
    });

    weapon.tryFire(0);
    weapon.tryFire(20);
    const emptyAttempt = weapon.tryFire(40);

    expect(emptyAttempt.allowed).toBe(false);
    expect(emptyAttempt.reason).toBe("empty");
    expect(weapon.startReload(40)).toBe(true);
    expect(weapon.isReloading(100)).toBe(true);
    expect(weapon.getAmmoInMagazine(600)).toBe(2);
    expect(weapon.getReserveAmmo(600)).toBe(2);
  });

  it("blocks firing while reloading", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 180,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 2,
      reloadTimeMs: 500,
      reserveAmmo: 4
    });

    weapon.tryFire(0);
    weapon.startReload(200);
    const blocked = weapon.tryFire(300);

    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("reloading");
    expect(weapon.getReloadRemaining(300)).toBe(400);
  });

  it("cancels reload and preserves the current magazine state", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 180,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 6,
      reloadTimeMs: 500,
      reserveAmmo: 8
    });

    weapon.tryFire(0);
    weapon.tryFire(200);
    weapon.startReload(300);

    expect(weapon.cancelReload(400)).toBe(true);
    expect(weapon.isReloading(400)).toBe(false);
    expect(weapon.getAmmoInMagazine(900)).toBe(4);
    expect(weapon.getReserveAmmo(900)).toBe(8);
  });

  it("returns false when no reload is active to cancel", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 180,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 6,
      reloadTimeMs: 500,
      reserveAmmo: 8
    });

    expect(weapon.cancelReload(0)).toBe(false);
  });

  it("supports partial reloads when reserve ammo is lower than the missing rounds", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 10,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 6,
      reloadTimeMs: 500,
      reserveAmmo: 2
    });

    weapon.tryFire(0);
    weapon.tryFire(20);
    weapon.tryFire(40);
    weapon.startReload(100);

    expect(weapon.getAmmoInMagazine(700)).toBe(5);
    expect(weapon.getReserveAmmo(700)).toBe(0);
  });

  it("does not start reload when reserve ammo is empty", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 10,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 2,
      reloadTimeMs: 500,
      reserveAmmo: 0
    });

    weapon.tryFire(0);

    expect(weapon.startReload(100)).toBe(false);
    expect(weapon.getReserveAmmo(100)).toBe(0);
  });

  it("refills reserve ammo up to the configured cap", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 10,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 2,
      reloadTimeMs: 500,
      reserveAmmo: 6
    });

    weapon.tryFire(0);
    weapon.tryFire(20);
    weapon.startReload(40);
    expect(weapon.getReserveAmmo(600)).toBe(4);

    expect(weapon.addReserveAmmo(10, 600)).toBe(2);
    expect(weapon.getReserveAmmo(600)).toBe(6);
  });

  it("returns zero when reserve ammo is already full", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 10,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 2,
      reloadTimeMs: 500,
      reserveAmmo: 6
    });

    expect(weapon.addReserveAmmo(3, 0)).toBe(0);
    expect(weapon.getMaxReserveAmmo()).toBe(6);
    expect(weapon.getReserveAmmo(0)).toBe(6);
  });

  it("resets cooldown, magazine, and reserve ammo to config defaults", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 10,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 2,
      reloadTimeMs: 500,
      reserveAmmo: 4
    });

    weapon.tryFire(0);
    weapon.startReload(20);
    weapon.reset();

    expect(weapon.getAmmoInMagazine(0)).toBe(2);
    expect(weapon.getReserveAmmo(0)).toBe(4);
    expect(weapon.getCooldownRemaining(0)).toBe(0);
    expect(weapon.getReloadRemaining(0)).toBe(0);
  });
});
