import Phaser from "phaser";
import { GeneratedAudioCuePlayer } from "../domain/audio/GeneratedAudioCuePlayer";
import { SoundCueLogic, type SoundCueEvent, type SoundCueKey } from "../domain/audio/SoundCueLogic";
import { DummyAiLogic, type CoverPoint, type DummyAiDecision } from "../domain/ai/DummyAiLogic";
import { createCenteredRect, intersectsRect, type Rect } from "../domain/collision/CollisionLogic";
import { WeaponInventoryLogic } from "../domain/combat/WeaponInventoryLogic";
import { WeaponLogic, type WeaponConfig } from "../domain/combat/WeaponLogic";
import { HazardZoneLogic } from "../domain/map/HazardZoneLogic";
import { PlayerLogic } from "../domain/player/PlayerLogic";
import {
  MatchFlowLogic,
  type SpawnAssignment,
  type SpawnPoint,
  type TeamId
} from "../domain/round/MatchFlowLogic";
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
  roundStartDelayMs: number;
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
  coverPointRadius: number;
  actorSkinSource: string;
  actorSpritesheetPath: string;
  actorFrameWidth: number;
  actorFrameHeight: number;
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

interface CoverPointView {
  sprite: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

interface TeamSpawnTable {
  BLUE: readonly SpawnPoint[];
  RED: readonly SpawnPoint[];
}

interface MainSceneDebugSnapshot {
  phase: string;
  team: TeamId | "UNSET";
  spawn: string;
  activeWeapon: string;
  weaponSlot: number;
  ammoInMagazine: number;
  reserveAmmo: number;
  playerHealth: number;
  dummyHealth: number;
  gateOpen: boolean;
  roundNumber: number;
  playerScore: number;
  dummyScore: number;
  lastEvent: string;
}

type DebugTeamSelection = TeamId;

export class MainScene extends Phaser.Scene {
  private static readonly RESPAWN_DELAY_MS = 1600;
  private static readonly RESPAWN_FX_MS = 900;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private moveKeys?: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    sprint: Phaser.Input.Keyboard.Key;
    reload: Phaser.Input.Keyboard.Key;
    confirm: Phaser.Input.Keyboard.Key;
    fire: Phaser.Input.Keyboard.Key;
    swap: Phaser.Input.Keyboard.Key;
    weapon1: Phaser.Input.Keyboard.Key;
    weapon2: Phaser.Input.Keyboard.Key;
    interact: Phaser.Input.Keyboard.Key;
  };
  private playerSprite!: Phaser.GameObjects.Image;
  private targetDummy!: Phaser.GameObjects.Image;
  private crosshairHorizontal!: Phaser.GameObjects.Rectangle;
  private crosshairVertical!: Phaser.GameObjects.Rectangle;
  private muzzleFlash!: Phaser.GameObjects.Arc;
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
  private readonly soundCueLogic: SoundCueLogic;
  private readonly audioCuePlayer: GeneratedAudioCuePlayer;
  private readonly gameBalance: GameBalance;
  private readonly bullets: BulletView[];
  private readonly obstacles: ObstacleView[];
  private readonly matchFlow: MatchFlowLogic;
  private readonly spawnTable: TeamSpawnTable;
  private gate!: GateView;
  private hazardZone!: HazardZoneView;
  private readonly dummyCoverPoints: CoverPoint[];
  private readonly coverPointViews: CoverPointView[];
  private lastCombatEvent: string;
  private roundResetAtMs: number | null;
  private roundStartUntilMs: number;
  private respawnFxUntilMs: number;
  private matchConfirmAtMs: number | null;
  private matchConfirmReadyCueSent: boolean;
  private lastSoundCue: SoundCueKey | "NONE";
  private lastDummyDecision: DummyAiDecision["mode"];
  private lastDummyShouldFire: boolean;
  private lastSpawnSummary: string;
  private muzzleFlashUntilMs: number;

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
    this.soundCueLogic = new SoundCueLogic();
    this.audioCuePlayer = new GeneratedAudioCuePlayer();
    this.bullets = [];
    this.obstacles = [];
    this.matchFlow = new MatchFlowLogic();
    this.spawnTable = {
      BLUE: [
        { x: 120, y: 120, label: "BLUE ENTRY A" },
        { x: 162, y: 428, label: "BLUE ENTRY B" },
        { x: 286, y: 102, label: "BLUE ENTRY C" }
      ],
      RED: [
        { x: 760, y: 210, label: "RED ENTRY A" },
        { x: 846, y: 428, label: "RED ENTRY B" },
        { x: 672, y: 116, label: "RED ENTRY C" }
      ]
    };
    this.dummyCoverPoints = [
      { x: 700, y: 160 },
      { x: 690, y: 390 },
      { x: 260, y: 330 }
    ];
    this.coverPointViews = [];
    this.lastCombatEvent = "READY";
    this.roundResetAtMs = null;
    this.roundStartUntilMs = 0;
    this.respawnFxUntilMs = 0;
    this.matchConfirmAtMs = null;
    this.matchConfirmReadyCueSent = false;
    this.lastSoundCue = "NONE";
    this.lastDummyDecision = "chase";
    this.lastDummyShouldFire = false;
    this.lastSpawnSummary = "WAITING";
    this.muzzleFlashUntilMs = 0;
  }

  public preload(): void {
    if (this.gameBalance.actorSkinSource !== "spritesheet") {
      return;
    }

    this.load.spritesheet("actor-skins", this.gameBalance.actorSpritesheetPath, {
      frameWidth: this.gameBalance.actorFrameWidth,
      frameHeight: this.gameBalance.actorFrameHeight
    });
  }

  public create(): void {
    if (this.input.keyboard === null) {
      throw new Error("Keyboard input is unavailable in MainScene.");
    }

    this.add
      .text(24, 18, "Arena Control", {
        color: "#c9e0ff",
        fontFamily: "monospace",
        fontSize: "20px"
      })
      .setAlpha(0.85);

    this.add
      .text(24, 46, "ENTER stage / 1-2 team+weapon / WASD move / MOUSE or F fire / R reload / E gate", {
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
    this.crosshairHorizontal = this.add.rectangle(0, 0, 18, 2, 0xd8f3ff, 0.85).setDepth(20);
    this.crosshairVertical = this.add.rectangle(0, 0, 2, 18, 0xd8f3ff, 0.85).setDepth(20);
    this.muzzleFlash = this.add.circle(0, 0, 8, 0xffd27a, 0.9).setDepth(8).setVisible(false);

    this.createActorSkins();
    this.add.rectangle(480, 270, 860, 420, 0x10213f, 0.9).setStrokeStyle(2, 0x2b5085, 0.9);
    this.addObstacle(480, 270, 120, 120, 0x16325d);
    this.addObstacle(260, 180, 80, 180, 0x1b4378);
    this.addObstacle(710, 340, 160, 60, 0x204b7e);
    this.gate = this.addGate(482, 430, 96, 24, 0xf4a261);
    this.hazardZone = this.addHazardZone(510, 138, 170, 46);
    this.addCoverPointMarkers();
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

    this.playerSprite = this.createActorImage("player", this.spawnTable.BLUE[0].x, this.spawnTable.BLUE[0].y);
    this.targetDummy = this.createActorImage("dummy", this.spawnTable.RED[0].x, this.spawnTable.RED[0].y);
    this.playerLogic.reset(0, 0);
    this.dummyLogic.reset(this.spawnTable.RED[0].x - 120, this.spawnTable.RED[0].y - 120);
    this.roundStartUntilMs = 0;
    this.respawnFxUntilMs = 0;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.moveKeys = {
      up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      sprint: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      reload: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      confirm: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      fire: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      swap: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      weapon1: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      weapon2: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      interact: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    };
    this.lastCombatEvent = "PRESS ENTER TO ENTER STAGE";
  }

  public update(_: number, delta: number): void {
    if (this.cursors === undefined || this.moveKeys === undefined) {
      return;
    }

    const now = this.time.now;
    const deltaSeconds = delta / 1000;
    this.handleStageFlow(now);
    const roundStarting = this.isRoundStarting(now);
    const combatLocked = !this.isCombatLive(now);
    const inputLocked = combatLocked || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || this.playerLogic.isStunned(now);
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

    if (!this.roundLogic.state.isMatchOver && this.matchFlow.state.phase !== "stage-entry") {
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
    this.updateDummyVisuals(now);
    this.updateCoverPointVisuals();
    this.updateCrosshair(now);
    this.updateMatchOverlay(now);
    this.statusText.setText([
      `Phase: ${this.getPhaseLabel(now)}`,
      `Team: ${this.matchFlow.state.selectedTeam ?? "UNSET"}`,
      `Spawn: ${this.lastSpawnSummary}`,
      `Player Health: ${this.playerLogic.state.health}/${this.playerLogic.state.maxHealth}`,
      `Dummy Health: ${this.dummyLogic.state.health}/${this.dummyLogic.state.maxHealth}`,
      `Movement Mode: ${this.playerLogic.state.isSprinting ? "Sprint" : "Walk"} (${this.playerLogic.state.lastAppliedSpeed.toFixed(0)})`,
      `Round Start Timer: ${this.getRoundStartStatus(now)}`,
      `Round Reset Timer: ${this.roundResetAtMs === null ? "READY" : Math.max(0, this.roundResetAtMs - now).toFixed(0)}`,
      `Gate State: ${this.gate.open ? "OPEN" : "CLOSED"}`,
      `Hazard Damage: ${this.gameBalance.hazardDamage} / ${this.gameBalance.hazardTickMs} ms`,
      `Ammo Pickup Timer: ${this.getPickupStatus(now)}`,
      `Health Pickup Timer: ${this.getHealthPickupStatus(now)}`,
      `Dummy AI Mode: ${this.lastDummyDecision.toUpperCase()}`,
      `Movement Blocked: ${playerBlocked ? "YES" : "NO"}`
    ]);
    const activeWeapon = this.getActiveWeaponSlot();
    this.combatText.setText([
      `Round Number: ${this.roundLogic.state.roundNumber}`,
      `Score: Player ${this.roundLogic.state.playerScore} / Dummy ${this.roundLogic.state.dummyScore} / Target ${this.roundLogic.state.scoreToWin}`,
      `Weapon Slot: ${this.weaponInventory.getActiveIndex() + 1}`,
      `Weapon Name: ${activeWeapon.label}`,
      `Magazine Ammo: ${activeWeapon.logic.getAmmoInMagazine(now)}/${activeWeapon.logic.getMagazineSize()}`,
      `Reserve Ammo: ${activeWeapon.logic.getReserveAmmo(now)}`,
      `Fire Cooldown: ${activeWeapon.logic.getCooldownRemaining(now).toFixed(0)} ms`,
      `Reload Timer: ${activeWeapon.logic.getReloadRemaining(now).toFixed(0)} ms`,
      `Combat Event: ${this.lastCombatEvent}`,
      `Sound Cue: ${this.lastSoundCue}`,
      `Round Result: ${this.roundLogic.state.lastResult}`,
      `Match Result: ${this.roundLogic.state.matchWinner ?? "IN PROGRESS"}`
    ]);
  }

  public getDebugSnapshot(): MainSceneDebugSnapshot {
    const activeWeapon = this.getActiveWeaponSlot();

    return {
      phase: this.getPhaseLabel(this.time.now),
      team: this.matchFlow.state.selectedTeam ?? "UNSET",
      spawn: this.lastSpawnSummary,
      activeWeapon: activeWeapon.label,
      weaponSlot: this.weaponInventory.getActiveIndex() + 1,
      ammoInMagazine: activeWeapon.logic.getAmmoInMagazine(this.time.now),
      reserveAmmo: activeWeapon.logic.getReserveAmmo(this.time.now),
      playerHealth: this.playerLogic.state.health,
      dummyHealth: this.dummyLogic.state.health,
      gateOpen: this.gate.open,
      roundNumber: this.roundLogic.state.roundNumber,
      playerScore: this.roundLogic.state.playerScore,
      dummyScore: this.roundLogic.state.dummyScore,
      lastEvent: this.lastCombatEvent
    };
  }

  public debugEnterStage(): void {
    if (this.matchFlow.state.phase !== "stage-entry") {
      return;
    }

    this.matchFlow.enterStage();
    this.matchFlow.previewTeam("BLUE");
    this.lastCombatEvent = "SELECT TEAM: 1 BLUE / 2 RED";
  }

  public debugSelectTeam(team: DebugTeamSelection): void {
    if (this.matchFlow.state.phase !== "team-select") {
      return;
    }

    this.matchFlow.previewTeam(team);
    this.lastCombatEvent = `TEAM PREVIEW ${team}`;
  }

  public debugConfirmTeamSelection(): void {
    if (this.matchFlow.state.phase !== "team-select" || this.matchFlow.state.selectedTeam === null) {
      return;
    }

    this.applySpawnAssignment(this.matchFlow.confirmTeamSelection(this.spawnTable));
    this.roundStartUntilMs = this.time.now + this.gameBalance.roundStartDelayMs;
    this.respawnFxUntilMs = this.time.now + MainScene.RESPAWN_FX_MS;
    this.lastCombatEvent = `DEPLOYING ${this.matchFlow.state.selectedTeam}`;
  }

  public debugForceCombatLive(): void {
    if (this.matchFlow.state.phase !== "deploying") {
      return;
    }

    this.roundStartUntilMs = 0;
    this.matchFlow.startCombat();
    this.lastCombatEvent = "COMBAT LIVE";
  }

  public debugSwapWeapon(): void {
    const nextIndex = (this.weaponInventory.getActiveIndex() + 1) % this.weaponSlots.length;

    if (this.weaponInventory.selectSlot(nextIndex)) {
      this.lastCombatEvent = `SWAPPED TO ${this.getActiveWeaponSlot().label.toUpperCase()}`;
    }
  }

  public debugFire(): void {
    if (!this.isCombatLive(this.time.now) || this.dummyLogic.isDead() || this.playerLogic.isDead()) {
      return;
    }

    const activeWeapon = this.getActiveWeaponSlot();
    const attempt = activeWeapon.logic.tryFire(this.time.now);

    if (!attempt.allowed) {
      this.lastCombatEvent = attempt.reason.toUpperCase();
      return;
    }

    this.spawnPlayerProjectiles(activeWeapon, attempt.bulletSpeed, attempt.damage);
    this.lastCombatEvent = `${activeWeapon.label.toUpperCase()} FIRED`;
  }

  public debugMovePlayerTo(x: number, y: number): void {
    this.playerLogic.state.positionX = x - 120;
    this.playerLogic.state.positionY = y - 120;
    this.playerSprite.setPosition(x, y);
  }

  public debugToggleGate(): void {
    this.gate.open = !this.gate.open;
    this.gate.sprite.setAlpha(this.gate.open ? 0.22 : 1);
    this.gate.sprite.setFillStyle(this.gate.open ? 0x6a7f91 : 0xf4a261, this.gate.open ? 0.22 : 1);
    this.lastCombatEvent = this.gate.open ? "GATE OPENED" : "GATE CLOSED";
  }

  private handleStageFlow(now: number): void {
    if (this.moveKeys === undefined) {
      return;
    }

    if (this.matchFlow.state.phase === "stage-entry") {
      if (Phaser.Input.Keyboard.JustDown(this.moveKeys.confirm)) {
        this.matchFlow.enterStage();
        this.matchFlow.previewTeam("BLUE");
        this.lastCombatEvent = "SELECT TEAM: 1 BLUE / 2 RED";
      }

      return;
    }

    if (this.matchFlow.state.phase === "team-select") {
      if (Phaser.Input.Keyboard.JustDown(this.moveKeys.weapon1) || Phaser.Input.Keyboard.JustDown(this.cursors!.left)) {
        this.matchFlow.previewTeam("BLUE");
        this.lastCombatEvent = "TEAM PREVIEW BLUE";
      }

      if (Phaser.Input.Keyboard.JustDown(this.moveKeys.weapon2) || Phaser.Input.Keyboard.JustDown(this.cursors!.right)) {
        this.matchFlow.previewTeam("RED");
        this.lastCombatEvent = "TEAM PREVIEW RED";
      }

      if (Phaser.Input.Keyboard.JustDown(this.moveKeys.confirm) && this.matchFlow.state.selectedTeam !== null) {
        this.applySpawnAssignment(this.matchFlow.confirmTeamSelection(this.spawnTable));
        this.roundStartUntilMs = now + this.gameBalance.roundStartDelayMs;
        this.respawnFxUntilMs = now + MainScene.RESPAWN_FX_MS;
        this.lastCombatEvent = `DEPLOYING ${this.matchFlow.state.selectedTeam}`;
      }

      return;
    }

    if (this.matchFlow.state.phase === "deploying" && !this.isRoundStarting(now)) {
      this.matchFlow.startCombat();
      this.lastCombatEvent = "COMBAT LIVE";
    }
  }

  private isCombatLive(now: number): boolean {
    return this.matchFlow.state.phase === "combat-live" && !this.isRoundStarting(now);
  }

  private getPhaseLabel(now: number): string {
    if (this.roundLogic.state.isMatchOver) {
      return "MATCH OVER";
    }

    if (this.matchFlow.state.phase === "combat-live" && this.isRoundStarting(now)) {
      return "ROUND START";
    }

    switch (this.matchFlow.state.phase) {
      case "stage-entry":
        return "STAGE ENTRY";
      case "team-select":
        return "TEAM SELECT";
      case "deploying":
        return "DEPLOYING";
      case "combat-live":
        return "COMBAT LIVE";
      case "match-over":
        return "MATCH RESET";
      default:
        return "UNKNOWN";
    }
  }

  private applySpawnAssignment(assignment: SpawnAssignment): void {
    this.playerLogic.reset(assignment.playerSpawn.x - 120, assignment.playerSpawn.y - 120);
    this.dummyLogic.reset(assignment.dummySpawn.x - 120, assignment.dummySpawn.y - 120);
    this.playerSprite.setPosition(assignment.playerSpawn.x, assignment.playerSpawn.y);
    this.playerSprite.setRotation(0);
    this.targetDummy.setPosition(assignment.dummySpawn.x, assignment.dummySpawn.y);
    this.targetDummy.setRotation(Math.PI);
    this.lastSpawnSummary = `${assignment.playerSpawn.label} vs ${assignment.dummySpawn.label}`;
    this.clearBullets();
    this.resetPickupState();
    this.gate.open = false;
    this.gate.sprite.setAlpha(1);
    this.gate.sprite.setFillStyle(0xf4a261, 1);
  }

  private handleReload(now: number): void {
    if (!this.isCombatLive(now) || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || this.playerLogic.isStunned(now)) {
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
    if (!this.isCombatLive(now) || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || this.moveKeys === undefined) {
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
    const firePressed = this.input.activePointer.leftButtonDown() || this.moveKeys?.fire.isDown === true;

    if (
      !firePressed ||
      this.dummyLogic.isDead() ||
      this.playerLogic.isDead() ||
      this.roundLogic.state.isMatchOver ||
      !this.isCombatLive(now) ||
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
    this.emitSoundCue({ kind: "fire", weaponId: activeWeapon.id === "scatter" ? "scatter" : "carbine" });

    if (attempt.ammoInMagazine === 0) {
      this.lastCombatEvent = "MAG EMPTY";
    }
  }

  private spawnPlayerProjectiles(activeWeapon: PlayerWeaponSlot, bulletSpeed: number, damage: number): void {
    const pelletStart = -(activeWeapon.pelletCount - 1) / 2;

    for (let index = 0; index < activeWeapon.pelletCount; index += 1) {
      const spreadOffset = (pelletStart + index) * activeWeapon.spreadRadians;
      const angle = this.playerLogic.state.aimAngleRadians + spreadOffset;
      const spawnX = this.playerSprite.x + Math.cos(angle) * 24;
      const spawnY = this.playerSprite.y + Math.sin(angle) * 24;
      const bullet = this.add.rectangle(
        spawnX,
        spawnY,
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

    const muzzleAngle = this.playerLogic.state.aimAngleRadians;
    this.muzzleFlash.setPosition(
      this.playerSprite.x + Math.cos(muzzleAngle) * 28,
      this.playerSprite.y + Math.sin(muzzleAngle) * 28
    );
    this.muzzleFlash.setVisible(true);
    this.muzzleFlashUntilMs = this.time.now + 70;
  }

  private handleDummyFire(now: number): void {
    if (this.dummyLogic.isDead() || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || !this.isCombatLive(now)) {
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
    this.emitSoundCue({ kind: "fire", weaponId: "generic" });
  }

  private handleWeaponSwitch(): void {
    if (this.moveKeys === undefined || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || !this.isCombatLive(this.time.now)) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.moveKeys.weapon1) && this.weaponInventory.selectSlot(0)) {
      this.getActiveWeaponSlot().logic.cancelReload(this.time.now);
      this.lastCombatEvent = `EQUIPPED ${this.getActiveWeaponSlot().label.toUpperCase()}`;
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.moveKeys.weapon2) && this.weaponInventory.selectSlot(1)) {
      this.getActiveWeaponSlot().logic.cancelReload(this.time.now);
      this.lastCombatEvent = `EQUIPPED ${this.getActiveWeaponSlot().label.toUpperCase()}`;
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.moveKeys.swap)) {
      const nextIndex = (this.weaponInventory.getActiveIndex() + 1) % this.weaponSlots.length;

      if (this.weaponInventory.selectSlot(nextIndex)) {
        this.getActiveWeaponSlot().logic.cancelReload(this.time.now);
        this.lastCombatEvent = `SWAPPED TO ${this.getActiveWeaponSlot().label.toUpperCase()}`;
      }
    }
  }

  private handleGateInteraction(): void {
    if (this.moveKeys === undefined || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || !this.isCombatLive(this.time.now)) {
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
    this.emitSoundCue({ kind: "gate", action: this.gate.open ? "open" : "close" });
  }

  private handleHazardZone(now: number): void {
    if (this.roundLogic.state.isMatchOver || !this.isCombatLive(now)) {
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
    this.emitSoundCue({ kind: "hazard", source: "vent" });

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
        this.emitSoundCue({ kind: "hit", target: "dummy" });

        if (this.dummyLogic.isDead()) {
          this.roundLogic.registerPlayerWin();
          this.scheduleResetAfterRound(this.time.now);
        }
      }

      if (hitPlayer && bullet.owner === "dummy") {
        this.playerLogic.takeDamage(bullet.damage, this.gameBalance.hitStunMs, this.time.now);
        this.lastCombatEvent = this.playerLogic.isDead() ? "PLAYER DOWN" : `STUNNED ${bullet.damage}`;
        this.emitSoundCue({ kind: "hit", target: "player" });

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

  private updateDummyVisuals(now: number): void {
    const healthRatio = this.dummyLogic.state.health / this.dummyLogic.state.maxHealth;
    const fill = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x4f1717),
      Phaser.Display.Color.ValueToColor(0xffffff),
      100,
      Math.round(healthRatio * 100)
    );

    this.targetDummy.setTint(Phaser.Display.Color.GetColor(fill.r, fill.g, fill.b));
    this.targetDummy.setAlpha(this.dummyLogic.isDead() ? 0.35 : 1);
    const respawnScale = this.getRespawnFxScale(now);
    this.targetDummy.setScale(
      this.dummyLogic.isDead()
        ? 0.82
        : this.lastDummyDecision === "flank"
          ? 1.06 * respawnScale
          : this.lastDummyDecision === "avoid-hazard"
            ? 1.12 * respawnScale
            : respawnScale
    );
  }

  private updateCoverPointVisuals(): void {
    const highlightCover = this.lastDummyDecision === "cover" || this.lastDummyDecision === "reposition";

    for (const view of this.coverPointViews) {
      view.sprite.setFillStyle(highlightCover ? 0xfde68a : 0x38bdf8, highlightCover ? 0.34 : 0.18);
      view.sprite.setStrokeStyle(1, highlightCover ? 0xfacc15 : 0x7dd3fc, highlightCover ? 0.95 : 0.65);
      view.label.setColor(highlightCover ? "#fde68a" : "#7dd3fc");
      view.label.setAlpha(highlightCover ? 0.95 : 0.7);
    }
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
    this.playerSprite.setAlpha(this.getRespawnFxAlpha(now));
    const flashScale = now < this.muzzleFlashUntilMs ? 1.04 : 1;
    this.playerSprite.setScale((this.playerLogic.state.isSprinting ? 1.08 : 1) * this.getRespawnFxScale(now) * flashScale);
  }

  private updateCrosshair(now: number): void {
    const pointerX = Phaser.Math.Clamp(this.input.activePointer.worldX, 20, 940);
    const pointerY = Phaser.Math.Clamp(this.input.activePointer.worldY, 20, 520);
    const canFight = this.isCombatLive(now) && !this.playerLogic.isDead() && !this.playerLogic.isStunned(now);
    const alpha = canFight ? 0.88 : 0.35;
    const color = canFight ? 0xd8f3ff : 0x7a8899;

    this.crosshairHorizontal.setPosition(pointerX, pointerY).setFillStyle(color, alpha);
    this.crosshairVertical.setPosition(pointerX, pointerY).setFillStyle(color, alpha);
    this.muzzleFlash.setVisible(now < this.muzzleFlashUntilMs);
  }

  private updateDummyMovement(deltaSeconds: number, now: number): void {
    if (this.dummyLogic.isDead() || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || !this.isCombatLive(now)) {
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
      lineOfSightBlockers: this.getActiveObstacles().map((obstacle) => obstacle.bounds),
      hazardZones: [{
        ...this.hazardZone.bounds,
        padding: 26
      }]
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

    this.resetRoundState(now);
    this.roundResetAtMs = null;
    this.lastCombatEvent = "REDEPLOYED";
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

    this.emitSoundCue({ kind: "match-confirm", action: "accept" });
    this.roundLogic.resetMatch();
    this.matchFlow.prepareNextMatch();
    this.lastSpawnSummary = "WAITING";
    this.roundStartUntilMs = 0;
    this.clearBullets();
    this.resetPickupState();
    this.matchConfirmAtMs = null;
    this.roundResetAtMs = null;
    this.lastCombatEvent = "SELECT TEAM FOR NEXT MATCH";
  }

  private emitSoundCue(event: SoundCueEvent): void {
    this.lastSoundCue = this.soundCueLogic.resolveCue(event);
    this.audioCuePlayer.play(this.lastSoundCue);
  }

  private updateMatchOverlay(now: number): void {
    if (this.matchFlow.state.phase === "stage-entry") {
      this.overlayTitle.setText("ENTER STAGE");
      this.overlaySubtitle.setText("Press ENTER to open team selection.");
      this.setOverlayVisible(true);
      return;
    }

    if (this.matchFlow.state.phase === "team-select") {
      const selectedTeam = this.matchFlow.state.selectedTeam ?? "BLUE";
      this.overlayTitle.setText(`TEAM ${selectedTeam}`);
      this.overlaySubtitle.setText("Press 1 for BLUE or 2 for RED, then ENTER to deploy.");
      this.setOverlayVisible(true);
      return;
    }

    if (!this.roundLogic.state.isMatchOver && this.isRoundStarting(now)) {
      this.overlayTitle.setText(`ROUND ${this.roundLogic.state.roundNumber}`);
      this.overlaySubtitle.setText(`Deploy complete. Combat starts in ${this.getRoundStartStatus(now)} ms.`);
      this.setOverlayVisible(true);
      return;
    }

    if (!this.roundLogic.state.isMatchOver || this.matchConfirmAtMs === null) {
      this.setOverlayVisible(false);
      return;
    }

    const remainingMs = Math.max(0, this.matchConfirmAtMs - now).toFixed(0);
    const confirmText = now >= this.matchConfirmAtMs ? "Press ENTER to start the next match." : `Confirm unlock in ${remainingMs} ms`;

    if (now >= this.matchConfirmAtMs && !this.matchConfirmReadyCueSent) {
      this.emitSoundCue({ kind: "match-confirm", action: "ready" });
      this.matchConfirmReadyCueSent = true;
      this.matchFlow.enterMatchOver();
    }

    this.overlayTitle.setText(`${this.roundLogic.state.matchWinner ?? "MATCH"} VICTORY`);
    this.overlaySubtitle.setText(`${confirmText} Team selection will reopen for the next match.`);
    this.setOverlayVisible(true);
  }

  private handleAmmoPickup(now: number): void {
    if (!this.ammoPickup.available && this.ammoPickup.respawnAtMs !== null && now >= this.ammoPickup.respawnAtMs) {
      this.ammoPickup.available = true;
      this.ammoPickup.respawnAtMs = null;
      this.ammoPickup.sprite.setVisible(true);
    }

    if (!this.ammoPickup.available || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || !this.isCombatLive(now)) {
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
    this.emitSoundCue({ kind: "pickup", pickupId: "ammo" });
  }

  private handleHealthPickup(now: number): void {
    if (!this.healthPickup.available && this.healthPickup.respawnAtMs !== null && now >= this.healthPickup.respawnAtMs) {
      this.healthPickup.available = true;
      this.healthPickup.respawnAtMs = null;
      this.healthPickup.sprite.setVisible(true);
    }

    if (!this.healthPickup.available || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || !this.isCombatLive(now)) {
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
    this.emitSoundCue({ kind: "pickup", pickupId: "health" });
  }

  private scheduleResetAfterRound(now: number): void {
    this.clearBullets();

    if (this.roundLogic.state.isMatchOver) {
      this.matchConfirmAtMs = now + this.gameBalance.matchResetDelayMs;
      this.matchConfirmReadyCueSent = false;
      this.roundResetAtMs = null;
      this.lastCombatEvent = `${this.roundLogic.state.matchWinner ?? "MATCH"} LOCKED`;
      return;
    }

    if (this.roundResetAtMs === null) {
      this.roundResetAtMs = now + MainScene.RESPAWN_DELAY_MS;
    }
  }

  private resetRoundState(now = this.time.now): void {
    for (const slot of this.weaponSlots) {
      slot.logic.reset();
    }
    this.weaponInventory.reset();
    this.dummyWeaponLogic.reset();
    this.hazardZone.logic.reset();
    this.applySpawnAssignment(this.matchFlow.redeploy(this.spawnTable));
    this.roundStartUntilMs = now + this.gameBalance.roundStartDelayMs;
    this.respawnFxUntilMs = now + MainScene.RESPAWN_FX_MS;
    this.matchConfirmReadyCueSent = false;
    this.playerSprite.setTint(0xffffff);
    this.playerSprite.setAlpha(1);
    this.playerSprite.setScale(1);
    this.targetDummy.setTint(0xffffff);
    this.targetDummy.setAlpha(1);
    this.targetDummy.setScale(1);
    this.lastDummyDecision = "chase";
    this.lastDummyShouldFire = false;
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

  private getRoundStartStatus(now: number): string {
    if (!this.isRoundStarting(now)) {
      return "LIVE";
    }

    return Math.max(0, this.roundStartUntilMs - now).toFixed(0);
  }

  private isRoundStarting(now: number): boolean {
    return !this.roundLogic.state.isMatchOver && now < this.roundStartUntilMs;
  }

  private getRespawnFxStatus(now: number): string {
    if (now >= this.respawnFxUntilMs) {
      return "READY";
    }

    return Math.max(0, this.respawnFxUntilMs - now).toFixed(0);
  }

  private getRespawnFxAlpha(now: number): number {
    if (now >= this.respawnFxUntilMs) {
      return 1;
    }

    const progress = 1 - Math.max(0, this.respawnFxUntilMs - now) / MainScene.RESPAWN_FX_MS;
    return 0.68 + progress * 0.32;
  }

  private getRespawnFxScale(now: number): number {
    if (now >= this.respawnFxUntilMs) {
      return 1;
    }

    const progress = 1 - Math.max(0, this.respawnFxUntilMs - now) / MainScene.RESPAWN_FX_MS;
    return 1.18 - progress * 0.18;
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

  private addCoverPointMarkers(): void {
    for (const coverPoint of this.dummyCoverPoints) {
      const sprite = this.add
        .circle(coverPoint.x, coverPoint.y, this.gameBalance.coverPointRadius, 0x38bdf8, 0.18)
        .setStrokeStyle(1, 0x7dd3fc, 0.65);
      const label = this.add
        .text(coverPoint.x, coverPoint.y - this.gameBalance.coverPointRadius - 10, "COVER", {
          color: "#7dd3fc",
          fontFamily: "monospace",
          fontSize: "10px"
        })
        .setOrigin(0.5)
        .setAlpha(0.7);

      this.coverPointViews.push({ sprite, label });
    }
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

  private createActorImage(actor: "player" | "dummy", x: number, y: number): Phaser.GameObjects.Image {
    if (this.gameBalance.actorSkinSource === "spritesheet" && this.textures.exists("actor-skins")) {
      return this.add.image(x, y, "actor-skins", actor === "player" ? 0 : 1).setDepth(5);
    }

    return this.add.image(x, y, actor === "player" ? "skin-player" : "skin-dummy").setDepth(5);
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
