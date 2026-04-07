import Phaser from "phaser";
import { DummyAiLogic, type CoverPoint, type DummyAiDecision } from "../domain/ai/DummyAiLogic";
import { createCenteredRect, intersectsRect, type Rect } from "../domain/collision/CollisionLogic";
import { WeaponInventoryLogic } from "../domain/combat/WeaponInventoryLogic";
import { WeaponLogic, type WeaponConfig } from "../domain/combat/WeaponLogic";
import { HazardZoneLogic } from "../domain/map/HazardZoneLogic";
import { PlayerLogic } from "../domain/player/PlayerLogic";
import { RoundLogic } from "../domain/round/RoundLogic";

interface GameBalance {
  movementSpeed: number;
  dashMultiplier: number;
  maxHealth: number;
  hitStunMs: number;
  bulletSpeed: number;
  fireRateMs: number;
  bulletDamage: number;
  magazineSize: number;
  reloadTimeMs: number;
  reserveAmmo: number;
  matchScoreToWin: number;
  matchResetDelayMs: number;
  ammoPickupAmount: number;
  ammoPickupRespawnMs: number;
  healthPickupAmount: number;
  healthPickupRespawnMs: number;
  dummyMovementSpeed: number;
  dummyEngageRange: number;
  dummyRetreatRange: number;
  dummyShootRange: number;
  dummyLowHealthThreshold: number;
  hazardDamage: number;
  hazardTickMs: number;
}

interface BulletView {
  sprite: Phaser.GameObjects.Rectangle;
  velocityX: number;
  velocityY: number;
  damage: number;
  owner: "player" | "dummy";
}

interface ObstacleView {
  sprite: Phaser.GameObjects.Rectangle;
  bounds: Rect;
}

interface PickupView {
  sprite: Phaser.GameObjects.Rectangle;
  available: boolean;
  respawnAtMs: number | null;
}

interface PlayerWeaponSlot {
  readonly id: string;
  readonly label: string;
  readonly logic: WeaponLogic;
  readonly bulletColor: number;
  readonly bulletWidth: number;
  readonly bulletHeight: number;
  readonly pelletCount: number;
  readonly spreadRadians: number;
}

interface GateView extends ObstacleView {
  readonly id: string;
  open: boolean;
}

interface HazardZoneView {
  sprite: Phaser.GameObjects.Rectangle;
  bounds: Rect;
  logic: HazardZoneLogic;
}

export class MainScene extends Phaser.Scene {
  private static readonly PLAYER_SPAWN_X = 120;
  private static readonly PLAYER_SPAWN_Y = 120;
  private static readonly DUMMY_SPAWN_X = 760;
  private static readonly DUMMY_SPAWN_Y = 210;
  private static readonly RESPAWN_DELAY_MS = 1600;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private moveKeys?: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    sprint: Phaser.Input.Keyboard.Key;
    reload: Phaser.Input.Keyboard.Key;
    confirm: Phaser.Input.Keyboard.Key;
    weapon1: Phaser.Input.Keyboard.Key;
    weapon2: Phaser.Input.Keyboard.Key;
    interact: Phaser.Input.Keyboard.Key;
  };
  private playerSprite!: Phaser.GameObjects.Image;
  private targetDummy!: Phaser.GameObjects.Image;
  private ammoPickup!: PickupView;
  private healthPickup!: PickupView;
  private overlayPanel!: Phaser.GameObjects.Rectangle;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlaySubtitle!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private combatText!: Phaser.GameObjects.Text;
  private readonly playerLogic: PlayerLogic;
  private readonly dummyLogic: PlayerLogic;
  private readonly weaponSlots: PlayerWeaponSlot[];
  private readonly weaponInventory: WeaponInventoryLogic;
  private readonly dummyWeaponLogic: WeaponLogic;
  private readonly roundLogic: RoundLogic;
  private readonly dummyAiLogic: DummyAiLogic;
  private readonly gameBalance: GameBalance;
  private readonly bullets: BulletView[];
  private readonly obstacles: ObstacleView[];
  private gate!: GateView;
  private hazardZone!: HazardZoneView;
  private readonly dummyCoverPoints: CoverPoint[];
  private lastCombatEvent: string;
  private roundResetAtMs: number | null;
  private matchConfirmAtMs: number | null;
  private lastDummyDecision: DummyAiDecision["mode"];
  private lastDummyShouldFire: boolean;

  public constructor(gameBalance: GameBalance) {
    super("MainScene");
    this.gameBalance = gameBalance;
    this.playerLogic = new PlayerLogic(gameBalance.maxHealth, {
      movementSpeed: gameBalance.movementSpeed,
      dashMultiplier: gameBalance.dashMultiplier
    });
    this.dummyLogic = new PlayerLogic(gameBalance.maxHealth, {
      movementSpeed: gameBalance.dummyMovementSpeed,
      dashMultiplier: 1
    });
    this.weaponSlots = this.createPlayerWeaponSlots(gameBalance);
    this.weaponInventory = new WeaponInventoryLogic(
      this.weaponSlots.map((slot) => ({
        id: slot.id,
        label: slot.label
      }))
    );
    this.dummyWeaponLogic = new WeaponLogic({
      fireRateMs: 900,
      bulletSpeed: gameBalance.bulletSpeed * 0.75,
      damage: 12,
      magazineSize: 99,
      reloadTimeMs: 1,
      reserveAmmo: 999
    });
    this.roundLogic = new RoundLogic(gameBalance.matchScoreToWin);
    this.dummyAiLogic = new DummyAiLogic({
      engageRange: gameBalance.dummyEngageRange,
      retreatRange: gameBalance.dummyRetreatRange,
      shootRange: gameBalance.dummyShootRange,
      lowHealthThreshold: gameBalance.dummyLowHealthThreshold
    });
    this.bullets = [];
    this.obstacles = [];
    this.dummyCoverPoints = [
      { x: 700, y: 160 },
      { x: 690, y: 390 },
      { x: 260, y: 330 }
    ];
    this.lastCombatEvent = "READY";
    this.roundResetAtMs = null;
    this.matchConfirmAtMs = null;
    this.lastDummyDecision = "chase";
    this.lastDummyShouldFire = false;
  }

  public create(): void {
    if (this.input.keyboard === null) {
      throw new Error("Keyboard input is unavailable in MainScene.");
    }

    this.add
      .text(24, 18, "Harness Stage", {
        color: "#c9e0ff",
        fontFamily: "monospace",
        fontSize: "20px"
      })
      .setAlpha(0.85);

    this.add
      .text(24, 46, "WASD move / SPACE sprint / MOUSE aim / R reload / 1-2 weapon / E gate / ENTER confirm", {
        color: "#7ba8de",
        fontFamily: "monospace",
        fontSize: "13px"
      })
      .setAlpha(0.9);

    this.statusText = this.add
      .text(24, 78, "", {
        color: "#90f3c8",
        fontFamily: "monospace",
        fontSize: "13px"
      })
      .setAlpha(0.95);

    this.combatText = this.add
      .text(24, 140, "", {
        color: "#ffb873",
        fontFamily: "monospace",
        fontSize: "13px"
      })
      .setAlpha(0.95);
    this.overlayPanel = this.add.rectangle(480, 270, 430, 180, 0x050b14, 0.86).setStrokeStyle(2, 0x7ba8de, 0.9);
    this.overlayTitle = this.add.text(480, 232, "", {
      color: "#f6f8ff",
      fontFamily: "monospace",
      fontSize: "28px"
    }).setOrigin(0.5);
    this.overlaySubtitle = this.add.text(480, 290, "", {
      color: "#9bc2ef",
      fontFamily: "monospace",
      fontSize: "16px",
      align: "center"
    }).setOrigin(0.5);
    this.setOverlayVisible(false);

    this.createActorSkins();
    this.add.rectangle(480, 270, 860, 420, 0x10213f, 0.9).setStrokeStyle(2, 0x2b5085, 0.9);
    this.addObstacle(480, 270, 120, 120, 0x16325d);
    this.addObstacle(260, 180, 80, 180, 0x1b4378);
    this.addObstacle(710, 340, 160, 60, 0x204b7e);
    this.gate = this.addGate(482, 430, 96, 24, 0xf4a261);
    this.hazardZone = this.addHazardZone(510, 138, 170, 46);
    this.ammoPickup = {
      sprite: this.add.rectangle(160, 430, 22, 22, 0x7fd6ff, 1).setStrokeStyle(2, 0x173447, 1),
      available: true,
      respawnAtMs: null
    };
    this.healthPickup = {
      sprite: this.add.rectangle(870, 430, 22, 22, 0x8df0c3, 1).setStrokeStyle(2, 0x173322, 1),
      available: true,
      respawnAtMs: null
    };

    this.playerSprite = this.add.image(MainScene.PLAYER_SPAWN_X, MainScene.PLAYER_SPAWN_Y, "skin-player").setDepth(5);
    this.targetDummy = this.add.image(MainScene.DUMMY_SPAWN_X, MainScene.DUMMY_SPAWN_Y, "skin-dummy").setDepth(5);
    this.playerLogic.reset(0, 0);
    this.dummyLogic.reset(MainScene.DUMMY_SPAWN_X - 120, MainScene.DUMMY_SPAWN_Y - 120);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.moveKeys = {
      up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      sprint: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      reload: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      confirm: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      weapon1: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      weapon2: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      interact: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    };
  }

  public update(_: number, delta: number): void {
    if (this.cursors === undefined || this.moveKeys === undefined) {
      return;
    }

    const now = this.time.now;
    const deltaSeconds = delta / 1000;
    const inputLocked = this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || this.playerLogic.isStunned(now);
    const horizontal = inputLocked
      ? 0
      : Number(this.moveKeys.right.isDown || this.cursors.right.isDown) -
        Number(this.moveKeys.left.isDown || this.cursors.left.isDown);
    const vertical = inputLocked
      ? 0
      : Number(this.moveKeys.down.isDown || this.cursors.down.isDown) -
        Number(this.moveKeys.up.isDown || this.cursors.up.isDown);
    const previousX = this.playerLogic.state.positionX;
    const previousY = this.playerLogic.state.positionY;

    this.playerLogic.move(
      {
        x: horizontal,
        y: vertical,
        sprint: this.moveKeys.sprint.isDown
      },
      deltaSeconds,
      now
    );

    let playerCenterX = Phaser.Math.Clamp(this.playerLogic.state.positionX + 120, 40, 920);
    let playerCenterY = Phaser.Math.Clamp(this.playerLogic.state.positionY + 120, 40, 500);
    for (const slot of this.weaponSlots) {
      slot.logic.update(now);
    }
    this.dummyWeaponLogic.update(now);
    this.handleRoundReset(now);
    this.handleMatchConfirm(now);
    this.handleAmmoPickup(now);
    this.handleHealthPickup(now);
    this.handleWeaponSwitch();
    this.handleGateInteraction();
    this.handleHazardZone(now);
    this.updateDummyMovement(deltaSeconds, now);

    if (!this.roundLogic.state.isMatchOver) {
      this.playerLogic.updateAim(this.input.activePointer.worldX - 120, this.input.activePointer.worldY - 120, now);
    }

    const playerBlocked = this.resolvePlayerObstacleCollision(playerCenterX, playerCenterY, previousX, previousY);

    if (playerBlocked) {
      playerCenterX = previousX + 120;
      playerCenterY = previousY + 120;
    }

    this.playerSprite.setPosition(playerCenterX, playerCenterY);
    this.playerSprite.setRotation(this.playerLogic.state.aimAngleRadians);
    this.handleReloadInterrupt(now);
    this.handleReload(now);
    this.handleFire(now);
    this.handleDummyFire(now);
    this.updateBullets(deltaSeconds);
    this.updatePlayerVisuals(now);
    this.updateDummyVisuals();
    this.updateMatchOverlay(now);
    this.statusText.setText([
      `POS ${this.playerLogic.state.positionX.toFixed(1)}, ${this.playerLogic.state.positionY.toFixed(1)}`,
      `MODE ${this.playerLogic.state.isSprinting ? "SPRINT" : "WALK"} @ ${this.playerLogic.state.lastAppliedSpeed.toFixed(0)}`,
      `AIM ${(Phaser.Math.RadToDeg(this.playerLogic.state.aimAngleRadians)).toFixed(1)} deg`,
      `HP ${this.playerLogic.state.health}/${this.playerLogic.state.maxHealth}`,
      `STATE ${this.roundLogic.state.isMatchOver ? "MATCH LOCK" : this.playerLogic.isDead() ? "DOWN" : this.playerLogic.isStunned(now) ? "STUNNED" : "ACTIVE"}`,
      `ROUND RESET ${this.roundResetAtMs === null ? "READY" : Math.max(0, this.roundResetAtMs - now).toFixed(0)}`,
      `MATCH CONFIRM ${this.getMatchConfirmStatus(now)}`,
      `STUN ${Math.max(0, this.playerLogic.state.stunUntilMs - now).toFixed(0)}`,
      `PICKUP ${this.getPickupStatus(now)}`,
      `MED ${this.getHealthPickupStatus(now)}`,
      `GATE ${this.gate.open ? "OPEN" : "CLOSED"}`,
      `HAZARD ${this.gameBalance.hazardDamage}/${this.gameBalance.hazardTickMs}ms`,
      `DUMMY AI ${this.lastDummyDecision.toUpperCase()}`,
      `BLOCK ${playerBlocked ? "YES" : "NO"}`
    ]);
    const activeWeapon = this.getActiveWeaponSlot();
    this.combatText.setText([
      `ROUND ${this.roundLogic.state.roundNumber} | SCORE P ${this.roundLogic.state.playerScore} - D ${this.roundLogic.state.dummyScore} / ${this.roundLogic.state.scoreToWin}`,
      `WEAPON ${this.weaponInventory.getActiveIndex() + 1}:${activeWeapon.label}`,
      `FIRE ${activeWeapon.logic.getCooldownRemaining(now).toFixed(0)} ms`,
      `AMMO ${activeWeapon.logic.getAmmoInMagazine(now)}/${activeWeapon.logic.getMagazineSize()} | RESERVE ${activeWeapon.logic.getReserveAmmo(now)}`,
      `RELOAD ${activeWeapon.logic.getReloadRemaining(now).toFixed(0)} ms`,
      `DUMMY HP ${this.dummyLogic.state.health}/${this.dummyLogic.state.maxHealth}`,
      `EVENT ${this.lastCombatEvent}`,
      `ROUND RESULT ${this.roundLogic.state.lastResult}`,
      `MATCH ${this.roundLogic.state.matchWinner ?? "IN PROGRESS"}`
    ]);
  }

  private handleReload(now: number): void {
    if (this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || this.playerLogic.isStunned(now)) {
      return;
    }

    if (!Phaser.Input.Keyboard.JustDown(this.moveKeys!.reload)) {
      return;
    }

    if (this.getActiveWeaponSlot().logic.startReload(now)) {
      this.lastCombatEvent = "RELOADING";
      return;
    }

    this.lastCombatEvent = "NO RESERVE";
  }

  private handleReloadInterrupt(now: number): void {
    if (this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || this.moveKeys === undefined) {
      return;
    }

    if ((!this.moveKeys.sprint.isDown && !this.playerLogic.isStunned(now)) || !this.getActiveWeaponSlot().logic.isReloading(now)) {
      return;
    }

    if (this.getActiveWeaponSlot().logic.cancelReload(now)) {
      this.lastCombatEvent = this.playerLogic.isStunned(now) ? "STUN CANCELED RELOAD" : "RELOAD CANCELED";
    }
  }

  private handleFire(now: number): void {
    if (
      !this.input.activePointer.isDown ||
      this.dummyLogic.isDead() ||
      this.playerLogic.isDead() ||
      this.roundLogic.state.isMatchOver ||
      this.playerLogic.isStunned(now)
    ) {
      return;
    }

    const activeWeapon = this.getActiveWeaponSlot();
    const attempt = activeWeapon.logic.tryFire(now);

    if (!attempt.allowed) {
      this.lastCombatEvent = attempt.reason.toUpperCase();
      return;
    }

    this.spawnPlayerProjectiles(activeWeapon, attempt.bulletSpeed, attempt.damage);
    this.lastCombatEvent = `${activeWeapon.label.toUpperCase()} FIRED`;

    if (attempt.ammoInMagazine === 0) {
      this.lastCombatEvent = "MAG EMPTY";
    }
  }

  private spawnPlayerProjectiles(activeWeapon: PlayerWeaponSlot, bulletSpeed: number, damage: number): void {
    const pelletStart = -(activeWeapon.pelletCount - 1) / 2;

    for (let index = 0; index < activeWeapon.pelletCount; index += 1) {
      const spreadOffset = (pelletStart + index) * activeWeapon.spreadRadians;
      const angle = this.playerLogic.state.aimAngleRadians + spreadOffset;
      const bullet = this.add.rectangle(
        this.playerSprite.x,
        this.playerSprite.y,
        activeWeapon.bulletWidth,
        activeWeapon.bulletHeight,
        activeWeapon.bulletColor,
        1
      );
      bullet.setRotation(angle);

      this.bullets.push({
        sprite: bullet,
        velocityX: Math.cos(angle) * bulletSpeed,
        velocityY: Math.sin(angle) * bulletSpeed,
        damage,
        owner: "player"
      });
    }
  }

  private handleDummyFire(now: number): void {
    if (this.dummyLogic.isDead() || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver) {
      return;
    }

    if (!this.lastDummyShouldFire) {
      return;
    }

    const attempt = this.dummyWeaponLogic.tryFire(now);

    if (!attempt.allowed) {
      return;
    }

    const bullet = this.add.rectangle(this.targetDummy.x, this.targetDummy.y, 10, 4, 0xff8b8b, 1);
    bullet.setRotation(this.dummyLogic.state.aimAngleRadians);

    this.bullets.push({
      sprite: bullet,
      velocityX: Math.cos(this.dummyLogic.state.aimAngleRadians) * attempt.bulletSpeed,
      velocityY: Math.sin(this.dummyLogic.state.aimAngleRadians) * attempt.bulletSpeed,
      damage: attempt.damage,
      owner: "dummy"
    });
  }

  private handleWeaponSwitch(): void {
    if (this.moveKeys === undefined || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.moveKeys.weapon1) && this.weaponInventory.selectSlot(0)) {
      this.lastCombatEvent = `EQUIPPED ${this.getActiveWeaponSlot().label.toUpperCase()}`;
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.moveKeys.weapon2) && this.weaponInventory.selectSlot(1)) {
      this.lastCombatEvent = `EQUIPPED ${this.getActiveWeaponSlot().label.toUpperCase()}`;
    }
  }

  private handleGateInteraction(): void {
    if (this.moveKeys === undefined || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver) {
      return;
    }

    if (!Phaser.Input.Keyboard.JustDown(this.moveKeys.interact)) {
      return;
    }

    const distanceToGate = Phaser.Math.Distance.Between(
      this.playerSprite.x,
      this.playerSprite.y,
      this.gate.bounds.x + this.gate.bounds.width / 2,
      this.gate.bounds.y + this.gate.bounds.height / 2
    );

    if (distanceToGate > 92) {
      this.lastCombatEvent = "GATE TOO FAR";
      return;
    }

    this.gate.open = !this.gate.open;
    this.gate.sprite.setAlpha(this.gate.open ? 0.22 : 1);
    this.gate.sprite.setFillStyle(this.gate.open ? 0x6a7f91 : 0xf4a261, this.gate.open ? 0.22 : 1);
    this.lastCombatEvent = this.gate.open ? "GATE OPENED" : "GATE CLOSED";
  }

  private handleHazardZone(now: number): void {
    if (this.roundLogic.state.isMatchOver) {
      return;
    }

    this.applyHazardToActor("player", this.playerSprite, this.playerLogic, now);
    this.applyHazardToActor("dummy", this.targetDummy, this.dummyLogic, now);
  }

  private applyHazardToActor(
    actorId: "player" | "dummy",
    sprite: Phaser.GameObjects.Image,
    actorLogic: PlayerLogic,
    now: number
  ): void {
    if (actorLogic.isDead()) {
      return;
    }

    const overlapping = intersectsRect(
      createCenteredRect(sprite.x, sprite.y, sprite.width, sprite.height),
      this.hazardZone.bounds
    );
    const tick = this.hazardZone.logic.tick(actorId, overlapping, now);

    if (!tick.triggered) {
      return;
    }

    actorLogic.takeDamage(tick.damage, Math.floor(this.gameBalance.hitStunMs / 2), now);
    this.lastCombatEvent = `${actorId.toUpperCase()} HAZARD -${tick.damage}`;

    if (!actorLogic.isDead()) {
      return;
    }

    if (actorId === "player") {
      this.roundLogic.registerDummyWin();
    } else {
      this.roundLogic.registerPlayerWin();
    }

    this.scheduleResetAfterRound(now);
  }

  private updateBullets(deltaSeconds: number): void {
    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];
      bullet.sprite.x += bullet.velocityX * deltaSeconds;
      bullet.sprite.y += bullet.velocityY * deltaSeconds;

      const outOfBounds = bullet.sprite.x < 0 || bullet.sprite.x > 960 || bullet.sprite.y < 0 || bullet.sprite.y > 540;
      const hitObstacle = this.getActiveObstacles().some((obstacle) =>
        intersectsRect(
          createCenteredRect(bullet.sprite.x, bullet.sprite.y, bullet.sprite.width, bullet.sprite.height),
          obstacle.bounds
        )
      );
      const hitDummy = !this.dummyLogic.isDead() && Phaser.Geom.Intersects.RectangleToRectangle(
        bullet.sprite.getBounds(),
        this.targetDummy.getBounds()
      );
      const hitPlayer = !this.playerLogic.isDead() && Phaser.Geom.Intersects.RectangleToRectangle(
        bullet.sprite.getBounds(),
        this.playerSprite.getBounds()
      );

      if (hitDummy && bullet.owner === "player") {
        this.dummyLogic.takeDamage(bullet.damage);
        this.lastCombatEvent = this.dummyLogic.isDead() ? "TARGET DOWN" : `HIT ${bullet.damage}`;

        if (this.dummyLogic.isDead()) {
          this.roundLogic.registerPlayerWin();
          this.scheduleResetAfterRound(this.time.now);
        }
      }

      if (hitPlayer && bullet.owner === "dummy") {
        this.playerLogic.takeDamage(bullet.damage, this.gameBalance.hitStunMs, this.time.now);
        this.lastCombatEvent = this.playerLogic.isDead() ? "PLAYER DOWN" : `STUNNED ${bullet.damage}`;

        if (this.playerLogic.isDead()) {
          this.roundLogic.registerDummyWin();
          this.scheduleResetAfterRound(this.time.now);
        }
      }

      if (hitObstacle) {
        this.lastCombatEvent = "SHOT BLOCKED";
      }

      if (outOfBounds || hitDummy || hitPlayer || hitObstacle) {
        bullet.sprite.destroy();
        this.bullets.splice(index, 1);
      }
    }
  }

  private updateDummyVisuals(): void {
    const healthRatio = this.dummyLogic.state.health / this.dummyLogic.state.maxHealth;
    const fill = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x4f1717),
      Phaser.Display.Color.ValueToColor(0xffffff),
      100,
      Math.round(healthRatio * 100)
    );

    this.targetDummy.setTint(Phaser.Display.Color.GetColor(fill.r, fill.g, fill.b));
    this.targetDummy.setAlpha(this.dummyLogic.isDead() ? 0.35 : 1);
    this.targetDummy.setScale(this.dummyLogic.isDead() ? 0.82 : this.lastDummyDecision === "flank" ? 1.06 : 1);
  }

  private updatePlayerVisuals(now: number): void {
    if (this.playerLogic.isDead()) {
      this.playerSprite.setTint(0x5a6a75);
      this.playerSprite.setAlpha(0.35);
      this.playerSprite.setScale(0.82);
      return;
    }

    if (this.playerLogic.isStunned(now)) {
      this.playerSprite.setTint(0xfff27a);
      this.playerSprite.setAlpha(1);
      this.playerSprite.setScale(0.94);
      return;
    }

    this.playerSprite.setTint(0xffffff);
    this.playerSprite.setAlpha(1);
    this.playerSprite.setScale(this.playerLogic.state.isSprinting ? 1.08 : 1);
  }

  private updateDummyMovement(deltaSeconds: number, now: number): void {
    if (this.dummyLogic.isDead() || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver) {
      this.dummyLogic.move({ x: 0, y: 0, sprint: false }, deltaSeconds, now);
      return;
    }

    const previousX = this.dummyLogic.state.positionX;
    const previousY = this.dummyLogic.state.positionY;
    const decision = this.dummyAiLogic.evaluate({
      dummyX: this.targetDummy.x,
      dummyY: this.targetDummy.y,
      playerX: this.playerSprite.x,
      playerY: this.playerSprite.y,
      tickMs: now,
      healthRatio: this.dummyLogic.state.health / this.dummyLogic.state.maxHealth,
      coverPoints: this.dummyCoverPoints,
      lineOfSightBlockers: this.getActiveObstacles().map((obstacle) => obstacle.bounds)
    });

    this.lastDummyDecision = decision.mode;
    this.lastDummyShouldFire = decision.shouldFire;
    this.dummyLogic.move(
      {
        x: decision.moveX,
        y: decision.moveY,
        sprint: false
      },
      deltaSeconds,
      now
    );
    this.dummyLogic.updateAim(this.playerSprite.x - 120, this.playerSprite.y - 120, now);

    let dummyCenterX = Phaser.Math.Clamp(this.dummyLogic.state.positionX + 120, 40, 920);
    let dummyCenterY = Phaser.Math.Clamp(this.dummyLogic.state.positionY + 120, 40, 500);
    const blocked = this.resolveActorObstacleCollision(
      dummyCenterX,
      dummyCenterY,
      previousX,
      previousY,
      this.targetDummy,
      this.dummyLogic
    );

    if (blocked) {
      dummyCenterX = previousX + 120;
      dummyCenterY = previousY + 120;
      this.lastDummyDecision = "strafe";
    }

    this.targetDummy.setPosition(dummyCenterX, dummyCenterY);
    this.targetDummy.setRotation(this.dummyLogic.state.aimAngleRadians);
  }

  private handleRoundReset(now: number): void {
    if (this.roundResetAtMs === null || now < this.roundResetAtMs) {
      return;
    }

    this.resetRoundState();
    this.roundResetAtMs = null;
    this.lastCombatEvent = "RESPAWNED";
  }

  private handleMatchConfirm(now: number): void {
    if (this.matchConfirmAtMs === null || this.moveKeys === undefined) {
      return;
    }

    if (now < this.matchConfirmAtMs) {
      return;
    }

    if (!Phaser.Input.Keyboard.JustDown(this.moveKeys.confirm)) {
      return;
    }

    this.roundLogic.resetMatch();
    this.resetRoundState();
    this.matchConfirmAtMs = null;
    this.roundResetAtMs = null;
    this.lastCombatEvent = "NEW MATCH";
  }

  private updateMatchOverlay(now: number): void {
    if (!this.roundLogic.state.isMatchOver || this.matchConfirmAtMs === null) {
      this.setOverlayVisible(false);
      return;
    }

    const remainingMs = Math.max(0, this.matchConfirmAtMs - now).toFixed(0);
    const confirmText = now >= this.matchConfirmAtMs ? "Press ENTER to start the next match." : `Confirm unlock in ${remainingMs} ms`;
    this.overlayTitle.setText(`${this.roundLogic.state.matchWinner ?? "MATCH"} VICTORY`);
    this.overlaySubtitle.setText(confirmText);
    this.setOverlayVisible(true);
  }

  private handleAmmoPickup(now: number): void {
    if (!this.ammoPickup.available && this.ammoPickup.respawnAtMs !== null && now >= this.ammoPickup.respawnAtMs) {
      this.ammoPickup.available = true;
      this.ammoPickup.respawnAtMs = null;
      this.ammoPickup.sprite.setVisible(true);
    }

    if (!this.ammoPickup.available || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver) {
      return;
    }

    const pickupBounds = this.ammoPickup.sprite.getBounds();
    const playerBounds = this.playerSprite.getBounds();

    if (!Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, pickupBounds)) {
      return;
    }

    const restoredAmmo = this.getActiveWeaponSlot().logic.addReserveAmmo(this.gameBalance.ammoPickupAmount, now);

    if (restoredAmmo === 0) {
      this.lastCombatEvent = "AMMO FULL";
      return;
    }

    this.ammoPickup.available = false;
    this.ammoPickup.respawnAtMs = now + this.gameBalance.ammoPickupRespawnMs;
    this.ammoPickup.sprite.setVisible(false);
    this.lastCombatEvent = `AMMO +${restoredAmmo}`;
  }

  private handleHealthPickup(now: number): void {
    if (!this.healthPickup.available && this.healthPickup.respawnAtMs !== null && now >= this.healthPickup.respawnAtMs) {
      this.healthPickup.available = true;
      this.healthPickup.respawnAtMs = null;
      this.healthPickup.sprite.setVisible(true);
    }

    if (!this.healthPickup.available || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver) {
      return;
    }

    const pickupBounds = this.healthPickup.sprite.getBounds();
    const playerBounds = this.playerSprite.getBounds();

    if (!Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, pickupBounds)) {
      return;
    }

    const restoredHealth = this.playerLogic.heal(this.gameBalance.healthPickupAmount);

    if (restoredHealth === 0) {
      this.lastCombatEvent = "HP FULL";
      return;
    }

    this.healthPickup.available = false;
    this.healthPickup.respawnAtMs = now + this.gameBalance.healthPickupRespawnMs;
    this.healthPickup.sprite.setVisible(false);
    this.lastCombatEvent = `HEAL +${restoredHealth}`;
  }

  private scheduleResetAfterRound(now: number): void {
    this.clearBullets();

    if (this.roundLogic.state.isMatchOver) {
      this.matchConfirmAtMs = now + this.gameBalance.matchResetDelayMs;
      this.roundResetAtMs = null;
      this.lastCombatEvent = `${this.roundLogic.state.matchWinner ?? "MATCH"} LOCKED`;
      return;
    }

    if (this.roundResetAtMs === null) {
      this.roundResetAtMs = now + MainScene.RESPAWN_DELAY_MS;
    }
  }

  private resetRoundState(): void {
    this.playerLogic.reset(0, 0);
    this.dummyLogic.reset(MainScene.DUMMY_SPAWN_X - 120, MainScene.DUMMY_SPAWN_Y - 120);
    for (const slot of this.weaponSlots) {
      slot.logic.reset();
    }
    this.weaponInventory.reset();
    this.dummyWeaponLogic.reset();
    this.hazardZone.logic.reset();
    this.clearBullets();
    this.playerSprite.setPosition(MainScene.PLAYER_SPAWN_X, MainScene.PLAYER_SPAWN_Y);
    this.playerSprite.setRotation(0);
    this.playerSprite.setTint(0xffffff);
    this.playerSprite.setAlpha(1);
    this.playerSprite.setScale(1);
    this.targetDummy.setPosition(MainScene.DUMMY_SPAWN_X, MainScene.DUMMY_SPAWN_Y);
    this.targetDummy.setRotation(0);
    this.targetDummy.setTint(0xffffff);
    this.targetDummy.setAlpha(1);
    this.targetDummy.setScale(1);
    this.lastDummyDecision = "chase";
    this.lastDummyShouldFire = false;
    this.resetPickupState();
  }

  private clearBullets(): void {
    for (const bullet of this.bullets) {
      bullet.sprite.destroy();
    }

    this.bullets.length = 0;
  }

  private resetPickupState(): void {
    this.ammoPickup.available = true;
    this.ammoPickup.respawnAtMs = null;
    this.ammoPickup.sprite.setVisible(true);
    this.healthPickup.available = true;
    this.healthPickup.respawnAtMs = null;
    this.healthPickup.sprite.setVisible(true);
  }

  private getActiveWeaponSlot(): PlayerWeaponSlot {
    return this.weaponSlots[this.weaponInventory.getActiveIndex()];
  }

  private getActiveObstacles(): ObstacleView[] {
    return this.obstacles.filter((obstacle) => obstacle !== this.gate || !this.gate.open);
  }

  private getPickupStatus(now: number): string {
    if (this.ammoPickup.available) {
      return "READY";
    }

    if (this.ammoPickup.respawnAtMs === null) {
      return "OFF";
    }

    return Math.max(0, this.ammoPickup.respawnAtMs - now).toFixed(0);
  }

  private getHealthPickupStatus(now: number): string {
    if (this.healthPickup.available) {
      return "READY";
    }

    if (this.healthPickup.respawnAtMs === null) {
      return "OFF";
    }

    return Math.max(0, this.healthPickup.respawnAtMs - now).toFixed(0);
  }

  private getMatchConfirmStatus(now: number): string {
    if (this.matchConfirmAtMs === null) {
      return "READY";
    }

    if (now >= this.matchConfirmAtMs) {
      return "ENTER";
    }

    return Math.max(0, this.matchConfirmAtMs - now).toFixed(0);
  }

  private setOverlayVisible(visible: boolean): void {
    this.overlayPanel.setVisible(visible);
    this.overlayTitle.setVisible(visible);
    this.overlaySubtitle.setVisible(visible);
  }

  private addObstacle(x: number, y: number, width: number, height: number, color: number): void {
    const sprite = this.add.rectangle(x, y, width, height, color, 1);
    this.obstacles.push({
      sprite,
      bounds: createCenteredRect(x, y, width, height)
    });
  }

  private addGate(x: number, y: number, width: number, height: number, color: number): GateView {
    const sprite = this.add.rectangle(x, y, width, height, color, 1).setStrokeStyle(2, 0xffe0b5, 1);
    const gate = {
      id: "service-gate",
      sprite,
      bounds: createCenteredRect(x, y, width, height),
      open: false
    };
    this.obstacles.push(gate);
    return gate;
  }

  private addHazardZone(x: number, y: number, width: number, height: number): HazardZoneView {
    const sprite = this.add
      .rectangle(x, y, width, height, 0x7d2ae8, 0.32)
      .setStrokeStyle(2, 0xd8b4fe, 0.86);

    this.add
      .text(x, y, "VENT", {
        color: "#f5d0fe",
        fontFamily: "monospace",
        fontSize: "12px"
      })
      .setOrigin(0.5)
      .setAlpha(0.82);

    return {
      sprite,
      bounds: createCenteredRect(x, y, width, height),
      logic: new HazardZoneLogic(this.gameBalance.hazardDamage, this.gameBalance.hazardTickMs)
    };
  }

  private createPlayerWeaponSlots(gameBalance: GameBalance): PlayerWeaponSlot[] {
    return [
      this.createWeaponSlot("carbine", "Carbine", {
        fireRateMs: gameBalance.fireRateMs,
        bulletSpeed: gameBalance.bulletSpeed,
        damage: gameBalance.bulletDamage,
        magazineSize: gameBalance.magazineSize,
        reloadTimeMs: gameBalance.reloadTimeMs,
        reserveAmmo: gameBalance.reserveAmmo
      }, {
        bulletColor: 0xfff27a,
        bulletWidth: 10,
        bulletHeight: 4,
        pelletCount: 1,
        spreadRadians: 0
      }),
      this.createWeaponSlot("scatter", "Scatter", {
        fireRateMs: 620,
        bulletSpeed: gameBalance.bulletSpeed * 0.82,
        damage: 12,
        magazineSize: 2,
        reloadTimeMs: 1450,
        reserveAmmo: 12
      }, {
        bulletColor: 0xffb86c,
        bulletWidth: 8,
        bulletHeight: 4,
        pelletCount: 3,
        spreadRadians: Phaser.Math.DegToRad(7)
      })
    ];
  }

  private createWeaponSlot(
    id: string,
    label: string,
    config: WeaponConfig,
    view: {
      readonly bulletColor: number;
      readonly bulletWidth: number;
      readonly bulletHeight: number;
      readonly pelletCount: number;
      readonly spreadRadians: number;
    }
  ): PlayerWeaponSlot {
    return {
      id,
      label,
      logic: new WeaponLogic(config),
      ...view
    };
  }

  private createActorSkins(): void {
    this.createActorTexture("skin-player", {
      bodyColor: 0x5ee7b7,
      headColor: 0xc9ffe8,
      accentColor: 0x1b6f5b,
      weaponColor: 0xfff27a
    });
    this.createActorTexture("skin-dummy", {
      bodyColor: 0xff6b6b,
      headColor: 0xffc2c2,
      accentColor: 0x7f1d1d,
      weaponColor: 0xff8b8b
    });
  }

  private createActorTexture(
    textureKey: string,
    palette: {
      readonly bodyColor: number;
      readonly headColor: number;
      readonly accentColor: number;
      readonly weaponColor: number;
    }
  ): void {
    if (this.textures.exists(textureKey)) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0);
    graphics.fillRect(0, 0, 44, 30);
    graphics.fillStyle(palette.weaponColor, 1);
    graphics.fillRoundedRect(26, 12, 16, 6, 2);
    graphics.fillStyle(palette.accentColor, 1);
    graphics.fillRoundedRect(6, 5, 25, 20, 8);
    graphics.fillStyle(palette.bodyColor, 1);
    graphics.fillRoundedRect(9, 7, 21, 16, 7);
    graphics.fillStyle(palette.headColor, 1);
    graphics.fillCircle(26, 15, 6);
    graphics.lineStyle(2, palette.accentColor, 1);
    graphics.strokeRoundedRect(6, 5, 25, 20, 8);
    graphics.generateTexture(textureKey, 44, 30);
    graphics.destroy();
  }

  private resolvePlayerObstacleCollision(
    centerX: number,
    centerY: number,
    previousX: number,
    previousY: number
  ): boolean {
    return this.resolveActorObstacleCollision(
      centerX,
      centerY,
      previousX,
      previousY,
      this.playerSprite,
      this.playerLogic
    );
  }

  private resolveActorObstacleCollision(
    centerX: number,
    centerY: number,
    previousX: number,
    previousY: number,
    sprite: Phaser.GameObjects.Image,
    actorLogic: PlayerLogic
  ): boolean {
    const playerBounds = createCenteredRect(centerX, centerY, sprite.width, sprite.height);
    const blocked = this.getActiveObstacles().some((obstacle) => intersectsRect(playerBounds, obstacle.bounds));

    if (!blocked) {
      return false;
    }

    actorLogic.state.positionX = previousX;
    actorLogic.state.positionY = previousY;

    if (actorLogic === this.playerLogic) {
      this.lastCombatEvent = "MOVE BLOCKED";
    }

    return true;
  }
}
