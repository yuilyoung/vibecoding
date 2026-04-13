import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WeaponLogic } from "../src/domain/combat/WeaponLogic";

describe("WeaponLogic", () => {
  it("loads the Phase 1 weapon balance section without dropping flat compatibility keys", () => {
    const balancePath = fileURLToPath(new URL("../assets/data/game-balance.json", import.meta.url));
    const balance = JSON.parse(readFileSync(balancePath, "utf8")) as {
      bulletSpeed: number;
      fireRateMs: number;
      bulletDamage: number;
      magazineSize: number;
      reloadTimeMs: number;
      reserveAmmo: number;
      weapons: Record<string, unknown>;
    };

    expect(balance.bulletSpeed).toBe(540);
    expect(balance.fireRateMs).toBe(180);
    expect(balance.bulletDamage).toBe(20);
    expect(balance.magazineSize).toBe(6);
    expect(balance.reloadTimeMs).toBe(1200);
    expect(balance.reserveAmmo).toBe(24);
    expect(Object.keys(balance.weapons)).toEqual([
      "carbine",
      "scatter",
      "bazooka",
      "grenade",
      "sniper",
      "airStrike"
    ]);
  });

  it("allows an initial fire attempt and schedules the next ready time", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 200,
      bulletSpeed: 500,
      damage: 25,
      magazineSize: 6,
      reloadTimeMs: 1200,
      reserveAmmo: 24,
      projectile: {
        trajectory: "linear",
        speed: 500
      }
    });

    const attempt = weapon.tryFire(1000);

    expect(attempt.allowed).toBe(true);
    expect(attempt.nextReadyAtMs).toBe(1200);
    expect(attempt.bulletSpeed).toBe(500);
    expect(attempt.damage).toBe(25);
    expect(attempt.ammoInMagazine).toBe(5);
    expect(attempt.reserveAmmo).toBe(24);
    expect(attempt.projectile).toEqual({
      trajectory: "linear",
      speed: 500
    });
    expect(attempt.reason).toBe("ready");
  });

  it("exposes projectile config while preserving the linear fallback", () => {
    const fallbackWeapon = new WeaponLogic({
      fireRateMs: 100,
      bulletSpeed: 300,
      damage: 10,
      magazineSize: 1,
      reloadTimeMs: 500,
      reserveAmmo: 0
    });
    const arcWeapon = new WeaponLogic({
      fireRateMs: 100,
      bulletSpeed: 300,
      damage: 10,
      magazineSize: 1,
      reloadTimeMs: 500,
      reserveAmmo: 0,
      projectile: {
        trajectory: "arc",
        speed: 260,
        gravity: 300,
        blastRadius: 60
      }
    });

    expect(fallbackWeapon.getProjectileConfig()).toEqual({
      trajectory: "linear",
      speed: 300
    });
    expect(arcWeapon.getProjectileConfig()).toMatchObject({
      trajectory: "arc",
      speed: 260,
      gravity: 300,
      blastRadius: 60
    });
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

  it("caps repeated reserve refills during overdrive-style pickup loops", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 10,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 3,
      reloadTimeMs: 500,
      reserveAmmo: 9
    });

    weapon.tryFire(0);
    weapon.tryFire(20);
    weapon.tryFire(40);
    weapon.startReload(80);

    expect(weapon.getAmmoInMagazine(700)).toBe(3);
    expect(weapon.getReserveAmmo(700)).toBe(6);
    expect(weapon.addReserveAmmo(2, 700)).toBe(2);
    expect(weapon.getReserveAmmo(700)).toBe(8);
    expect(weapon.addReserveAmmo(5, 700)).toBe(1);
    expect(weapon.getReserveAmmo(700)).toBe(9);
    expect(weapon.addReserveAmmo(3, 700)).toBe(0);
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

  it("refunds a spent round without exceeding magazine capacity", () => {
    const weapon = new WeaponLogic({
      fireRateMs: 10,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 2,
      reloadTimeMs: 500,
      reserveAmmo: 4
    });

    weapon.tryFire(0);
    weapon.refundRound(20);
    weapon.refundRound(30);

    expect(weapon.getAmmoInMagazine(30)).toBe(2);
  });

  it("restocks the weapon to full magazine and reserve ammo", () => {
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
    weapon.startReload(30);
    weapon.restockAllAmmo(60);

    expect(weapon.getAmmoInMagazine(60)).toBe(2);
    expect(weapon.getReserveAmmo(60)).toBe(4);
    expect(weapon.isReloading(60)).toBe(false);
  });
});
