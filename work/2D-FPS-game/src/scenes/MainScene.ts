import Phaser from "phaser";
import { GeneratedAudioCuePlayer } from "../domain/audio/GeneratedAudioCuePlayer";
import { SoundCueLogic, type SoundCueEvent, type SoundCueKey } from "../domain/audio/SoundCueLogic";
import { DummyAiLogic, type CoverPoint, type DummyAiDecision } from "../domain/ai/DummyAiLogic";
import { createCenteredRect, intersectsRect, type Rect } from "../domain/collision/CollisionLogic";
import { resolveBulletCollision, resolveHazardOutcome } from "../domain/combat/CombatResolution";
import { WeaponInventoryLogic } from "../domain/combat/WeaponInventoryLogic";
import { WeaponLogic, type WeaponConfig } from "../domain/combat/WeaponLogic";
import {
  canApplyHazard,
  canDummyFire,
  canInterruptReload,
  canPlayerFire,
  canPlayerReload,
  canPlayerUseCombatInteraction,
  evaluateProjectileFrame,
  isGateInteractionAllowed
} from "../domain/combat/CombatRuntime";
import { HazardZoneLogic } from "../domain/map/HazardZoneLogic";
import { PlayerLogic } from "../domain/player/PlayerLogic";
import {
  MatchFlowLogic,
  type SpawnAssignment,
  type SpawnPoint,
  type TeamId
} from "../domain/round/MatchFlowLogic";
import { createDeploymentViewState } from "../domain/round/DeploymentRuntime";
import { planRoundReset, resolveStageFlow } from "../domain/round/MatchFlowOrchestrator";
import { RoundLogic } from "../domain/round/RoundLogic";
import { HUD_SNAPSHOT_EVENT, type HudSnapshot } from "../ui/hud-events";
import {
  buildHudSnapshot,
  buildMatchOverlayState,
  getPhaseLabel,
  type HudPresenterInput
} from "../ui/hud-presenters";
import { getDummyVisualState, getPlayerVisualState, getRespawnFxState } from "../ui/scene-visuals";

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
  effectProfile: "carbine" | "scatter" | "dummy";
}

interface ImpactFxView {
  flash: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  rays: Phaser.GameObjects.Line[];
  expiresAtMs: number;
  durationMs: number;
}

interface ActorCollisionResolution {
  blocked: boolean;
  centerX: number;
  centerY: number;
}

interface ObstacleView {
  sprite: Phaser.GameObjects.Rectangle;
  bounds: Rect;
}

interface PickupView {
  sprite: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
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

export interface MainSceneHudSnapshot {
  readonly phase: string;
  readonly team: TeamId | "UNSET";
  readonly spawn: string;
  readonly health: number;
  readonly maxHealth: number;
  readonly dummyHealth: number;
  readonly dummyMaxHealth: number;
  readonly weaponName: string;
  readonly weaponSlot: number;
  readonly ammoInMagazine: number;
  readonly magazineSize: number;
  readonly reserveAmmo: number;
  readonly playerScore: number;
  readonly dummyScore: number;
  readonly scoreToWin: number;
  readonly roundNumber: number;
  readonly gateOpen: boolean;
  readonly combatEvent: string;
  readonly roundResult: string;
  readonly matchResult: string;
  readonly prompt: string;
  readonly overlayVisible: boolean;
  readonly overlayTitle: string;
  readonly overlaySubtitle: string;
}

type DebugTeamSelection = TeamId;

export class MainScene extends Phaser.Scene {
  private static readonly RESPAWN_DELAY_MS = 1600;
  private static readonly RESPAWN_FX_MS = 900;
  private static readonly ACTOR_HALF_SIZE = 120;
  private static readonly ACTOR_MIN_SEPARATION = 44;

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
  private readonly impactEffects: ImpactFxView[];
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
  private lastDummySteerX: number;
  private lastDummySteerY: number;
  private dummySteerLockUntilMs: number;
  private lastSpawnSummary: string;
  private muzzleFlashUntilMs: number;
  private overlayState: {
    visible: boolean;
    title: string;
    subtitle: string;
  };

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
    this.impactEffects = [];
    this.obstacles = [];
    this.matchFlow = new MatchFlowLogic();
    this.spawnTable = {
      BLUE: [
        { x: 120, y: 120, label: "BLUE ENTRY A" },
        { x: 162, y: 428, label: "BLUE ENTRY B" },
        { x: 338, y: 96, label: "BLUE ENTRY C" }
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
    this.lastDummySteerX = 1;
    this.lastDummySteerY = 0;
    this.dummySteerLockUntilMs = 0;
    this.lastSpawnSummary = "WAITING";
    this.muzzleFlashUntilMs = 0;
    this.overlayState = {
      visible: false,
      title: "",
      subtitle: ""
    };
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
      label: this.add.text(160, 404, "AMMO", {
        color: "#9adfff",
        fontFamily: "monospace",
        fontSize: "10px"
      }).setOrigin(0.5).setAlpha(0.8),
      available: true,
      respawnAtMs: null
    };
    this.healthPickup = {
      sprite: this.add.rectangle(870, 430, 22, 22, 0x8df0c3, 1).setStrokeStyle(2, 0x173322, 1),
      label: this.add.text(870, 404, "MED", {
        color: "#aaf5d6",
        fontFamily: "monospace",
        fontSize: "10px"
      }).setOrigin(0.5).setAlpha(0.8),
      available: true,
      respawnAtMs: null
    };

    this.playerSprite = this.createActorImage("player", this.spawnTable.BLUE[0].x, this.spawnTable.BLUE[0].y);
    this.targetDummy = this.createActorImage("dummy", this.spawnTable.RED[0].x, this.spawnTable.RED[0].y);
    this.playerLogic.reset(0, 0);
    this.dummyLogic.reset(this.spawnTable.RED[0].x - MainScene.ACTOR_HALF_SIZE, this.spawnTable.RED[0].y - MainScene.ACTOR_HALF_SIZE);
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

    let playerCenterX = Phaser.Math.Clamp(this.playerLogic.state.positionX + MainScene.ACTOR_HALF_SIZE, 40, 920);
    let playerCenterY = Phaser.Math.Clamp(this.playerLogic.state.positionY + MainScene.ACTOR_HALF_SIZE, 40, 500);
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
      this.playerLogic.updateAim(this.input.activePointer.worldX - MainScene.ACTOR_HALF_SIZE, this.input.activePointer.worldY - MainScene.ACTOR_HALF_SIZE, now);
    }

    const playerCollision = this.resolvePlayerObstacleCollision(playerCenterX, playerCenterY, previousX, previousY);
    const playerBlocked = playerCollision.blocked;
    playerCenterX = playerCollision.centerX;
    playerCenterY = playerCollision.centerY;

    this.playerSprite.setPosition(playerCenterX, playerCenterY);
    this.playerSprite.setRotation(this.playerLogic.state.aimAngleRadians);
    this.handleReloadInterrupt(now);
    this.handleReload(now);
    this.handleFire(now);
    this.handleDummyFire(now);
    this.updateBullets(deltaSeconds);
    this.resolveActorSeparation();
    this.updateImpactEffects(now);
    this.updatePlayerVisuals(now);
    this.updateDummyVisuals(now);
    this.updateCoverPointVisuals();
    this.updateCrosshair(now);
    this.updateMatchOverlay(now);
    this.publishHudSnapshot(now, playerBlocked);
  }

  public getDebugSnapshot(): MainSceneDebugSnapshot {
    const activeWeapon = this.getActiveWeaponSlot();

    return {
      phase: getPhaseLabel(this.matchFlow.state.phase, this.roundLogic.state.isMatchOver, this.isRoundStarting(this.time.now)),
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

  public getHudSnapshot(now = this.time.now, movementBlocked = false): HudSnapshot {
    return buildHudSnapshot(this.createHudPresenterInput(now, movementBlocked), this.overlayState);
  }

  private publishHudSnapshot(now: number, movementBlocked: boolean): void {
    window.dispatchEvent(new CustomEvent<HudSnapshot>(HUD_SNAPSHOT_EVENT, {
      detail: this.getHudSnapshot(now, movementBlocked)
    }));
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
    this.playerLogic.state.positionX = x - MainScene.ACTOR_HALF_SIZE;
    this.playerLogic.state.positionY = y - MainScene.ACTOR_HALF_SIZE;
    this.playerSprite.setPosition(x, y);
  }

  public debugToggleGate(): void {
    this.applyGateToggle();
  }

  private handleStageFlow(now: number): void {
    if (this.moveKeys === undefined) {
      return;
    }

    const decision = resolveStageFlow({
      phase: this.matchFlow.state.phase,
      selectedTeam: this.matchFlow.state.selectedTeam,
      confirmPressed: Phaser.Input.Keyboard.JustDown(this.moveKeys.confirm),
      selectBluePressed: Phaser.Input.Keyboard.JustDown(this.moveKeys.weapon1) || Phaser.Input.Keyboard.JustDown(this.cursors!.left),
      selectRedPressed: Phaser.Input.Keyboard.JustDown(this.moveKeys.weapon2) || Phaser.Input.Keyboard.JustDown(this.cursors!.right),
      roundStarting: this.isRoundStarting(now)
    });

    if (decision.enterStage) {
      this.matchFlow.enterStage();
    }

    if (decision.previewTeam !== null) {
      this.matchFlow.previewTeam(decision.previewTeam);
    }

    if (decision.confirmDeployment) {
      this.applySpawnAssignment(this.matchFlow.confirmTeamSelection(this.spawnTable));
      this.roundStartUntilMs = now + this.gameBalance.roundStartDelayMs;
      this.respawnFxUntilMs = now + MainScene.RESPAWN_FX_MS;
    }

    if (decision.startCombat) {
      this.matchFlow.startCombat();
    }

    if (decision.combatEvent !== null) {
      this.lastCombatEvent = decision.combatEvent;
    }
  }

  private isCombatLive(now: number): boolean {
    return this.matchFlow.state.phase === "combat-live" && !this.isRoundStarting(now);
  }

  private applySpawnAssignment(assignment: SpawnAssignment): void {
    const deployment = createDeploymentViewState(assignment);
    this.playerLogic.reset(assignment.playerSpawn.x - MainScene.ACTOR_HALF_SIZE, assignment.playerSpawn.y - MainScene.ACTOR_HALF_SIZE);
    this.dummyLogic.reset(assignment.dummySpawn.x - MainScene.ACTOR_HALF_SIZE, assignment.dummySpawn.y - MainScene.ACTOR_HALF_SIZE);
    this.applyTeamVisuals(assignment.playerTeam, assignment.dummyTeam);
    this.playerSprite.setPosition(deployment.playerPositionX, deployment.playerPositionY);
    this.playerSprite.setRotation(deployment.playerRotation);
    this.targetDummy.setPosition(deployment.dummyPositionX, deployment.dummyPositionY);
    this.targetDummy.setRotation(deployment.dummyRotation);
    this.lastSpawnSummary = deployment.spawnSummary;
    this.clearBullets();
    this.resetPickupState();
    this.gate.open = deployment.gateOpen;
    this.gate.sprite.setAlpha(1);
    this.gate.sprite.setFillStyle(0xf4a261, 1);
  }

  private handleReload(now: number): void {
    if (!canPlayerReload(this.getCombatAvailability(now))) {
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
    if (!canInterruptReload(this.getCombatAvailability(now)) || this.moveKeys === undefined) {
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

    if (!firePressed || !canPlayerFire(this.getCombatAvailability(now))) {
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
        owner: "player",
        effectProfile: activeWeapon.id === "scatter" ? "scatter" : "carbine"
      });
    }

    const muzzleAngle = this.playerLogic.state.aimAngleRadians;
    const muzzleProfile = activeWeapon.id === "scatter"
      ? { radius: 14, color: 0xffb86c, durationMs: 110 }
      : { radius: 8, color: 0xfff27a, durationMs: 70 };

    this.muzzleFlash
      .setRadius(muzzleProfile.radius)
      .setFillStyle(muzzleProfile.color, 0.92)
      .setScale(1);
    this.muzzleFlash.setPosition(
      this.playerSprite.x + Math.cos(muzzleAngle) * 28,
      this.playerSprite.y + Math.sin(muzzleAngle) * 28
    );
    this.muzzleFlash.setVisible(true);
    this.muzzleFlashUntilMs = this.time.now + muzzleProfile.durationMs;
  }

  private handleDummyFire(now: number): void {
    if (!canDummyFire(this.getCombatAvailability(now))) {
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
      owner: "dummy",
      effectProfile: "dummy"
    });
    this.emitSoundCue({ kind: "fire", weaponId: "generic" });
  }

  private handleWeaponSwitch(): void {
    if (this.moveKeys === undefined || !canPlayerUseCombatInteraction(this.getCombatAvailability(this.time.now))) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.moveKeys.weapon1)) {
      this.tryEquipSlot(0, "EQUIPPED");
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.moveKeys.weapon2)) {
      this.tryEquipSlot(1, "EQUIPPED");
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.moveKeys.swap)) {
      const nextIndex = (this.weaponInventory.getActiveIndex() + 1) % this.weaponSlots.length;
      this.tryEquipSlot(nextIndex, "SWAPPED TO");
    }
  }

  private tryEquipSlot(slotIndex: number, eventPrefix: string): void {
    if (this.weaponInventory.selectSlot(slotIndex)) {
      this.getActiveWeaponSlot().logic.cancelReload(this.time.now);
      this.lastCombatEvent = `${eventPrefix} ${this.getActiveWeaponSlot().label.toUpperCase()}`;
    }
  }

  private handleGateInteraction(): void {
    if (this.moveKeys === undefined || !canPlayerUseCombatInteraction(this.getCombatAvailability(this.time.now))) {
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

    if (!isGateInteractionAllowed(distanceToGate, 92)) {
      this.lastCombatEvent = "GATE TOO FAR";
      return;
    }

    this.applyGateToggle();
    this.emitSoundCue({ kind: "gate", action: this.gate.open ? "open" : "close" });
  }

  private applyGateToggle(): void {
    this.gate.open = !this.gate.open;
    this.gate.sprite.setAlpha(this.gate.open ? 0.22 : 1);
    this.gate.sprite.setFillStyle(this.gate.open ? 0x6a7f91 : 0xf4a261, this.gate.open ? 0.22 : 1);
    this.lastCombatEvent = this.gate.open ? "GATE OPENED" : "GATE CLOSED";
  }

  private handleHazardZone(now: number): void {
    if (!canApplyHazard(this.getCombatAvailability(now))) {
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
    const hazardResolution = resolveHazardOutcome({
      actorId,
      triggered: tick.triggered,
      damage: tick.damage,
      actorDied: actorLogic.isDead()
    });

    if (hazardResolution.combatEvent !== null) {
      this.lastCombatEvent = hazardResolution.combatEvent;
    }

    this.emitSoundCue({ kind: "hazard", source: "vent" });

    if (hazardResolution.roundWinner === null) {
      return;
    }

    if (hazardResolution.roundWinner === "DUMMY") {
      this.roundLogic.registerDummyWin();
    } else {
      this.roundLogic.registerPlayerWin();
    }

    this.scheduleResetAfterRound(now);
  }

  private updateBullets(deltaSeconds: number): void {
    const activeObstacles = this.getActiveObstacles();
    const dummyAlive = !this.dummyLogic.isDead();
    const playerAlive = !this.playerLogic.isDead();
    const dummyBounds = dummyAlive ? this.targetDummy.getBounds() : null;
    const playerBounds = playerAlive ? this.playerSprite.getBounds() : null;

    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];
      const frame = evaluateProjectileFrame({
        projectile: {
          x: bullet.sprite.x,
          y: bullet.sprite.y,
          width: bullet.sprite.width,
          height: bullet.sprite.height,
          velocityX: bullet.velocityX,
          velocityY: bullet.velocityY,
          owner: bullet.owner
        },
        deltaSeconds,
        arenaWidth: 960,
        arenaHeight: 540,
        obstacles: activeObstacles.map((obstacle) => obstacle.bounds),
        playerBounds: playerBounds === null
          ? null
          : createCenteredRect(playerBounds.centerX, playerBounds.centerY, playerBounds.width, playerBounds.height),
        dummyBounds: dummyBounds === null
          ? null
          : createCenteredRect(dummyBounds.centerX, dummyBounds.centerY, dummyBounds.width, dummyBounds.height)
      });

      bullet.sprite.x = frame.nextX;
      bullet.sprite.y = frame.nextY;

      if (frame.hitDummy && bullet.owner === "player") {
        this.dummyLogic.takeDamage(bullet.damage);
      }

      if (frame.hitPlayer && bullet.owner === "dummy") {
        this.playerLogic.takeDamage(bullet.damage, this.gameBalance.hitStunMs, this.time.now);
      }

      const bulletResolution = resolveBulletCollision({
        owner: bullet.owner,
        hitDummy: frame.hitDummy,
        hitPlayer: frame.hitPlayer,
        hitObstacle: frame.hitObstacle,
        outOfBounds: frame.outOfBounds,
        damage: bullet.damage,
        targetDied: bullet.owner === "player" ? this.dummyLogic.isDead() : this.playerLogic.isDead()
      });

      if (bulletResolution.combatEvent !== null) {
        this.lastCombatEvent = bulletResolution.combatEvent;
      }

      if (bulletResolution.soundTarget !== null) {
        this.emitSoundCue({ kind: "hit", target: bulletResolution.soundTarget });
      }

      if (bulletResolution.roundWinner === "PLAYER") {
        this.roundLogic.registerPlayerWin();
        this.scheduleResetAfterRound(this.time.now);
      } else if (bulletResolution.roundWinner === "DUMMY") {
        this.roundLogic.registerDummyWin();
        this.scheduleResetAfterRound(this.time.now);
      }

      if (frame.hitObstacle) {
        this.spawnImpactEffect(frame.nextX, frame.nextY, bullet.effectProfile);
      }

      if (bulletResolution.destroyBullet) {
        bullet.sprite.destroy();
        this.bullets.splice(index, 1);
      }
    }
  }

  private spawnImpactEffect(x: number, y: number, profile: "carbine" | "scatter" | "dummy"): void {
    const fxProfile = profile === "scatter"
      ? { flashRadius: 10, ringRadius: 18, flashColor: 0xffb86c, ringColor: 0xffd7ad, durationMs: 160, rayLength: 16 }
      : profile === "dummy"
        ? { flashRadius: 6, ringRadius: 10, flashColor: 0xff9c9c, ringColor: 0xffd1d1, durationMs: 110, rayLength: 10 }
        : { flashRadius: 6, ringRadius: 10, flashColor: 0xffd27a, ringColor: 0xfff0b3, durationMs: 110, rayLength: 12 };
    const flash = this.add.circle(x, y, fxProfile.flashRadius, fxProfile.flashColor, 0.85).setDepth(9);
    const ring = this.add
      .circle(x, y, fxProfile.ringRadius, fxProfile.ringColor, 0)
      .setDepth(9)
      .setStrokeStyle(profile === "scatter" ? 3 : 2, fxProfile.ringColor, 0.9);
    const rays = [0, 1, 2, 3].map((index) => {
      const angle = Phaser.Math.DegToRad(index * 45 + (profile === "scatter" ? 12 : 0));
      return this.add.line(
        x,
        y,
        Math.cos(angle) * 3,
        Math.sin(angle) * 3,
        Math.cos(angle) * fxProfile.rayLength,
        Math.sin(angle) * fxProfile.rayLength,
        fxProfile.ringColor,
        0.95
      ).setDepth(9).setLineWidth(profile === "scatter" ? 3 : 2);
    });

    this.impactEffects.push({
      flash,
      ring,
      rays,
      expiresAtMs: this.time.now + fxProfile.durationMs,
      durationMs: fxProfile.durationMs
    });
  }

  private updateImpactEffects(now: number): void {
    for (let index = this.impactEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.impactEffects[index];
      const remainingMs = effect.expiresAtMs - now;

      if (remainingMs <= 0) {
        effect.flash.destroy();
        effect.ring.destroy();
        for (const ray of effect.rays) {
          ray.destroy();
        }
        this.impactEffects.splice(index, 1);
        continue;
      }

      const progress = 1 - remainingMs / effect.durationMs;
      effect.flash.setAlpha(0.85 - progress * 0.75);
      effect.flash.setScale(1 + progress * 0.45);
      effect.ring.setAlpha(0.95 - progress * 0.8);
      effect.ring.setScale(0.75 + progress * 0.8);
      for (const ray of effect.rays) {
        ray.setAlpha(0.92 - progress * 0.8);
        ray.setScale(0.9 + progress * 0.5);
      }
    }
  }

  private resolveActorSeparation(): void {
    const deltaX = this.targetDummy.x - this.playerSprite.x;
    const deltaY = this.targetDummy.y - this.playerSprite.y;
    const rawDistance = Math.hypot(deltaX, deltaY);

    if (rawDistance >= MainScene.ACTOR_MIN_SEPARATION) {
      return;
    }

    const distance = rawDistance === 0 ? 1 : rawDistance;
    const fallbackAngle = this.playerLogic.state.aimAngleRadians;
    const normalX = rawDistance === 0 ? Math.cos(fallbackAngle) : deltaX / distance;
    const normalY = rawDistance === 0 ? Math.sin(fallbackAngle) : deltaY / distance;
    const overlap = MainScene.ACTOR_MIN_SEPARATION - rawDistance;
    const pushX = normalX * overlap * 0.5;
    const pushY = normalY * overlap * 0.5;
    const playerCenter = this.resolveStaticActorCenter(
      this.playerSprite,
      this.playerLogic,
      this.playerSprite.x - pushX,
      this.playerSprite.y - pushY
    );
    const dummyCenter = this.resolveStaticActorCenter(
      this.targetDummy,
      this.dummyLogic,
      this.targetDummy.x + pushX,
      this.targetDummy.y + pushY
    );

    this.playerSprite.setPosition(playerCenter.x, playerCenter.y);
    this.targetDummy.setPosition(dummyCenter.x, dummyCenter.y);
  }

  private updateDummyVisuals(now: number): void {
    const visual = getDummyVisualState({
      isDead: this.dummyLogic.isDead(),
      healthRatio: this.dummyLogic.state.health / this.dummyLogic.state.maxHealth,
      decision: this.lastDummyDecision === "avoid-hazard" ? "avoid-hazard" : this.lastDummyDecision,
      respawnFxScale: this.getRespawnFxState(now).scale
    });

    this.targetDummy.setTint(visual.tint);
    this.targetDummy.setAlpha(visual.alpha);
    this.targetDummy.setScale(visual.scale);
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
    const visual = getPlayerVisualState({
      isDead: this.playerLogic.isDead(),
      isStunned: this.playerLogic.isStunned(now),
      isSprinting: this.playerLogic.state.isSprinting,
      muzzleFlashActive: now < this.muzzleFlashUntilMs,
      respawnFx: this.getRespawnFxState(now)
    });

    this.playerSprite.setTint(visual.tint);
    this.playerSprite.setAlpha(visual.alpha);
    this.playerSprite.setScale(visual.scale);
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
    const desiredSteer = now < this.dummySteerLockUntilMs
      ? {
          moveX: this.lastDummySteerX,
          moveY: this.lastDummySteerY
        }
      : this.stabilizeDummySteer(decision.moveX, decision.moveY);

    this.lastDummyDecision = decision.mode;
    this.lastDummyShouldFire = decision.shouldFire;
    this.dummyLogic.move(
      {
        x: desiredSteer.moveX,
        y: desiredSteer.moveY,
        sprint: false
      },
      deltaSeconds,
      now
    );
    this.dummyLogic.updateAim(this.playerSprite.x - MainScene.ACTOR_HALF_SIZE, this.playerSprite.y - MainScene.ACTOR_HALF_SIZE, now);

    let dummyCenterX = Phaser.Math.Clamp(this.dummyLogic.state.positionX + MainScene.ACTOR_HALF_SIZE, 40, 920);
    let dummyCenterY = Phaser.Math.Clamp(this.dummyLogic.state.positionY + MainScene.ACTOR_HALF_SIZE, 40, 500);
    const collision = this.resolveActorObstacleCollision(
      dummyCenterX,
      dummyCenterY,
      previousX,
      previousY,
      this.targetDummy,
      this.dummyLogic
    );
    const blocked = collision.blocked;
    dummyCenterX = collision.centerX;
    dummyCenterY = collision.centerY;

    if (blocked) {
      const blockedSteer = this.createDummyBlockedSteer();
      this.lastDummySteerX = blockedSteer.moveX;
      this.lastDummySteerY = blockedSteer.moveY;
      this.dummySteerLockUntilMs = now + 220;
      dummyCenterX = previousX + MainScene.ACTOR_HALF_SIZE;
      dummyCenterY = previousY + MainScene.ACTOR_HALF_SIZE;
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
    const overlayResult = buildMatchOverlayState(this.createHudPresenterInput(now, false));

    if (overlayResult.shouldEmitMatchConfirmReadyCue) {
      this.emitSoundCue({ kind: "match-confirm", action: "ready" });
      this.matchConfirmReadyCueSent = true;
    }

    if (overlayResult.shouldEnterMatchOver) {
      this.matchFlow.enterMatchOver();
    }

    this.overlayState = overlayResult.overlay;
  }

  private createHudPresenterInput(now: number, movementBlocked: boolean): HudPresenterInput {
    const activeWeapon = this.getActiveWeaponSlot();

    return {
      now,
      matchFlow: this.matchFlow.state,
      round: this.roundLogic.state,
      combat: {
        selectedTeam: this.matchFlow.state.selectedTeam,
        spawnSummary: this.lastSpawnSummary,
        activeWeapon: activeWeapon.label,
        weaponSlot: this.weaponInventory.getActiveIndex() + 1,
        ammoInMagazine: activeWeapon.logic.getAmmoInMagazine(now),
        reserveAmmo: activeWeapon.logic.getReserveAmmo(now),
        playerHealth: this.playerLogic.state.health,
        playerMaxHealth: this.playerLogic.state.maxHealth,
        dummyHealth: this.dummyLogic.state.health,
        dummyMaxHealth: this.dummyLogic.state.maxHealth,
        gateOpen: this.gate.open,
        lastEvent: this.lastCombatEvent,
        lastSoundCue: this.lastSoundCue,
        movementMode: this.playerLogic.state.isSprinting ? "Sprint" : "Walk",
        movementBlocked,
        roundStartLabel: this.getRoundStartStatus(now),
        ammoPickupLabel: this.getPickupStatus(now),
        healthPickupLabel: this.getHealthPickupStatus(now)
      },
      isRoundStarting: this.isRoundStarting(now),
      matchConfirmAtMs: this.matchConfirmAtMs,
      matchConfirmReadyCueSent: this.matchConfirmReadyCueSent
    };
  }

  private getCombatAvailability(now: number) {
    return {
      isCombatLive: this.isCombatLive(now),
      isPlayerDead: this.playerLogic.isDead(),
      isDummyDead: this.dummyLogic.isDead(),
      isMatchOver: this.roundLogic.state.isMatchOver,
      isPlayerStunned: this.playerLogic.isStunned(now)
    };
  }

  private handleAmmoPickup(now: number): void {
    if (!this.ammoPickup.available && this.ammoPickup.respawnAtMs !== null && now >= this.ammoPickup.respawnAtMs) {
      this.ammoPickup.available = true;
      this.ammoPickup.respawnAtMs = null;
      this.ammoPickup.sprite.setVisible(true);
      this.ammoPickup.label.setVisible(true);
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
    this.ammoPickup.label.setVisible(false);
    this.lastCombatEvent = `AMMO +${restoredAmmo}`;
    this.emitSoundCue({ kind: "pickup", pickupId: "ammo" });
  }

  private handleHealthPickup(now: number): void {
    if (!this.healthPickup.available && this.healthPickup.respawnAtMs !== null && now >= this.healthPickup.respawnAtMs) {
      this.healthPickup.available = true;
      this.healthPickup.respawnAtMs = null;
      this.healthPickup.sprite.setVisible(true);
      this.healthPickup.label.setVisible(true);
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
    this.healthPickup.label.setVisible(false);
    this.lastCombatEvent = `HEAL +${restoredHealth}`;
    this.emitSoundCue({ kind: "pickup", pickupId: "health" });
  }

  private scheduleResetAfterRound(now: number): void {
    const plan = planRoundReset({
      isMatchOver: this.roundLogic.state.isMatchOver,
      matchWinner: this.roundLogic.state.matchWinner,
      now,
      matchResetDelayMs: this.gameBalance.matchResetDelayMs,
      respawnDelayMs: MainScene.RESPAWN_DELAY_MS
    });

    if (plan.clearBullets) {
      this.clearBullets();
    }

    this.matchConfirmReadyCueSent = plan.matchConfirmReadyCueSent;
    this.matchConfirmAtMs = plan.matchConfirmAtMs;

    if (plan.roundResetAtMs !== null && this.roundResetAtMs === null) {
      this.roundResetAtMs = plan.roundResetAtMs;
    } else if (plan.roundResetAtMs === null) {
      this.roundResetAtMs = null;
    }

    if (plan.combatEvent !== null) {
      this.lastCombatEvent = plan.combatEvent;
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
    this.lastDummySteerX = 1;
    this.lastDummySteerY = 0;
    this.dummySteerLockUntilMs = 0;
  }

  private clearBullets(): void {
    for (const bullet of this.bullets) {
      bullet.sprite.destroy();
    }

    this.bullets.length = 0;

    for (const effect of this.impactEffects) {
      effect.flash.destroy();
      effect.ring.destroy();
      for (const ray of effect.rays) {
        ray.destroy();
      }
    }

    this.impactEffects.length = 0;
  }

  private resetPickupState(): void {
    this.ammoPickup.available = true;
    this.ammoPickup.respawnAtMs = null;
    this.ammoPickup.sprite.setVisible(true);
    this.ammoPickup.label.setVisible(true);
    this.healthPickup.available = true;
    this.healthPickup.respawnAtMs = null;
    this.healthPickup.sprite.setVisible(true);
    this.healthPickup.label.setVisible(true);
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

  private stabilizeDummySteer(moveX: number, moveY: number): { moveX: number; moveY: number } {
    const blend = 0.28;
    const blendedX = Phaser.Math.Linear(this.lastDummySteerX, moveX, blend);
    const blendedY = Phaser.Math.Linear(this.lastDummySteerY, moveY, blend);
    const length = Math.hypot(blendedX, blendedY) || 1;

    this.lastDummySteerX = blendedX / length;
    this.lastDummySteerY = blendedY / length;
    this.dummySteerLockUntilMs = 0;

    return {
      moveX: this.lastDummySteerX,
      moveY: this.lastDummySteerY
    };
  }

  private createDummyBlockedSteer(): { moveX: number; moveY: number } {
    const deltaX = this.playerSprite.x - this.targetDummy.x;
    const deltaY = this.playerSprite.y - this.targetDummy.y;
    const distance = Math.hypot(deltaX, deltaY) || 1;
    const directionX = deltaX / distance;
    const directionY = deltaY / distance;
    const side = Math.floor(this.time.now / 900) % 2 === 0 ? 1 : -1;

    return {
      moveX: -directionY * side,
      moveY: directionX * side
    };
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

  private getRespawnFxState(now: number) {
    return getRespawnFxState(now, this.respawnFxUntilMs, MainScene.RESPAWN_FX_MS);
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
    this.createActorTexture("skin-player-blue", {
      bodyColor: 0x5cc8ff,
      headColor: 0xd8f3ff,
      accentColor: 0x174f82,
      weaponColor: 0xfff27a
    });
    this.createActorTexture("skin-player-red", {
      bodyColor: 0xff8787,
      headColor: 0xffd2d2,
      accentColor: 0x7f1d1d,
      weaponColor: 0xffd27a
    });
    this.createActorTexture("skin-dummy-blue", {
      bodyColor: 0x6bcfff,
      headColor: 0xe3f7ff,
      accentColor: 0x14507c,
      weaponColor: 0xa8eeff
    });
    this.createActorTexture("skin-dummy-red", {
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

    return this.add.image(x, y, actor === "player" ? "skin-player-blue" : "skin-dummy-red").setDepth(5);
  }

  private applyTeamVisuals(playerTeam: TeamId, dummyTeam: TeamId): void {
    if (this.gameBalance.actorSkinSource === "spritesheet" && this.textures.exists("actor-skins")) {
      this.playerSprite.setFrame(playerTeam === "BLUE" ? 0 : 1);
      this.targetDummy.setFrame(dummyTeam === "BLUE" ? 0 : 1);
      return;
    }

    this.playerSprite.setTexture(playerTeam === "BLUE" ? "skin-player-blue" : "skin-player-red");
    this.targetDummy.setTexture(dummyTeam === "BLUE" ? "skin-dummy-blue" : "skin-dummy-red");
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
  ): ActorCollisionResolution {
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
  ): ActorCollisionResolution {
    const attemptedBounds = createCenteredRect(centerX, centerY, sprite.width, sprite.height);

    if (!this.getActiveObstacles().some((obstacle) => intersectsRect(attemptedBounds, obstacle.bounds))) {
      return {
        blocked: false,
        centerX,
        centerY
      };
    }

    const xOnlyBounds = createCenteredRect(centerX, previousY + MainScene.ACTOR_HALF_SIZE, sprite.width, sprite.height);
    const yOnlyBounds = createCenteredRect(previousX + MainScene.ACTOR_HALF_SIZE, centerY, sprite.width, sprite.height);
    const canKeepX = !this.getActiveObstacles().some((obstacle) => intersectsRect(xOnlyBounds, obstacle.bounds));
    const canKeepY = !this.getActiveObstacles().some((obstacle) => intersectsRect(yOnlyBounds, obstacle.bounds));

    if (canKeepX) {
      actorLogic.state.positionX = centerX - MainScene.ACTOR_HALF_SIZE;
      actorLogic.state.positionY = previousY;
      return {
        blocked: false,
        centerX,
        centerY: previousY + MainScene.ACTOR_HALF_SIZE
      };
    }

    if (canKeepY) {
      actorLogic.state.positionX = previousX;
      actorLogic.state.positionY = centerY - MainScene.ACTOR_HALF_SIZE;
      return {
        blocked: false,
        centerX: previousX + MainScene.ACTOR_HALF_SIZE,
        centerY
      };
    }

    actorLogic.state.positionX = previousX;
    actorLogic.state.positionY = previousY;

    if (actorLogic === this.playerLogic) {
      this.lastCombatEvent = "MOVE BLOCKED";
    }

    return {
      blocked: true,
      centerX: previousX + MainScene.ACTOR_HALF_SIZE,
      centerY: previousY + MainScene.ACTOR_HALF_SIZE
    };
  }

  private resolveStaticActorCenter(
    sprite: Phaser.GameObjects.Image,
    actorLogic: PlayerLogic,
    targetCenterX: number,
    targetCenterY: number
  ): { x: number; y: number } {
    const clampedCenterX = Phaser.Math.Clamp(targetCenterX, 40, 920);
    const clampedCenterY = Phaser.Math.Clamp(targetCenterY, 40, 500);
    const targetBounds = createCenteredRect(clampedCenterX, clampedCenterY, sprite.width, sprite.height);

    if (this.getActiveObstacles().some((obstacle) => intersectsRect(targetBounds, obstacle.bounds))) {
      return {
        x: sprite.x,
        y: sprite.y
      };
    }

    actorLogic.state.positionX = clampedCenterX - MainScene.ACTOR_HALF_SIZE;
    actorLogic.state.positionY = clampedCenterY - MainScene.ACTOR_HALF_SIZE;

    return {
      x: clampedCenterX,
      y: clampedCenterY
    };
  }
}
