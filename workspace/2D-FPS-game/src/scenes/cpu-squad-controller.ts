import { DummyAiLogic } from "../domain/ai/DummyAiLogic";
import type { Rect } from "../domain/collision/CollisionLogic";
import { PlayerLogic } from "../domain/player/PlayerLogic";
import { createActorId, type BattleRosterLogic } from "../domain/round/BattleRosterLogic";
import type { SpawnPoint, TeamId } from "../domain/round/MatchFlowLogic";
import {
  getActorAnimationKey,
  getActorTeamTexture,
  isAnimatedActorSkin,
  resolveActorAnimationState,
  resolveActorDirection,
  type ActorSkinDefinition
} from "../domain/visual/ActorSkinCatalog";
import type { ActorCollisionResolver } from "./actor-collision";
import type { SceneActorSprite, SceneCombatActor } from "./combat-actor-port";
import {
  ACTOR_HALF_SIZE,
  BODY_TURN_RATE,
  PLAYFIELD_MAX_X,
  PLAYFIELD_MAX_Y,
  PLAYFIELD_MIN_X,
  PLAYFIELD_MIN_Y
} from "./scene-constants";
import type { GameBalance, PlayerWeaponSlot } from "./scene-types";

export interface CpuActorView {
  readonly sprite: SceneActorSprite;
  readonly animatedSprite: SceneActorSprite | null;
  readonly weaponSprite: SceneActorSprite;
}

export type CpuActorViewFactory = (
  actorId: string,
  team: TeamId,
  spawn: Readonly<{ x: number; y: number }>
) => CpuActorView;

export interface CpuSquadControllerDeps {
  readonly roster: BattleRosterLogic;
  readonly team: TeamId;
  readonly gameBalance: GameBalance;
  readonly actorSkin: ActorSkinDefinition;
  readonly collisionResolver: Pick<ActorCollisionResolver, "resolveActorObstacleCollision">;
  readonly createWeaponSlots: () => PlayerWeaponSlot[];
  readonly createView: CpuActorViewFactory;
  readonly isCombatLive: (now: number) => boolean;
  readonly isMatchOver: () => boolean;
  readonly getWeatherMovementMultiplier: () => number;
  readonly getActorRotation: (angleRadians: number) => number;
  readonly getActiveObstacles: () => readonly Rect[];
  readonly getWeaponTexture?: (team: TeamId, weaponId: string) => string;
}

interface CpuSceneActor extends SceneCombatActor {
  readonly aiLogic: DummyAiLogic;
  readonly additionalIndex: number;
}

const MAX_LOCAL_ENEMIES = 4;
const FALLBACK_SPAWN_OFFSETS = Object.freeze([
  Object.freeze({ x: -56, y: -56 }),
  Object.freeze({ x: -56, y: 56 }),
  Object.freeze({ x: -96, y: 0 })
]);

export class CpuSquadController {
  private readonly runtimes: CpuSceneActor[] = [];
  private destroyed = false;

  public constructor(
    _scene: Phaser.Scene,
    private readonly deps: CpuSquadControllerDeps
  ) {}

  public get actors(): readonly SceneCombatActor[] {
    return Object.freeze([...this.runtimes]);
  }

  public createAdditional(count: number, spawns: readonly SpawnPoint[]): readonly SceneCombatActor[] {
    if (this.destroyed) return this.actors;
    this.releaseActors();
    const totalEnemies = Number.isFinite(count) ? Math.min(MAX_LOCAL_ENEMIES, Math.max(1, Math.floor(count))) : 1;

    for (let additionalIndex = 0; additionalIndex < totalEnemies - 1; additionalIndex += 1) {
      this.runtimes.push(this.createActor(additionalIndex, this.resolveSpawn(spawns, additionalIndex)));
    }

    return this.actors;
  }

  public updateMovement(deltaSeconds: number, now: number, player: SceneCombatActor): void {
    for (const actor of this.runtimes) this.updateActor(actor, deltaSeconds, now, player);
  }

  public updateWeaponTicks(now: number): void {
    for (const actor of this.runtimes) {
      for (const slot of actor.weaponSlots) slot.logic.update(now);
    }
  }

  public reset(spawns: readonly SpawnPoint[]): void {
    for (const actor of this.runtimes) {
      const spawn = this.resolveSpawn(spawns, actor.additionalIndex);
      actor.logic.reset(spawn.x - ACTOR_HALF_SIZE, spawn.y - ACTOR_HALF_SIZE);
      actor.weaponSlots.forEach((slot) => slot.logic.reset());
      actor.activeWeaponIndex = 0;
      actor.shouldFire = false;
      actor.bodyAngle = Math.PI;
      actor.sprite.setPosition(spawn.x, spawn.y);
      actor.sprite.setVisible(true);
      actor.animatedSprite?.setPosition(spawn.x, spawn.y);
      actor.animatedSprite?.setVisible(true);
      actor.weaponSprite.setPosition(spawn.x, spawn.y);
      actor.weaponSprite.setVisible(true);
      this.deps.roster.setAlive(actor.id, true);
      this.syncPresentation(actor);
    }
  }

  public setTeam(team: TeamId): void {
    for (const actor of this.runtimes) {
      actor.team = team;
      this.deps.roster.setTeam(actor.id, team);
      this.syncPresentation(actor);
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.releaseActors();
  }

  private createActor(additionalIndex: number, spawn: Readonly<{ x: number; y: number }>): CpuSceneActor {
    const id = createActorId(`cpu-${additionalIndex + 2}`);
    const logic = new PlayerLogic(this.deps.gameBalance.maxHealth, {
      movementSpeed: this.deps.gameBalance.dummyMovementSpeed,
      dashMultiplier: 1
    });
    logic.reset(spawn.x - ACTOR_HALF_SIZE, spawn.y - ACTOR_HALF_SIZE);
    const aiLogic = new DummyAiLogic({
      engageRange: this.deps.gameBalance.dummyEngageRange,
      retreatRange: this.deps.gameBalance.dummyRetreatRange,
      shootRange: this.deps.gameBalance.dummyShootRange,
      lowHealthThreshold: this.deps.gameBalance.dummyLowHealthThreshold,
      botTactics: this.deps.gameBalance.botTactics,
      combatTuning: this.deps.gameBalance.combatTuning
    });
    const view = this.deps.createView(id, this.deps.team, spawn);
    const weaponSlots = this.deps.createWeaponSlots();
    let actorDestroyed = false;
    const actor: CpuSceneActor = {
      id,
      team: this.deps.team,
      controller: "cpu",
      logic,
      aiLogic,
      sprite: view.sprite,
      animatedSprite: view.animatedSprite,
      weaponSprite: view.weaponSprite,
      weaponSlots,
      activeWeaponIndex: 0,
      shouldFire: false,
      bodyAngle: Math.PI,
      additionalIndex,
      isCoverProtected: () => false,
      onHit: () => undefined,
      destroy: () => {
        if (actorDestroyed) return;
        actorDestroyed = true;
        view.animatedSprite?.destroy();
        view.weaponSprite.destroy();
        view.sprite.destroy();
        this.deps.roster.remove(id);
      }
    };
    this.deps.roster.add({ id, team: this.deps.team, controller: "cpu" });
    this.syncPresentation(actor);
    return actor;
  }

  private updateActor(actor: CpuSceneActor, deltaSeconds: number, now: number, player: SceneCombatActor): void {
    if (actor.logic.isDead() || player.logic.isDead() || this.deps.isMatchOver() || !this.deps.isCombatLive(now)) {
      actor.shouldFire = false;
      actor.logic.move({ x: 0, y: 0, sprint: false }, deltaSeconds, now, this.deps.getWeatherMovementMultiplier());
      this.deps.roster.setAlive(actor.id, !actor.logic.isDead());
      this.syncPresentation(actor);
      return;
    }

    const previousX = actor.logic.state.positionX;
    const previousY = actor.logic.state.positionY;
    const decision = actor.aiLogic.evaluate({
      dummyX: actor.sprite.x,
      dummyY: actor.sprite.y,
      playerX: player.sprite.x,
      playerY: player.sprite.y,
      tickMs: now,
      currentHealth: actor.logic.state.health,
      playerHealthRatio: player.logic.state.health / player.logic.state.maxHealth,
      healthRatio: actor.logic.state.health / actor.logic.state.maxHealth,
      coverPoints: [],
      lineOfSightBlockers: this.deps.getActiveObstacles(),
      hazardZones: []
    });
    actor.shouldFire = decision.shouldFire;
    actor.activeWeaponIndex = Math.hypot(player.sprite.x - actor.sprite.x, player.sprite.y - actor.sprite.y) < 140 && actor.weaponSlots.length > 1 ? 1 : 0;
    actor.logic.move({ x: decision.moveX, y: decision.moveY, sprint: false }, deltaSeconds, now, this.deps.getWeatherMovementMultiplier());
    actor.logic.updateAim(player.sprite.x - ACTOR_HALF_SIZE, player.sprite.y - ACTOR_HALF_SIZE, now);
    if (decision.moveX !== 0 || decision.moveY !== 0) {
      actor.bodyAngle = rotateAngleTowards(actor.bodyAngle, Math.atan2(decision.moveY, decision.moveX), BODY_TURN_RATE * deltaSeconds);
    }

    const centerX = clamp(actor.logic.state.positionX + ACTOR_HALF_SIZE, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X);
    const centerY = clamp(actor.logic.state.positionY + ACTOR_HALF_SIZE, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y);
    const collision = this.deps.collisionResolver.resolveActorObstacleCollision(centerX, centerY, previousX, previousY, actor.logic);
    actor.sprite.setPosition(collision.centerX, collision.centerY);
    actor.sprite.setRotation(this.deps.getActorRotation(actor.bodyAngle));
    this.syncPresentation(actor);
  }

  private syncPresentation(actor: CpuSceneActor): void {
    const alive = !actor.logic.isDead();
    const activeWeapon = actor.weaponSlots[actor.activeWeaponIndex] ?? actor.weaponSlots[0];
    actor.sprite.setTexture?.(getActorTeamTexture(this.deps.actorSkin, actor.team).textureKey);
    actor.weaponSprite.setPosition(actor.sprite.x, actor.sprite.y);
    actor.weaponSprite.setRotation(actor.logic.state.aimAngleRadians);
    actor.weaponSprite.setVisible(alive);
    if (activeWeapon !== undefined && this.deps.getWeaponTexture !== undefined) {
      actor.weaponSprite.setTexture?.(this.deps.getWeaponTexture(actor.team, activeWeapon.id), 0);
    }

    if (actor.animatedSprite === null || !isAnimatedActorSkin(this.deps.actorSkin)) {
      actor.sprite.setVisible(alive);
      return;
    }

    const state = resolveActorAnimationState({
      isDead: !alive,
      isHit: false,
      isFiring: alive && actor.shouldFire,
      isMoving: alive && actor.logic.state.lastAppliedSpeed > 0
    });
    const direction = resolveActorDirection(actor.logic.state.aimAngleRadians);
    actor.animatedSprite.setPosition(actor.sprite.x, actor.sprite.y);
    actor.animatedSprite.setVisible(true);
    actor.animatedSprite.play?.(getActorAnimationKey(this.deps.actorSkin, actor.team, state, direction));
  }

  private resolveSpawn(spawns: readonly SpawnPoint[], additionalIndex: number): Readonly<{ x: number; y: number }> {
    const explicit = spawns[additionalIndex + 1];
    if (explicit !== undefined) return explicit;
    const base = spawns[0] ?? { x: 480, y: 270 };
    const offset = FALLBACK_SPAWN_OFFSETS[Math.min(additionalIndex, FALLBACK_SPAWN_OFFSETS.length - 1)];
    return {
      x: clamp(base.x + offset.x, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X),
      y: clamp(base.y + offset.y, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y)
    };
  }

  private releaseActors(): void {
    for (const actor of this.runtimes) actor.destroy();
    this.runtimes.length = 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rotateAngleTowards(current: number, target: number, maxStep: number): number {
  const fullTurn = Math.PI * 2;
  const delta = ((target - current + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
  return Math.abs(delta) <= maxStep ? target : current + Math.sign(delta) * maxStep;
}
