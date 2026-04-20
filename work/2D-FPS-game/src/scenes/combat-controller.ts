import Phaser from "phaser";
import { createCenteredRect, intersectsRect } from "../domain/collision/CollisionLogic";
import { advanceAirStrike, createAirStrike } from "../domain/combat/AirStrikeLogic";
import { castBeam } from "../domain/combat/BeamLogic";
import { resolveBulletCollision } from "../domain/combat/CombatResolution";
import {
  canDummyFire,
  canInterruptReload,
  canPlayerFire,
  canPlayerReload,
  canPlayerUseCombatInteraction,
  type CombatAvailabilityInput,
} from "../domain/combat/CombatRuntime";
import { resolveExplosion } from "../domain/combat/ExplosionLogic";
import { advanceProjectile, type ProjectileConfig } from "../domain/combat/ProjectileRuntime";
import type { WeaponInventoryLogic } from "../domain/combat/WeaponInventoryLogic";
import type { SoundCueEvent } from "../domain/audio/SoundCueLogic";
import type { CameraFeedbackEvent } from "../domain/feedback/CameraFeedbackLogic";
import type { TeamId } from "../domain/round/MatchFlowLogic";
import { playTurretFireAnimation } from "./arena-textures";
import type { ActorCollisionResolver } from "./actor-collision";
import { MAX_BULLETS, PLAYFIELD_MAX_X, PLAYFIELD_MAX_Y, PLAYFIELD_MIN_X, PLAYFIELD_MIN_Y } from "./scene-constants";
import type { SceneRuntimeState } from "./scene-runtime-state";
import type { GameBalance, PlayerWeaponSlot } from "./scene-types";
import type { VfxController } from "./vfx-controller";

export interface CombatControllerMoveKeys {
  reload: Phaser.Input.Keyboard.Key;
  fire: Phaser.Input.Keyboard.Key;
  sprint: Phaser.Input.Keyboard.Key;
  swap: Phaser.Input.Keyboard.Key;
  weapon1: Phaser.Input.Keyboard.Key;
  weapon2: Phaser.Input.Keyboard.Key;
  weapon3: Phaser.Input.Keyboard.Key;
  weapon4: Phaser.Input.Keyboard.Key;
  weapon5: Phaser.Input.Keyboard.Key;
  weapon6: Phaser.Input.Keyboard.Key;
}

export interface CombatControllerDeps {
  readonly weaponSlots: readonly PlayerWeaponSlot[];
  readonly weaponInventory: WeaponInventoryLogic;
  readonly dummyWeaponSlots: readonly PlayerWeaponSlot[];
  readonly gameBalance: GameBalance;
  readonly moveKeys: () => CombatControllerMoveKeys | undefined;
  readonly activePointer: () => Phaser.Input.Pointer;
  readonly getCombatAvailability: (now: number) => CombatAvailabilityInput;
  readonly getWeaponTurretTexture: (team: TeamId, weaponId: string) => string;
  readonly isWeaponAvailable: (weaponId: string) => boolean;
  readonly emitSoundCue: (event: SoundCueEvent) => void;
  readonly triggerCameraFeedback: (event: CameraFeedbackEvent) => void;
  readonly registerPlayerRoundWin: (now: number) => void;
  readonly registerDummyRoundWin: () => void;
  readonly scheduleResetAfterRound: (now: number) => void;
  readonly hasDummyCoverProtection: (now: number) => boolean;
  readonly isMatchOver: () => boolean;
  readonly recordPlayerHit: (now: number) => void;
  readonly recordDummyHit: (now: number) => void;
  readonly playPlayerHitFeedback: () => void;
  readonly playDummyHitFeedback: () => void;
  readonly spawnDamageNumber: (x: number, y: number, damage: number, isCritical: boolean) => void;
}

export class CombatController {
  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: SceneRuntimeState,
    private readonly vfx: VfxController,
    private readonly collisionResolver: ActorCollisionResolver,
    private readonly deps: CombatControllerDeps
  ) {}

  public updateWeaponTicks(now: number): void {
    for (const slot of this.deps.weaponSlots) {
      slot.logic.update(now);
    }

    this.updateReloadAudioState(now);

    for (const slot of this.deps.dummyWeaponSlots) {
      slot.logic.update(now);
    }
  }

  public updateReloadAudioState(now: number): void {
    const isReloading = this.getActiveWeaponSlot().logic.isReloading(now);

    if (this.state.lastActiveWeaponReloading && !isReloading) {
      this.deps.emitSoundCue({ kind: "reload", action: "complete" });
    }

    this.state.lastActiveWeaponReloading = isReloading;
  }

  public handleReload(now: number): void {
    if (!canPlayerReload(this.deps.getCombatAvailability(now))) {
      return;
    }

    if (this.isAmmoOverdriveActive(now)) {
      this.getActiveWeaponSlot().logic.cancelReload(now);
      this.getActiveWeaponSlot().logic.restockAllAmmo(now);
      this.state.lastCombatEvent = "AMMO OVERDRIVE";
      return;
    }

    const moveKeys = this.deps.moveKeys();
    if (moveKeys === undefined || !Phaser.Input.Keyboard.JustDown(moveKeys.reload)) {
      return;
    }

    if (this.getActiveWeaponSlot().logic.startReload(now)) {
      this.state.lastCombatEvent = "RELOADING";
      this.deps.emitSoundCue({ kind: "reload", action: "start" });
      return;
    }

    this.state.lastCombatEvent = "NO RESERVE";
    this.deps.emitSoundCue({ kind: "reload", action: "empty" });
  }

  public handleReloadInterrupt(now: number): void {
    const moveKeys = this.deps.moveKeys();
    if (!canInterruptReload(this.deps.getCombatAvailability(now)) || moveKeys === undefined) {
      return;
    }

    if ((!moveKeys.sprint.isDown && !this.state.playerLogic.isStunned(now)) || !this.getActiveWeaponSlot().logic.isReloading(now)) {
      return;
    }

    if (this.getActiveWeaponSlot().logic.cancelReload(now)) {
      this.state.lastCombatEvent = this.state.playerLogic.isStunned(now) ? "STUN CANCELED RELOAD" : "RELOAD CANCELED";
    }
  }

  public handlePlayerFire(now: number): void {
    const pointerFirePressed = now >= this.state.suppressPointerFireUntilMs && this.deps.activePointer().leftButtonDown();
    const firePressed = pointerFirePressed || this.deps.moveKeys()?.fire.isDown === true;

    if (!firePressed || !canPlayerFire(this.deps.getCombatAvailability(now))) {
      return;
    }

    const activeWeapon = this.getActiveWeaponSlot();
    const attempt = activeWeapon.logic.tryFire(now);

    if (!attempt.allowed) {
      this.state.lastCombatEvent = attempt.reason.toUpperCase();
      return;
    }

    this.resolvePlayerWeaponFire(activeWeapon, attempt.projectile, attempt.bulletSpeed, attempt.damage);
    if (this.isAmmoOverdriveActive(now)) {
      activeWeapon.logic.refundRound(now);
    }
    this.state.lastCombatEvent = `${activeWeapon.label.toUpperCase()} FIRED`;
    this.deps.emitSoundCue({ kind: "fire", weaponId: activeWeapon.id === "scatter" ? "scatter" : activeWeapon.id === "carbine" ? "carbine" : "generic" });

    if (attempt.ammoInMagazine === 0) {
      this.state.lastCombatEvent = "MAG EMPTY";
    }
  }

  public handleDummyFire(now: number): void {
    if (!canDummyFire(this.deps.getCombatAvailability(now)) || !this.state.lastDummyShouldFire) {
      return;
    }

    const activeWeapon = this.getActiveDummyWeaponSlot();
    this.state.currentDummyWeaponId = activeWeapon.id;
    const attempt = activeWeapon.logic.tryFire(now);

    if (!attempt.allowed) {
      return;
    }

    const turretTexture = this.deps.getWeaponTurretTexture(this.state.currentDummyTeam, activeWeapon.id);
    playTurretFireAnimation(this.requireDummyWeaponSprite(), turretTexture);

    const pelletStart = -(activeWeapon.pelletCount - 1) / 2;
    for (let index = 0; index < activeWeapon.pelletCount; index += 1) {
      const spreadOffset = (pelletStart + index) * activeWeapon.spreadRadians;
      const angle = this.state.dummyLogic.state.aimAngleRadians + spreadOffset;
      const spawnX = this.requireTargetDummy().x + Math.cos(angle) * 24;
      const spawnY = this.requireTargetDummy().y + Math.sin(angle) * 24;
      const bullet = this.scene.add.rectangle(
        spawnX,
        spawnY,
        activeWeapon.bulletWidth,
        activeWeapon.bulletHeight,
        activeWeapon.id === "scatter" ? 0xffaa72 : 0xff8b8b,
        1
      );
      bullet.setRotation(angle);

      this.state.bullets.push({
        sprite: bullet,
        velocityX: Math.cos(angle) * attempt.bulletSpeed,
        velocityY: Math.sin(angle) * attempt.bulletSpeed,
        damage: attempt.damage,
        owner: "dummy",
        effectProfile: activeWeapon.id === "scatter" ? "scatter" : "dummy",
        projectileConfig: activeWeapon.projectileConfig,
        bouncesRemaining: activeWeapon.projectileConfig.bounceCount
      });
      this.trimBulletPool();

      this.vfx.spawnShotTrail(
        spawnX,
        spawnY,
        angle,
        activeWeapon.id === "scatter" ? 26 : 30,
        activeWeapon.id === "scatter" ? 0xffb47a : 0xff8c8c,
        activeWeapon.id === "scatter" ? 90 : 75
      );
    }

    this.deps.emitSoundCue({ kind: "fire", weaponId: activeWeapon.id === "scatter" ? "scatter" : activeWeapon.id === "carbine" ? "carbine" : "generic" });
  }

  public handleWeaponSwitch(now: number): void {
    const moveKeys = this.deps.moveKeys();
    if (moveKeys === undefined || !canPlayerUseCombatInteraction(this.deps.getCombatAvailability(now))) {
      return;
    }

    const numberKeySlots = [
      moveKeys.weapon1,
      moveKeys.weapon2,
      moveKeys.weapon3,
      moveKeys.weapon4,
      moveKeys.weapon5,
      moveKeys.weapon6
    ];

    for (const [slotIndex, key] of numberKeySlots.entries()) {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        this.tryEquipSlot(slotIndex, "EQUIPPED", now);
        return;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(moveKeys.swap)) {
      this.debugSwapWeapon(now);
    }
  }

  public updateProjectiles(deltaSeconds: number, now: number): void {
    const activeObstacles = this.collisionResolver.getActiveObstacles();
    const targetDummy = this.requireTargetDummy();
    const playerSprite = this.requirePlayerSprite();
    const dummyAlive = !this.state.dummyLogic.isDead();
    const playerAlive = !this.state.playerLogic.isDead();
    const dummyBounds = dummyAlive ? this.collisionResolver.getActorCollisionBounds(targetDummy.x, targetDummy.y) : null;
    const playerBounds = playerAlive ? this.collisionResolver.getActorCollisionBounds(playerSprite.x, playerSprite.y) : null;

    for (let index = this.state.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.state.bullets[index];
      const runtimeFrame = advanceProjectile({
        projectile: {
          x: bullet.sprite.x,
          y: bullet.sprite.y,
          width: bullet.sprite.width,
          height: bullet.sprite.height,
          velocityX: bullet.velocityX,
          velocityY: bullet.velocityY,
          bouncesRemaining: bullet.bouncesRemaining
        },
        config: bullet.projectileConfig,
        deltaSeconds,
        arenaWidth: 960,
        arenaHeight: 540,
        obstacles: activeObstacles.map((obstacle) => obstacle.bounds)
      });
      const projectileBounds = createCenteredRect(
        runtimeFrame.projectile.x,
        runtimeFrame.projectile.y,
        runtimeFrame.projectile.width,
        runtimeFrame.projectile.height
      );
      const frame = {
        nextX: runtimeFrame.projectile.x,
        nextY: runtimeFrame.projectile.y,
        outOfBounds: runtimeFrame.expired,
        hitObstacle: runtimeFrame.hitObstacle,
        hitPlayer: playerBounds !== null && intersectsRect(projectileBounds, playerBounds),
        hitDummy: dummyBounds !== null && intersectsRect(projectileBounds, dummyBounds)
      };

      bullet.sprite.x = frame.nextX;
      bullet.sprite.y = frame.nextY;
      bullet.velocityX = runtimeFrame.projectile.velocityX;
      bullet.velocityY = runtimeFrame.projectile.velocityY;
      bullet.bouncesRemaining = runtimeFrame.projectile.bouncesRemaining;

      const dummyCoverProtected = frame.hitDummy && bullet.owner === "player" && this.deps.hasDummyCoverProtection(now);
      const appliedDamage = frame.hitDummy && bullet.owner === "player"
        ? dummyCoverProtected
          ? 0
          : bullet.damage
        : bullet.damage;

      if (frame.hitDummy && bullet.owner === "player" && !dummyCoverProtected) {
        this.state.dummyLogic.takeDamage(appliedDamage);
        this.deps.recordDummyHit(now);
        this.deps.spawnDamageNumber(frame.nextX, frame.nextY, appliedDamage, false);
        if (!this.state.dummyLogic.isDead()) {
          this.deps.playDummyHitFeedback();
        }
      }

      if (frame.hitDummy && bullet.owner === "player" && dummyCoverProtected) {
        this.vfx.spawnImpactEffect(frame.nextX, frame.nextY, bullet.effectProfile === "scatter" ? "scatter" : "carbine");
        this.vfx.spawnShotTrail(
          frame.nextX,
          frame.nextY,
          this.state.dummyLogic.state.aimAngleRadians + Math.PI,
          bullet.effectProfile === "scatter" ? 18 : 22,
          0x7dd3fc,
          85
        );
      }

      if (frame.hitPlayer && bullet.owner === "dummy") {
        this.state.playerLogic.takeDamage(appliedDamage, this.deps.gameBalance.hitStunMs, now);
        this.deps.recordPlayerHit(now);
        this.deps.spawnDamageNumber(frame.nextX, frame.nextY, appliedDamage, false);
        if (!this.state.playerLogic.isDead()) {
          this.deps.playPlayerHitFeedback();
        }
      }

      const bulletResolution = resolveBulletCollision({
        owner: bullet.owner,
        hitDummy: frame.hitDummy,
        hitPlayer: frame.hitPlayer,
        hitObstacle: frame.hitObstacle,
        outOfBounds: frame.outOfBounds,
        damage: bullet.damage,
        appliedDamage,
        targetDied: bullet.owner === "player" ? this.state.dummyLogic.isDead() : this.state.playerLogic.isDead(),
        coverProtected: dummyCoverProtected
      });

      if (bulletResolution.combatEvent !== null) {
        this.state.lastCombatEvent = bulletResolution.combatEvent;
      }

      if (dummyCoverProtected) {
        this.deps.emitSoundCue({ kind: "deflect", mode: "shield" });
      } else if (frame.hitObstacle) {
        this.deps.emitSoundCue({ kind: "deflect", mode: "ricochet" });
      }

      if (bulletResolution.soundTarget !== null) {
        this.deps.emitSoundCue({ kind: "hit", target: bulletResolution.soundTarget });
      }

      if (bulletResolution.roundWinner === "PLAYER") {
        this.deps.registerPlayerRoundWin(now);
        this.deps.scheduleResetAfterRound(now);
      } else if (bulletResolution.roundWinner === "DUMMY") {
        this.deps.registerDummyRoundWin();
        this.deps.scheduleResetAfterRound(now);
      }

      if (frame.hitObstacle) {
        this.vfx.spawnImpactEffect(frame.nextX, frame.nextY, bullet.effectProfile);
      }

      if ((frame.hitObstacle || frame.hitDummy || frame.hitPlayer || frame.outOfBounds) && bullet.projectileConfig.blastRadius !== undefined) {
        this.vfx.spawnImpactEffect(frame.nextX, frame.nextY, bullet.effectProfile);
        this.applyExplosionDamage(
          frame.nextX,
          frame.nextY,
          bullet.projectileConfig.blastRadius,
          bullet.projectileConfig.blastDamage ?? bullet.damage,
          bullet.projectileConfig.knockback ?? 0,
          bullet.owner
        );
      }

      if (bulletResolution.destroyBullet) {
        bullet.sprite.destroy();
        this.state.bullets.splice(index, 1);
      }
    }
  }

  public updateAirStrikes(deltaMs: number): void {
    for (let index = this.state.activeAirStrikes.length - 1; index >= 0; index -= 1) {
      const airStrike = this.state.activeAirStrikes[index];
      const result = advanceAirStrike(airStrike.state, deltaMs);
      airStrike.state = result.state;

      for (const blast of result.blasts) {
        this.vfx.spawnImpactEffect(blast.x, blast.y, "airStrike");
        this.deps.triggerCameraFeedback({ kind: "explosion" });
        this.applyExplosionDamage(blast.x, blast.y, blast.radius, blast.damage, blast.knockback, airStrike.owner, true);
      }

      if (airStrike.state.completed) {
        this.state.activeAirStrikes.splice(index, 1);
      }
    }
  }

  public applyExplosionDamage(
    centerX: number,
    centerY: number,
    radius: number,
    damage: number,
    knockback: number,
    owner: "player" | "dummy",
    ignoreCover = false
  ): void {
    const playerSprite = this.requirePlayerSprite();
    const targetDummy = this.requireTargetDummy();
    const playerWasDead = this.state.playerLogic.isDead();
    const dummyWasDead = this.state.dummyLogic.isDead();
    const results = resolveExplosion({
      centerX,
      centerY,
      blastRadius: radius,
      baseDamage: damage,
      knockback,
      targets: [
        { id: "player", x: playerSprite.x, y: playerSprite.y },
        { id: "dummy", x: targetDummy.x, y: targetDummy.y }
      ]
    });

    for (const result of results) {
      if (owner === "player" && result.id === "dummy" && !this.state.dummyLogic.isDead()) {
        const appliedDamage = !ignoreCover && this.deps.hasDummyCoverProtection(this.scene.time.now) ? 0 : result.damage;
        this.state.dummyLogic.takeDamage(appliedDamage);
        this.deps.recordDummyHit(this.scene.time.now);
        this.deps.spawnDamageNumber(targetDummy.x, targetDummy.y, appliedDamage, false);
        if (!this.state.dummyLogic.isDead()) {
          this.deps.playDummyHitFeedback();
        }
        if (Math.abs(result.knockbackX) > 0.1 || Math.abs(result.knockbackY) > 0.1) {
          this.scene.tweens.add({
            targets: targetDummy,
            x: targetDummy.x + result.knockbackX,
            y: targetDummy.y + result.knockbackY,
            duration: 150,
            ease: "Back.easeOut"
          });
        }
      }

      if (owner === "dummy" && result.id === "player" && !this.state.playerLogic.isDead()) {
        this.state.playerLogic.takeDamage(result.damage, this.deps.gameBalance.hitStunMs, this.scene.time.now);
        this.deps.recordPlayerHit(this.scene.time.now);
        this.deps.spawnDamageNumber(playerSprite.x, playerSprite.y, result.damage, false);
        if (!this.state.playerLogic.isDead()) {
          this.deps.playPlayerHitFeedback();
        }
        if (Math.abs(result.knockbackX) > 0.1 || Math.abs(result.knockbackY) > 0.1) {
          this.scene.tweens.add({
            targets: playerSprite,
            x: playerSprite.x + result.knockbackX,
            y: playerSprite.y + result.knockbackY,
            duration: 150,
            ease: "Back.easeOut"
          });
        }
      }
    }

    if (!dummyWasDead && this.state.dummyLogic.isDead() && !this.deps.isMatchOver()) {
      this.deps.triggerCameraFeedback({ kind: "death" });
      this.deps.registerPlayerRoundWin(this.scene.time.now);
      this.deps.scheduleResetAfterRound(this.scene.time.now);
    } else if (!playerWasDead && this.state.playerLogic.isDead() && !this.deps.isMatchOver()) {
      this.deps.triggerCameraFeedback({ kind: "death" });
      this.deps.registerDummyRoundWin();
      this.deps.scheduleResetAfterRound(this.scene.time.now);
    } else if (results.length > 0) {
      this.deps.triggerCameraFeedback({ kind: "explosion" });
    }
  }

  public debugSwapWeapon(now = this.scene.time.now): void {
    const nextIndex = (this.deps.weaponInventory.getActiveIndex() + 1) % this.deps.weaponSlots.length;
    this.tryEquipSlot(nextIndex, "SWAPPED TO", now);
  }

  public debugSelectWeaponSlot(slotNumber: number, now = this.scene.time.now): void {
    const slotIndex = slotNumber - 1;

    if (slotIndex < 0 || slotIndex >= this.deps.weaponSlots.length) {
      return;
    }

    if (this.deps.weaponInventory.selectSlot(slotIndex)) {
      this.getActiveWeaponSlot().logic.cancelReload(now);
      this.state.lastActiveWeaponReloading = false;
      this.state.lastCombatEvent = `DEBUG EQUIPPED ${this.getActiveWeaponSlot().label.toUpperCase()}`;
    }
  }

  public debugFire(now = this.scene.time.now): void {
    if (!this.deps.getCombatAvailability(now).isCombatLive || this.state.dummyLogic.isDead() || this.state.playerLogic.isDead()) {
      return;
    }

    const activeWeapon = this.getActiveWeaponSlot();
    const attempt = activeWeapon.logic.tryFire(now);

    if (!attempt.allowed) {
      this.state.lastCombatEvent = attempt.reason.toUpperCase();
      if (attempt.reason === "empty" || attempt.reason === "no-reserve") {
        this.deps.emitSoundCue({ kind: "reload", action: "empty" });
      }
      return;
    }

    this.resolvePlayerWeaponFire(activeWeapon, attempt.projectile, attempt.bulletSpeed, attempt.damage);
    this.state.lastCombatEvent = `${activeWeapon.label.toUpperCase()} FIRED`;
  }

  public debugFireAt(targetX: number, targetY: number, now = this.scene.time.now): void {
    const playerSprite = this.requirePlayerSprite();
    if (!this.deps.getCombatAvailability(now).isCombatLive || this.state.dummyLogic.isDead() || this.state.playerLogic.isDead()) {
      return;
    }

    this.state.playerLogic.state.aimAngleRadians = Phaser.Math.Angle.Between(
      playerSprite.x,
      playerSprite.y,
      targetX,
      targetY
    );
    const activeWeapon = this.getActiveWeaponSlot();
    const attempt = activeWeapon.logic.tryFire(now);

    if (!attempt.allowed) {
      this.state.lastCombatEvent = attempt.reason.toUpperCase();
      return;
    }

    if (attempt.projectile.trajectory === "aoe-call") {
      this.callPlayerAirStrikeAt(attempt.projectile, targetX, targetY);
      this.applyExplosionDamage(
        Phaser.Math.Clamp(targetX, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X),
        Phaser.Math.Clamp(targetY, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y),
        attempt.projectile.blastRadius ?? 96,
        attempt.projectile.blastDamage ?? attempt.damage,
        attempt.projectile.knockback ?? 0,
        "player",
        true
      );
    } else {
      this.resolvePlayerWeaponFire(activeWeapon, attempt.projectile, attempt.bulletSpeed, attempt.damage);
    }
    this.state.lastCombatEvent = `${activeWeapon.label.toUpperCase()} FIRED`;
  }

  public getActiveWeaponSlot(): PlayerWeaponSlot {
    return this.deps.weaponSlots[this.deps.weaponInventory.getActiveIndex()];
  }

  public getActiveDummyWeaponSlot(): PlayerWeaponSlot {
    const targetDummy = this.requireTargetDummy();
    const playerSprite = this.requirePlayerSprite();
    const distanceToPlayer = Phaser.Math.Distance.Between(
      targetDummy.x,
      targetDummy.y,
      playerSprite.x,
      playerSprite.y
    );
    const preferredWeaponId = distanceToPlayer <= 164 ? "scatter" : "carbine";
    return this.deps.dummyWeaponSlots.find((slot) => slot.id === preferredWeaponId) ?? this.deps.dummyWeaponSlots[0];
  }

  public getPreferredDummyWeaponId(): string {
    return this.getActiveDummyWeaponSlot().id;
  }

  public tryEquipSlot(slotIndex: number, eventPrefix: string, now = this.scene.time.now): void {
    const slot = this.deps.weaponSlots[slotIndex];

    if (slot === undefined) {
      return;
    }

    if (!this.deps.isWeaponAvailable(slot.id)) {
      this.state.lastCombatEvent = `WEAPON LOCKED ${slot.label.toUpperCase()}`;
      return;
    }

    if (this.deps.weaponInventory.selectSlot(slotIndex)) {
      this.getActiveWeaponSlot().logic.cancelReload(now);
      this.state.lastActiveWeaponReloading = false;
      this.state.lastCombatEvent = `${eventPrefix} ${this.getActiveWeaponSlot().label.toUpperCase()}`;
      this.deps.emitSoundCue({ kind: "weapon-state", action: "swap" });
    }
  }

  public isAmmoOverdriveActive(now: number): boolean {
    return now < this.state.playerUnlimitedAmmoUntilMs;
  }

  public restockPlayerAmmo(now: number): void {
    for (const slot of this.deps.weaponSlots) {
      slot.logic.restockAllAmmo(now);
    }
  }

  public activateAmmoOverdrive(now: number, durationMs: number): void {
    this.state.playerUnlimitedAmmoUntilMs = now + durationMs;
  }

  public clearBullets(): void {
    for (const bullet of this.state.bullets) {
      bullet.sprite.destroy();
    }

    this.state.bullets.length = 0;
    this.vfx.clearCombatFx();
  }

  private resolvePlayerWeaponFire(activeWeapon: PlayerWeaponSlot, projectileConfig: ProjectileConfig, bulletSpeed: number, damage: number): void {
    if (projectileConfig.trajectory === "beam") {
      this.firePlayerBeam(activeWeapon, projectileConfig, damage);
      return;
    }

    if (projectileConfig.trajectory === "aoe-call") {
      this.callPlayerAirStrike(projectileConfig);
      return;
    }

    this.spawnPlayerProjectiles(activeWeapon, projectileConfig, bulletSpeed, damage);
  }

  private spawnPlayerProjectiles(activeWeapon: PlayerWeaponSlot, projectileConfig: ProjectileConfig, bulletSpeed: number, damage: number): void {
    const playerSprite = this.requirePlayerSprite();
    const playerWeaponSprite = this.requirePlayerWeaponSprite();
    playTurretFireAnimation(playerWeaponSprite, this.deps.getWeaponTurretTexture(this.state.currentPlayerTeam, activeWeapon.id));
    const pelletCount = projectileConfig.pelletCount ?? activeWeapon.pelletCount;
    const spreadRadians = projectileConfig.spreadRadians ?? activeWeapon.spreadRadians;
    const pelletStart = -(pelletCount - 1) / 2;

    for (let index = 0; index < pelletCount; index += 1) {
      const spreadOffset = (pelletStart + index) * spreadRadians;
      const angle = this.state.playerLogic.state.aimAngleRadians + spreadOffset;
      const spawnX = playerSprite.x + Math.cos(angle) * 24;
      const spawnY = playerSprite.y + Math.sin(angle) * 24;
      const bullet = this.scene.add.rectangle(
        spawnX,
        spawnY,
        activeWeapon.bulletWidth,
        activeWeapon.bulletHeight,
        activeWeapon.bulletColor,
        1
      );
      bullet.setRotation(angle);

      this.state.bullets.push({
        sprite: bullet,
        velocityX: Math.cos(angle) * bulletSpeed,
        velocityY: Math.sin(angle) * bulletSpeed,
        damage,
        owner: "player",
        effectProfile: this.vfx.getImpactProfile(activeWeapon.id),
        projectileConfig,
        bouncesRemaining: projectileConfig.bounceCount
      });
      this.trimBulletPool();

      this.vfx.spawnShotTrail(
        spawnX,
        spawnY,
        angle,
        activeWeapon.id === "scatter" ? 26 : 44,
        activeWeapon.id === "scatter" ? 0xffb86c : 0xffef9a,
        activeWeapon.id === "scatter" ? 90 : 70
      );
    }

    this.showMuzzleFlash(activeWeapon);
  }

  private firePlayerBeam(activeWeapon: PlayerWeaponSlot, projectileConfig: ProjectileConfig, damage: number): void {
    const playerSprite = this.requirePlayerSprite();
    const targetDummy = this.requireTargetDummy();
    playTurretFireAnimation(this.requirePlayerWeaponSprite(), this.deps.getWeaponTurretTexture(this.state.currentPlayerTeam, activeWeapon.id));
    const angle = this.state.playerLogic.state.aimAngleRadians;
    const origin = {
      x: playerSprite.x + Math.cos(angle) * 24,
      y: playerSprite.y + Math.sin(angle) * 24
    };
    const hit = castBeam(
      origin,
      angle,
      projectileConfig.beamRange ?? 820,
      this.collisionResolver.getActiveObstacles().map((obstacle) => obstacle.bounds),
      this.state.dummyLogic.isDead()
        ? []
        : [{
            ...this.collisionResolver.getActorCollisionBounds(targetDummy.x, targetDummy.y),
            id: "dummy"
          }]
    );

    this.vfx.spawnShotTrail(origin.x, origin.y, angle, hit.distance, 0xdff8ff, 140);
    this.vfx.spawnImpactEffect(hit.hitPoint.x, hit.hitPoint.y, "sniper");

    if (hit.kind === "actor" && hit.targetId === "dummy" && !this.deps.hasDummyCoverProtection(this.scene.time.now)) {
      const beamDamage = projectileConfig.blastDamage ?? damage;
      this.state.dummyLogic.takeDamage(beamDamage);
      this.deps.recordDummyHit(this.scene.time.now);
      this.deps.spawnDamageNumber(hit.hitPoint.x, hit.hitPoint.y, beamDamage, false);
      if (!this.state.dummyLogic.isDead()) {
        this.deps.playDummyHitFeedback();
      }
      this.deps.emitSoundCue({ kind: "hit", target: "dummy" });
      this.state.lastCombatEvent = this.state.dummyLogic.isDead() ? "DUMMY DOWN" : "DUMMY HIT";

      if (this.state.dummyLogic.isDead()) {
        this.deps.registerPlayerRoundWin(this.scene.time.now);
        this.deps.scheduleResetAfterRound(this.scene.time.now);
      }
      return;
    }

    if (hit.kind === "actor") {
      this.deps.emitSoundCue({ kind: "deflect", mode: "shield" });
      this.state.lastCombatEvent = "COVER BLOCKED";
    }
  }

  private callPlayerAirStrike(projectileConfig: ProjectileConfig): void {
    const pointer = this.deps.activePointer();
    const targetX = Phaser.Math.Clamp(pointer.worldX, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X);
    const targetY = Phaser.Math.Clamp(pointer.worldY, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y);

    this.callPlayerAirStrikeAt(projectileConfig, targetX, targetY);
  }

  private callPlayerAirStrikeAt(projectileConfig: ProjectileConfig, targetX: number, targetY: number): void {
    const clampedTargetX = Phaser.Math.Clamp(targetX, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X);
    const clampedTargetY = Phaser.Math.Clamp(targetY, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y);

    playTurretFireAnimation(this.requirePlayerWeaponSprite(), this.deps.getWeaponTurretTexture(this.state.currentPlayerTeam, "airStrike"));
    this.state.activeAirStrikes.push({
      owner: "player",
      state: createAirStrike(clampedTargetX, clampedTargetY, {
        blastCount: projectileConfig.aoeCount ?? 5,
        blastDelayMs: projectileConfig.aoeIntervalMs ?? 320,
        spreadRadius: projectileConfig.aoeSpreadRadius ?? 48,
        blastRadius: projectileConfig.blastRadius ?? 96,
        damage: projectileConfig.blastDamage ?? 30,
        knockback: projectileConfig.knockback ?? 120
      })
    });
    this.vfx.spawnImpactEffect(clampedTargetX, clampedTargetY, "airStrike");
    this.deps.triggerCameraFeedback({ kind: "airStrike" });
    this.state.lastCombatEvent = "AIR STRIKE CALLED";
  }

  private showMuzzleFlash(activeWeapon: PlayerWeaponSlot): void {
    const playerSprite = this.requirePlayerSprite();
    const muzzleFlash = this.requireMuzzleFlash();
    const muzzleAngle = this.state.playerLogic.state.aimAngleRadians;
    const muzzleProfile = activeWeapon.id === "scatter"
      ? { radius: 16, color: 0xffa44b, durationMs: 120 }
      : { radius: 9, color: 0xffef7b, durationMs: 80 };

    muzzleFlash
      .setRadius(muzzleProfile.radius)
      .setFillStyle(muzzleProfile.color, 0.92)
      .setScale(1);
    muzzleFlash.setPosition(
      playerSprite.x + Math.cos(muzzleAngle) * 28,
      playerSprite.y + Math.sin(muzzleAngle) * 28
    );
    muzzleFlash.setVisible(true);
    this.state.muzzleFlashUntilMs = this.scene.time.now + muzzleProfile.durationMs;
  }

  private trimBulletPool(): void {
    while (this.state.bullets.length > MAX_BULLETS) {
      const oldest = this.state.bullets.shift();
      oldest?.sprite.destroy();
    }
  }

  private requirePlayerSprite(): Phaser.GameObjects.Image {
    if (this.state.playerSprite === undefined) {
      throw new Error("CombatController player sprite used before MainScene.create().");
    }

    return this.state.playerSprite;
  }

  private requireTargetDummy(): Phaser.GameObjects.Image {
    if (this.state.targetDummy === undefined) {
      throw new Error("CombatController dummy sprite used before MainScene.create().");
    }

    return this.state.targetDummy;
  }

  private requirePlayerWeaponSprite(): Phaser.GameObjects.Sprite {
    if (this.state.playerWeaponSprite === undefined) {
      throw new Error("CombatController player weapon sprite used before MainScene.create().");
    }

    return this.state.playerWeaponSprite;
  }

  private requireDummyWeaponSprite(): Phaser.GameObjects.Sprite {
    if (this.state.dummyWeaponSprite === undefined) {
      throw new Error("CombatController dummy weapon sprite used before MainScene.create().");
    }

    return this.state.dummyWeaponSprite;
  }

  private requireMuzzleFlash(): Phaser.GameObjects.Arc {
    if (this.state.muzzleFlash === undefined) {
      throw new Error("CombatController muzzle flash used before MainScene.create().");
    }

    return this.state.muzzleFlash;
  }
}
