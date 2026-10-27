import Phaser from "phaser";
import { advanceAirStrike, createAirStrike } from "../domain/combat/AirStrikeLogic";
import { castBeam } from "../domain/combat/BeamLogic";
import { resolveBulletCollision, resolveDamage } from "../domain/combat/CombatResolution";
import { selectEarliestProjectileImpact } from "../domain/combat/ProjectileImpactLogic";
import { resolveWeaponCueId } from "../domain/audio/SoundCueLogic";
import {
  canDummyFire,
  canInterruptReload,
  canPlayerFire,
  canPlayerReload,
  canPlayerUseCombatInteraction,
  type CombatAvailabilityInput,
} from "../domain/combat/CombatRuntime";
import { resolveChainExplosion, resolveExplosion } from "../domain/combat/ExplosionLogic";
import { advanceProjectile, reflectProjectileAtObstacle, type ProjectileConfig } from "../domain/combat/ProjectileRuntime";
import type { WeaponInventoryLogic } from "../domain/combat/WeaponInventoryLogic";
import { reflectProjectileOffWall } from "../domain/map/BounceWallLogic";
import { isBulletBlocked } from "../domain/map/CoverLogic";
import { computeForce } from "../domain/environment/WindLogic";
import type { SoundCueEvent } from "../domain/audio/SoundCueLogic";
import type { CameraFeedbackEvent } from "../domain/feedback/CameraFeedbackLogic";
import type { TeamId } from "../domain/round/MatchFlowLogic";
import { createActorId, type ActorId, type BattleRosterLogic } from "../domain/round/BattleRosterLogic";
import type { TacticalSnapshot } from "./scene-types";
import type { SceneCombatActor } from "./combat-actor-port";
import { flushPendingBulletClear, requestBulletClear } from "./combat-bullet-clear";
import { playTurretFireAnimation } from "./arena-textures";
import type { ActorCollisionResolver } from "./actor-collision";
import { MAX_BULLETS, PLAYFIELD_MAX_X, PLAYFIELD_MAX_Y, PLAYFIELD_MIN_X, PLAYFIELD_MIN_Y } from "./scene-constants";
import type { SceneRuntimeState } from "./scene-runtime-state";
import type { GameBalance, PlayerWeaponSlot } from "./scene-types";
import type { VfxController } from "./vfx-controller";
import type { MapObjectCollisionRect, MapObjectDamageResult } from "./map-object-controller";

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
  readonly spawnDamageNumber: (x: number, y: number, damage: number, isCritical: boolean, isSelfHarm: boolean) => void;
  readonly getMapObjectCollisionRects: () => readonly MapObjectCollisionRect[];
  readonly damageMapObject: (id: string, damage: number) => MapObjectDamageResult | null;
  readonly destroyMapObject: (id: string) => MapObjectDamageResult | null;
  readonly setMapObjectState: (id: string, state: MapObjectCollisionRect["state"]) => MapObjectCollisionRect["state"] | null;
  readonly getCombatActors: () => readonly SceneCombatActor[];
  readonly battleRoster: BattleRosterLogic;
}

export class CombatController {
  private resolvedEliminationTeam: TeamId | null = null;

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
    const pointer = this.deps.activePointer();
    const pointerFirePressed = pointer.downElement === this.scene.game.canvas && now >= this.state.suppressPointerFireUntilMs && pointer.leftButtonDown();
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
    this.deps.emitSoundCue({ kind: "fire", weaponId: resolveWeaponCueId(activeWeapon.id) });

    if (attempt.ammoInMagazine === 0) {
      this.state.lastCombatEvent = "MAG EMPTY";
    }
  }

  public handleDummyFire(now: number): void {
    const activeWeapon = this.getActiveDummyWeaponSlot(now);
    this.state.currentDummyWeaponId = activeWeapon.id;
    const actor = this.deps.getCombatActors().find((candidate) => candidate.id === "dummy");
    if (actor === undefined) return;
    actor.activeWeaponIndex = Math.max(0, actor.weaponSlots.indexOf(activeWeapon));
    actor.shouldFire = this.state.lastDummyShouldFire;
    this.handleCpuFire(actor, now);
  }

  public handleCpuFire(actor: SceneCombatActor, now: number): void {
    if (actor.controller !== "cpu" || actor.logic.isDead() || !canDummyFire(this.deps.getCombatAvailability(now)) || !actor.shouldFire) {
      return;
    }

    const activeWeapon = actor.weaponSlots[actor.activeWeaponIndex] ?? actor.weaponSlots[0];
    if (activeWeapon === undefined) return;
    const attempt = activeWeapon.logic.tryFire(now);

    if (!attempt.allowed) {
      if (attempt.reason === "empty") activeWeapon.logic.startReload(now);
      return;
    }

    const turretTexture = this.deps.getWeaponTurretTexture(actor.team, activeWeapon.id);
    playTurretFireAnimation(actor.weaponSprite as Phaser.GameObjects.Sprite, turretTexture);

    const pelletStart = -(activeWeapon.pelletCount - 1) / 2;
    for (let index = 0; index < activeWeapon.pelletCount; index += 1) {
      const spreadOffset = (pelletStart + index) * activeWeapon.spreadRadians;
      const angle = actor.logic.state.aimAngleRadians + spreadOffset;
      const spawnX = actor.sprite.x + Math.cos(angle) * 24;
      const spawnY = actor.sprite.y + Math.sin(angle) * 24;
      const bullet = this.scene.add.rectangle(
        spawnX,
        spawnY,
        activeWeapon.bulletWidth,
        activeWeapon.bulletHeight,
        activeWeapon.id === "scatter" ? 0xffaa72 : 0xff8b8b,
        1
      );
      bullet.setRotation(angle);

      if (this.deps.gameBalance.arcadePresentation === true) this.vfx.decorateProjectile(bullet, activeWeapon.id, actor.team);

      this.state.bullets.push({
        sprite: bullet,
        velocityX: Math.cos(angle) * attempt.bulletSpeed,
        velocityY: Math.sin(angle) * attempt.bulletSpeed,
        damage: attempt.damage,
        critChance: activeWeapon.critChance,
        critMultiplier: activeWeapon.critMultiplier,
        owner: "dummy",
        ownerId: actor.id,
        ownerTeam: actor.team,
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

    this.deps.emitSoundCue({ kind: "fire", weaponId: resolveWeaponCueId(activeWeapon.id) });
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

  public requestWeaponSlot(slot: number, now: number): void {
    if (!Number.isInteger(slot) || !canPlayerUseCombatInteraction(this.deps.getCombatAvailability(now))) return;
    this.state.suppressPointerFireUntilMs = Math.max(this.state.suppressPointerFireUntilMs, now + 200);
    this.tryEquipSlot(slot - 1, "EQUIPPED", now);
  }

  public updateProjectiles(deltaSeconds: number, now: number): void {
    const activeObstacles = this.collisionResolver.getActiveObstacles();
    const activeMapObjects = this.deps.getMapObjectCollisionRects();
    const actors = this.deps.getCombatActors();
    if (this.deps.battleRoster.getEliminatedTeam() === null) this.resolvedEliminationTeam = null;
    const windForce = computeForce(this.state.currentWind, this.deps.gameBalance.wind.forceScale);
    const environmentWindMultiplier = Math.max(0, this.state.currentWeather.windStrengthMultiplier - 1);

    for (let index = this.state.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.state.bullets[index];

      // Round-reset paths can clear the shared bullet array while this loop is
      // still unwinding from the projectile that ended the round. Skip any
      // slots that disappeared mid-frame instead of dereferencing `undefined`.
      if (bullet === undefined) {
        continue;
      }

      const previousX = bullet.sprite.x;
      const previousY = bullet.sprite.y;
      const runtimeFrame = advanceProjectile({
        projectile: {
          x: previousX,
          y: previousY,
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
        obstacles: [],
        windX: windForce.x,
        windY: windForce.y,
        environmentWindMultiplier
      });
      const impact = selectEarliestProjectileImpact({
        previous: { x: previousX, y: previousY },
        next: { x: runtimeFrame.projectile.x, y: runtimeFrame.projectile.y },
        projectileWidth: runtimeFrame.projectile.width,
        projectileHeight: runtimeFrame.projectile.height,
        hitRadius: bullet.projectileConfig.hitRadius,
        ownerId: bullet.ownerId,
        ownerTeam: bullet.ownerTeam,
        actors: actors.map((actor) => ({
          id: actor.id,
          team: actor.team,
          alive: !actor.logic.isDead(),
          bounds: this.collisionResolver.getActorCollisionBounds(actor.sprite.x, actor.sprite.y)
        })),
        world: [
          ...activeObstacles.map((obstacle, obstacleIndex) => ({ id: `obstacle:${obstacleIndex}`, bounds: obstacle.bounds })),
          ...activeMapObjects.map((mapObject) => ({ id: `map:${mapObject.id}`, bounds: mapObject.rect }))
        ]
      });
      const hitMapObject = impact?.kind === "world" && impact.id.startsWith("map:")
        ? activeMapObjects.find((mapObject) => mapObject.id === impact.id.slice(4)) ?? null
        : null;
      const hitActor = impact?.kind === "actor"
        ? actors.find((actor) => actor.id === impact.id) ?? null
        : null;
      const frame = {
        nextX: impact?.x ?? runtimeFrame.projectile.x,
        nextY: impact?.y ?? runtimeFrame.projectile.y,
        outOfBounds: impact === null && runtimeFrame.expired,
        hitObstacle: impact?.kind === "world" && impact.id.startsWith("obstacle:"),
        hitPlayer: hitActor?.controller === "human",
        hitDummy: hitActor !== null && hitActor.controller !== "human",
        hitActor,
        hitMapObject
      };

      bullet.sprite.x = frame.nextX;
      bullet.sprite.y = frame.nextY;
      bullet.velocityX = runtimeFrame.projectile.velocityX;
      bullet.velocityY = runtimeFrame.projectile.velocityY;
      bullet.bouncesRemaining = runtimeFrame.projectile.bouncesRemaining;

      const hitArenaObstacle = impact?.kind === "world" && impact.id.startsWith("obstacle:")
        ? activeObstacles[Number(impact.id.slice("obstacle:".length))]?.bounds ?? null
        : null;
      if (
        hitArenaObstacle !== null &&
        bullet.projectileConfig.trajectory === "bounce" &&
        (bullet.bouncesRemaining ?? 0) > 0
      ) {
        const incomingVelocityX = bullet.velocityX;
        const incomingVelocityY = bullet.velocityY;
        const reflectedVelocity = reflectProjectileAtObstacle({
          x: previousX,
          y: previousY,
          width: bullet.sprite.width,
          height: bullet.sprite.height,
          velocityX: bullet.velocityX,
          velocityY: bullet.velocityY,
          bouncesRemaining: bullet.bouncesRemaining
        }, hitArenaObstacle);
        const separated = separateFromReflectionBoundary(
          frame.nextX,
          frame.nextY,
          incomingVelocityX,
          incomingVelocityY,
          reflectedVelocity.x,
          reflectedVelocity.y
        );
        bullet.sprite.x = separated.x;
        bullet.sprite.y = separated.y;
        bullet.velocityX = reflectedVelocity.x;
        bullet.velocityY = reflectedVelocity.y;
        bullet.bouncesRemaining = Math.max(0, (bullet.bouncesRemaining ?? 0) - 1);
        this.vfx.spawnImpactEffect(frame.nextX, frame.nextY, bullet.effectProfile);
        this.deps.emitSoundCue({ kind: "deflect", mode: "ricochet" });
        continue;
      }

      if (frame.hitMapObject?.kind === "bounce-wall") {
        const reflection = reflectProjectileOffWall({
          x: previousX,
          y: previousY,
          width: bullet.sprite.width,
          height: bullet.sprite.height,
          velocityX: bullet.velocityX,
          velocityY: bullet.velocityY,
          trajectory: bullet.projectileConfig.trajectory,
          bouncesRemaining: bullet.bouncesRemaining ?? 0
        }, frame.hitMapObject.state);

        if (reflection.kind === "reflected") {
          this.deps.setMapObjectState(frame.hitMapObject.id, reflection.wall);
          const separated = separateFromReflectionBoundary(
            frame.nextX,
            frame.nextY,
            bullet.velocityX,
            bullet.velocityY,
            reflection.projectile.velocityX,
            reflection.projectile.velocityY
          );
          bullet.sprite.x = separated.x;
          bullet.sprite.y = separated.y;
          bullet.velocityX = reflection.projectile.velocityX;
          bullet.velocityY = reflection.projectile.velocityY;
          bullet.bouncesRemaining = reflection.projectile.bouncesRemaining;
          this.vfx.spawnImpactEffect(frame.nextX, frame.nextY, bullet.effectProfile);
          this.deps.emitSoundCue({ kind: "deflect", mode: "ricochet" });
          continue;
        }
      }

      const hitActiveCover = frame.hitMapObject?.kind === "cover" &&
        isBulletBlocked(frame.hitMapObject.state, {
          prevX: previousX,
          prevY: previousY,
          x: frame.nextX,
          y: frame.nextY
        });
      const hitDummy = hitActiveCover ? false : frame.hitDummy;
      const hitPlayer = hitActiveCover ? false : frame.hitPlayer;

      const dummyCoverProtected = hitDummy && frame.hitActor?.isCoverProtected(now) === true;
      let appliedDamage = bullet.damage;
      let isCritical = false;

      if (frame.hitActor !== null) {
        if (dummyCoverProtected) {
          appliedDamage = 0;
        } else {
          const damageResult = this.resolveWeaponDamage(bullet.damage, bullet.critChance, bullet.critMultiplier);
          appliedDamage = damageResult.damage;
          isCritical = damageResult.isCritical;
        }
      }

      if (frame.hitActor !== null && !dummyCoverProtected) {
        const target = frame.hitActor;
        target.logic.takeDamage(appliedDamage, target.controller === "human" ? this.deps.gameBalance.hitStunMs : 0, now);
        target.onHit(now);
        this.deps.spawnDamageNumber(frame.nextX, frame.nextY, appliedDamage, isCritical, false);
        if (target.id === "player") {
          this.deps.recordPlayerHit(now);
          if (!target.logic.isDead()) this.deps.playPlayerHitFeedback();
        } else if (target.id === "dummy") {
          this.deps.recordDummyHit(now);
          if (!target.logic.isDead()) this.deps.playDummyHitFeedback();
        }
        this.deps.battleRoster.setAlive(target.id, !target.logic.isDead());
      } else if (frame.hitActor !== null) {
        this.vfx.spawnImpactEffect(frame.nextX, frame.nextY, bullet.effectProfile === "scatter" ? "scatter" : "carbine");
        this.vfx.spawnShotTrail(frame.nextX, frame.nextY, frame.hitActor.logic.state.aimAngleRadians + Math.PI,
          bullet.effectProfile === "scatter" ? 18 : 22, 0x7dd3fc, 85);
      }

      if (frame.hitMapObject !== null && frame.hitMapObject.kind !== "bounce-wall") {
        const result = this.deps.damageMapObject(frame.hitMapObject.id, bullet.damage);
        this.vfx.spawnImpactEffect(frame.nextX, frame.nextY, bullet.effectProfile);
        if (result?.destroyed === true && result.after.kind === "barrel") {
          this.triggerBarrelChain(result.after.id, result.after);
        }
      }

      const bulletResolution = resolveBulletCollision({
        owner: bullet.owner,
        hitDummy,
        hitPlayer,
        hitObstacle: frame.hitObstacle || hitActiveCover || (frame.hitMapObject !== null && frame.hitMapObject.kind !== "bounce-wall"),
        outOfBounds: frame.outOfBounds,
        damage: bullet.damage,
        appliedDamage,
        targetDied: frame.hitActor?.logic.isDead() ?? false,
        coverProtected: dummyCoverProtected
      });

      if (bulletResolution.combatEvent !== null) {
        this.state.lastCombatEvent = bulletResolution.combatEvent;
      }

      if (dummyCoverProtected) {
        this.deps.emitSoundCue({ kind: "deflect", mode: "shield" });
      } else if (frame.hitObstacle || hitActiveCover) {
        this.deps.emitSoundCue({ kind: "deflect", mode: "ricochet" });
      }

      if (bulletResolution.soundTarget !== null) {
        this.deps.emitSoundCue({ kind: "hit", target: bulletResolution.soundTarget });
      }

      if (hitDummy || hitPlayer) {
        this.deps.emitSoundCue({ kind: "impact", surface: "actor" });
      } else if (frame.hitObstacle || hitActiveCover || frame.hitMapObject !== null) {
        this.deps.emitSoundCue({ kind: "impact", surface: "world" });
      }

      if (frame.hitActor?.logic.isDead() === true) this.completeRoundIfTeamEliminated(now);

      if (frame.hitObstacle || hitActiveCover) {
        this.vfx.spawnImpactEffect(frame.nextX, frame.nextY, bullet.effectProfile);
      }

      if ((frame.hitObstacle || hitDummy || hitPlayer || frame.hitMapObject !== null || frame.outOfBounds) && bullet.projectileConfig.blastRadius !== undefined) {
        this.vfx.spawnImpactEffect(frame.nextX, frame.nextY, bullet.effectProfile);
        this.applyExplosionDamage(
          frame.nextX,
          frame.nextY,
          bullet.projectileConfig.blastRadius,
          bullet.projectileConfig.blastDamage ?? bullet.damage,
          bullet.projectileConfig.knockback ?? 0,
          bullet.owner,
          false,
          bullet.critChance,
          bullet.critMultiplier,
          bullet.ownerId,
          bullet.ownerTeam
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
        this.applyExplosionDamage(
          blast.x,
          blast.y,
          blast.radius,
          blast.damage,
          blast.knockback,
          airStrike.owner,
          true,
          airStrike.critChance,
          airStrike.critMultiplier,
          airStrike.ownerId,
          airStrike.ownerTeam
        );
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
    ignoreCover = false,
    critChance = 0,
    critMultiplier = 1,
    ownerId: ActorId = createActorId(owner),
    ownerTeam: TeamId = owner === "player" ? this.state.currentPlayerTeam : this.state.currentDummyTeam
  ): void {
    const actors = this.deps.getCombatActors();
    const results = resolveExplosion({
      centerX,
      centerY,
      blastRadius: radius,
      baseDamage: damage,
      knockback,
      targets: actors
        .filter((actor) => actor.id !== ownerId && actor.team !== ownerTeam && !actor.logic.isDead())
        .map((actor) => ({ id: actor.id, x: actor.sprite.x, y: actor.sprite.y }))
    });

    for (const result of results) {
      const target = actors.find((actor) => actor.id === result.id);
      if (target === undefined || target.logic.isDead()) continue;
      const damageResult = !ignoreCover && target.isCoverProtected(this.scene.time.now)
        ? { damage: 0, isCritical: false }
        : this.resolveWeaponDamage(result.damage, critChance, critMultiplier);
      target.logic.takeDamage(damageResult.damage, target.controller === "human" ? this.deps.gameBalance.hitStunMs : 0, this.scene.time.now);
      target.onHit(this.scene.time.now);
      this.deps.spawnDamageNumber(target.sprite.x, target.sprite.y, damageResult.damage, damageResult.isCritical, target.controller === "human");
      if (target.id === "player") {
        this.deps.recordPlayerHit(this.scene.time.now);
        if (!target.logic.isDead()) this.deps.playPlayerHitFeedback();
      } else if (target.id === "dummy") {
        this.deps.recordDummyHit(this.scene.time.now);
        if (!target.logic.isDead()) this.deps.playDummyHitFeedback();
      }
      this.deps.battleRoster.setAlive(target.id, !target.logic.isDead());
      if (Math.abs(result.knockbackX) > 0.1 || Math.abs(result.knockbackY) > 0.1) {
        this.scene.tweens.add({ targets: target.sprite, x: target.sprite.x + result.knockbackX,
          y: target.sprite.y + result.knockbackY, duration: 150, ease: "Back.easeOut" });
      }
    }

    this.applyExplosionDamageToMapObjects(centerX, centerY, radius, damage);

    if (!this.completeRoundIfTeamEliminated(this.scene.time.now) && results.length > 0) {
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

    if (this.deps.weaponInventory.selectSlot(slotIndex, now)) {
      this.state.lastActiveWeaponReloading = false;
      this.state.lastCombatEvent = `DEBUG EQUIPPED ${this.getActiveWeaponSlot().label.toUpperCase()}`;
    }
  }

  public debugDamageActor(actorId: ActorId, damage: number, now = this.scene.time.now): boolean {
    const actor = this.deps.getCombatActors().find((candidate) => candidate.id === actorId);
    if (actor === undefined || actor.logic.isDead() || !Number.isFinite(damage) || damage <= 0) return false;
    actor.logic.takeDamage(damage, actor.controller === "human" ? this.deps.gameBalance.hitStunMs : 0, now);
    actor.onHit(now);
    this.deps.battleRoster.setAlive(actor.id, !actor.logic.isDead());
    if (actor.logic.isDead()) this.completeRoundIfTeamEliminated(now);
    return true;
  }

  public syncActorLife(actorId: ActorId, now = this.scene.time.now): void {
    const actor = this.deps.getCombatActors().find((candidate) => candidate.id === actorId);
    if (actor === undefined) return;
    this.deps.battleRoster.setAlive(actor.id, !actor.logic.isDead());
    if (actor.logic.isDead()) this.completeRoundIfTeamEliminated(now);
  }

  public debugFire(now = this.scene.time.now): void {
    const availability = this.deps.getCombatAvailability(now);
    if (!availability.isCombatLive || availability.isDummyDead || availability.isPlayerDead) {
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
    const availability = this.deps.getCombatAvailability(now);
    if (!availability.isCombatLive || availability.isDummyDead || availability.isPlayerDead) {
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
      this.callPlayerAirStrikeAt(activeWeapon, attempt.projectile, targetX, targetY);
      this.applyExplosionDamage(
        Phaser.Math.Clamp(targetX, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X),
        Phaser.Math.Clamp(targetY, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y),
        attempt.projectile.blastRadius ?? 96,
        attempt.projectile.blastDamage ?? attempt.damage,
        attempt.projectile.knockback ?? 0,
        "player",
        true,
        activeWeapon.critChance,
        activeWeapon.critMultiplier
      );
    } else {
      this.resolvePlayerWeaponFire(activeWeapon, attempt.projectile, attempt.bulletSpeed, attempt.damage);
    }
    this.state.lastCombatEvent = `${activeWeapon.label.toUpperCase()} FIRED`;
  }

  public getActiveWeaponSlot(): PlayerWeaponSlot {
    return this.deps.weaponSlots[this.deps.weaponInventory.getActiveIndex()];
  }

  public getActiveDummyWeaponSlot(now = this.scene.time.now): PlayerWeaponSlot {
    return this.selectDummyWeapon(now).slot;
  }

  public getPreferredDummyWeaponId(now = this.scene.time.now): string {
    return this.selectDummyWeapon(now).slot.id;
  }

  public getDummyTacticalSnapshot(): TacticalSnapshot {
    return {
      intent: this.state.lastDummyTacticalIntent,
      targetCoverIndex: this.state.targetDummyCoverIndex,
      targetCoverEffect: this.state.targetDummyCoverEffect,
      chosenWeaponId: this.state.currentDummyWeaponId,
      chosenWeaponRole: this.state.currentDummyWeaponRole
    };
  }

  private selectDummyWeapon(now: number): { slot: PlayerWeaponSlot; role: string | null } {
    const targetDummy = this.requireTargetDummy();
    const playerSprite = this.requirePlayerSprite();
    const distanceToPlayer = Phaser.Math.Distance.Between(
      targetDummy.x,
      targetDummy.y,
      playerSprite.x,
      playerSprite.y
    );

    let bestSlot = this.deps.dummyWeaponSlots[0];
    let bestRole: string | null = bestSlot.logic.getRoleId();
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const slot of this.deps.dummyWeaponSlots) {
      const evaluation = slot.logic.evaluateSelection({
        distanceToTarget: distanceToPlayer,
        tacticalIntent: this.state.lastDummyTacticalIntent,
        splashRiskTolerance: this.state.lastDummyTacticalIntent === "retreat" ? "avoid" : "cautious",
        targetSpacing: "neutral"
      }, now);

      if (evaluation.score > bestScore) {
        bestScore = evaluation.score;
        bestSlot = slot;
        bestRole = evaluation.role;
      }
    }

    this.state.currentDummyWeaponId = bestSlot.id;
    this.state.currentDummyWeaponRole = bestRole;

    return {
      slot: bestSlot,
      role: bestRole
    };
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

    if (this.deps.weaponInventory.selectSlot(slotIndex, now)) {
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

  public triggerMapObjectExplosion(id: string): void {
    this.triggerBarrelChain(id);
  }

  public clearBullets(): void {
    requestBulletClear(this.state);
  }

  public getWindDebugState(): {
    angleDegrees: number;
    strength: number;
    forceX: number;
    forceY: number;
  } {
    const force = computeForce(this.state.currentWind, this.deps.gameBalance.wind.forceScale);

    return {
      angleDegrees: this.state.currentWind.angleDegrees,
      strength: this.state.currentWind.strength,
      forceX: force.x,
      forceY: force.y
    };
  }

  public flushPendingBulletClear(): void {
    flushPendingBulletClear(this.state, () => this.vfx.clearCombatFx());
  }

  private resolveWeaponDamage(damage: number, critChance: number, critMultiplier: number): { damage: number; isCritical: boolean } {
    return resolveDamage(damage, critChance, critMultiplier);
  }

  private applyExplosionDamageToMapObjects(centerX: number, centerY: number, radius: number, damage: number): void {
    const hits = resolveExplosion({
      centerX,
      centerY,
      blastRadius: radius,
      baseDamage: damage,
      knockback: 0,
      targets: this.deps.getMapObjectCollisionRects().map((mapObject) => ({
        id: mapObject.id,
        x: mapObject.state.x,
        y: mapObject.state.y
      }))
    });

    for (const hit of hits) {
      const result = this.deps.damageMapObject(hit.id, hit.damage);
      if (result?.destroyed === true && result.after.kind === "barrel") {
        this.triggerBarrelChain(result.after.id, result.after);
      }
    }
  }

  private triggerBarrelChain(originId: string, originState?: { readonly id: string; readonly x: number; readonly y: number }): void {
    const activeBarrels = this.deps.getMapObjectCollisionRects()
      .filter((mapObject) => mapObject.kind === "barrel")
      .map((mapObject) => ({
        id: mapObject.id,
        x: mapObject.state.x,
        y: mapObject.state.y,
        triggerRadius: this.deps.gameBalance.mapObjects.barrel.triggerRadius
      }));
    const barrels = originState === undefined || activeBarrels.some((barrel) => barrel.id === originState.id)
      ? activeBarrels
      : [
        {
          id: originState.id,
          x: originState.x,
          y: originState.y,
          triggerRadius: this.deps.gameBalance.mapObjects.barrel.triggerRadius
        },
        ...activeBarrels
      ];
    const triggered = resolveChainExplosion({ originId, objects: barrels, maxDepth: 5 });

    triggered.forEach((id, index) => {
      const scheduleExplosion = () => {
        const state = this.deps.destroyMapObject(id)?.after ?? this.deps.getMapObjectCollisionRects().find((object) => object.id === id)?.state;
        if (state === undefined) {
          return;
        }
        this.vfx.spawnImpactEffect(state.x, state.y, "bazooka");
        this.applyExplosionDamage(
          state.x,
          state.y,
          this.deps.gameBalance.mapObjects.barrel.blastRadius,
          this.deps.gameBalance.mapObjects.barrel.blastDamage,
          0,
          "player"
        );
      };

      if (index === 0) {
        scheduleExplosion();
      } else {
        this.scene.time.delayedCall(this.deps.gameBalance.mapObjects.barrel.chainDelayMs * index, scheduleExplosion);
      }
    });
  }

  private resolvePlayerWeaponFire(activeWeapon: PlayerWeaponSlot, projectileConfig: ProjectileConfig, bulletSpeed: number, damage: number): void {
    if (projectileConfig.trajectory === "beam") {
      this.firePlayerBeam(activeWeapon, projectileConfig, damage);
      return;
    }

    if (projectileConfig.trajectory === "aoe-call") {
      this.callPlayerAirStrike(activeWeapon, projectileConfig);
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

      if (this.deps.gameBalance.arcadePresentation === true) this.vfx.decorateProjectile(bullet, activeWeapon.id, this.state.currentPlayerTeam);

      this.state.bullets.push({
        sprite: bullet,
        velocityX: Math.cos(angle) * bulletSpeed,
        velocityY: Math.sin(angle) * bulletSpeed,
        damage,
        critChance: activeWeapon.critChance,
        critMultiplier: activeWeapon.critMultiplier,
        owner: "player",
        ownerId: createActorId("player"),
        ownerTeam: this.state.currentPlayerTeam,
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
    const actors = this.deps.getCombatActors();
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
      actors
        .filter((actor) => actor.team !== this.state.currentPlayerTeam && !actor.logic.isDead())
        .map((actor) => ({
          ...this.collisionResolver.getActorCollisionBounds(actor.sprite.x, actor.sprite.y),
          id: actor.id
        }))
    );

    this.vfx.spawnShotTrail(origin.x, origin.y, angle, hit.distance, 0xdff8ff, 140);
    this.vfx.spawnImpactEffect(hit.hitPoint.x, hit.hitPoint.y, "sniper");

    const target = hit.kind === "actor" ? actors.find((actor) => actor.id === hit.targetId) : undefined;
    if (target !== undefined && !target.isCoverProtected(this.scene.time.now)) {
      const damageResult = this.resolveWeaponDamage(projectileConfig.blastDamage ?? damage, activeWeapon.critChance, activeWeapon.critMultiplier);
      const beamDamage = damageResult.damage;
      target.logic.takeDamage(beamDamage);
      target.onHit(this.scene.time.now);
      if (target.id === "dummy") this.deps.recordDummyHit(this.scene.time.now);
      this.deps.spawnDamageNumber(hit.hitPoint.x, hit.hitPoint.y, beamDamage, damageResult.isCritical, false);
      if (target.id === "dummy" && !target.logic.isDead()) {
        this.deps.playDummyHitFeedback();
      }
      this.deps.emitSoundCue({ kind: "hit", target: "dummy" });
      this.deps.emitSoundCue({ kind: "impact", surface: "actor" });
      this.state.lastCombatEvent = target.logic.isDead() ? "ENEMY DOWN" : "ENEMY HIT";
      this.deps.battleRoster.setAlive(target.id, !target.logic.isDead());

      if (target.logic.isDead()) this.completeRoundIfTeamEliminated(this.scene.time.now);
      return;
    }

    if (hit.kind === "actor") {
      this.deps.emitSoundCue({ kind: "impact", surface: "actor" });
      this.deps.emitSoundCue({ kind: "deflect", mode: "shield" });
      this.state.lastCombatEvent = "COVER BLOCKED";
    } else if (hit.kind === "obstacle") {
      this.deps.emitSoundCue({ kind: "impact", surface: "world" });
    }
  }

  private callPlayerAirStrike(activeWeapon: PlayerWeaponSlot, projectileConfig: ProjectileConfig): void {
    const pointer = this.deps.activePointer();
    const targetX = Phaser.Math.Clamp(pointer.worldX, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X);
    const targetY = Phaser.Math.Clamp(pointer.worldY, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y);

    this.callPlayerAirStrikeAt(activeWeapon, projectileConfig, targetX, targetY);
  }

  private callPlayerAirStrikeAt(activeWeapon: PlayerWeaponSlot, projectileConfig: ProjectileConfig, targetX: number, targetY: number): void {
    const clampedTargetX = Phaser.Math.Clamp(targetX, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X);
    const clampedTargetY = Phaser.Math.Clamp(targetY, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y);

    playTurretFireAnimation(this.requirePlayerWeaponSprite(), this.deps.getWeaponTurretTexture(this.state.currentPlayerTeam, "airStrike"));
    this.state.activeAirStrikes.push({
      owner: "player",
      ownerId: createActorId("player"),
      ownerTeam: this.state.currentPlayerTeam,
      critChance: activeWeapon.critChance,
      critMultiplier: activeWeapon.critMultiplier,
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

  private completeRoundIfTeamEliminated(now: number): boolean {
    const eliminatedTeam = this.deps.battleRoster.getEliminatedTeam();
    if (eliminatedTeam === null || eliminatedTeam === this.resolvedEliminationTeam || this.deps.isMatchOver()) return false;
    this.resolvedEliminationTeam = eliminatedTeam;
    this.deps.triggerCameraFeedback({ kind: "death" });
    if (eliminatedTeam === this.state.currentPlayerTeam) this.deps.registerDummyRoundWin();
    else this.deps.registerPlayerRoundWin(now);
    this.deps.scheduleResetAfterRound(now);
    return true;
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

const REFLECTION_BOUNDARY_EPSILON = 0.001;

function separateFromReflectionBoundary(
  x: number,
  y: number,
  incomingVelocityX: number,
  incomingVelocityY: number,
  reflectedVelocityX: number,
  reflectedVelocityY: number
): { x: number; y: number } {
  return {
    x: x + (incomingVelocityX === reflectedVelocityX ? 0 : Math.sign(reflectedVelocityX) * REFLECTION_BOUNDARY_EPSILON),
    y: y + (incomingVelocityY === reflectedVelocityY ? 0 : Math.sign(reflectedVelocityY) * REFLECTION_BOUNDARY_EPSILON)
  };
}
