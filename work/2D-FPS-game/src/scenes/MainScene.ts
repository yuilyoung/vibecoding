import Phaser from "phaser";
import { GeneratedAudioCuePlayer } from "../domain/audio/GeneratedAudioCuePlayer";
import { SoundCueLogic, type SoundCueEvent, type SoundCueKey } from "../domain/audio/SoundCueLogic";
import { DummyAiLogic, type CoverPoint, type DummyAiDecision } from "../domain/ai/DummyAiLogic";
import { createCenteredRect, intersectsRect, type Rect } from "../domain/collision/CollisionLogic";
import { resolveBulletCollision, resolveHazardOutcome } from "../domain/combat/CombatResolution";
import { WeaponInventoryLogic } from "../domain/combat/WeaponInventoryLogic";
import { WeaponLogic, type WeaponConfig } from "../domain/combat/WeaponLogic";
import { advanceProjectile, type ProjectileConfig } from "../domain/combat/ProjectileRuntime";
import { resolveExplosion } from "../domain/combat/ExplosionLogic";
import { castBeam } from "../domain/combat/BeamLogic";
import { advanceAirStrike, createAirStrike, type AirStrikeState } from "../domain/combat/AirStrikeLogic";
import {
  canApplyHazard,
  canDummyFire,
  canInterruptReload,
  canPlayerFire,
  canPlayerReload,
  canPlayerUseCombatInteraction,
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
  weapons?: Record<string, unknown>;
}

type BalanceWeaponConfig = Partial<WeaponConfig> & {
  readonly label?: string;
  readonly salvoCount?: number;
};

interface BulletView {
  sprite: Phaser.GameObjects.Rectangle;
  velocityX: number;
  velocityY: number;
  damage: number;
  owner: "player" | "dummy";
  effectProfile: ImpactProfile;
  projectileConfig: ProjectileConfig;
  bouncesRemaining?: number;
}

type ImpactProfile = "carbine" | "scatter" | "bazooka" | "grenade" | "sniper" | "airStrike" | "dummy" | "pickup-ammo" | "pickup-health";

interface ActiveAirStrikeView {
  state: AirStrikeState;
  owner: "player" | "dummy";
}

interface ImpactFxView {
  flash: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  rays: Phaser.GameObjects.Line[];
  expiresAtMs: number;
  durationMs: number;
}

interface ShotTrailView {
  line: Phaser.GameObjects.Line;
  expiresAtMs: number;
  durationMs: number;
}

interface MovementFxView {
  sprite: Phaser.GameObjects.Arc;
  expiresAtMs: number;
  durationMs: number;
  driftX: number;
  driftY: number;
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
  sprite: Phaser.GameObjects.Image;
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
  readonly projectileConfig: ProjectileConfig;
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

type CoverEffectId = "vision-jam" | "shield" | "repair";

interface TerrainCrop {
  x: number;
  y: number;
  width: number;
  height: number;
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
  playerX: number;
  playerY: number;
  playerHullAngle: number;
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
  private static readonly AMMO_OVERDRIVE_MS = 6000;
  private static readonly ACTOR_HALF_SIZE = 27;
  private static readonly ACTOR_MIN_SEPARATION = 42;
  private static readonly ACTOR_COLLIDER_WIDTH = 40;
  private static readonly ACTOR_COLLIDER_HEIGHT = 40;
  private static readonly COVER_VISION_RADIUS = 10;
  private static readonly MAX_BULLETS = 96;
  private static readonly MAX_IMPACT_EFFECTS = 72;
  private static readonly MAX_SHOT_TRAILS = 72;
  private static readonly MAX_MOVEMENT_EFFECTS = 56;
  private static readonly MAX_FRAME_DELTA_MS = 50;
  private static readonly OBSTACLE_CONTACT_EPSILON = 1.0;
  private static readonly ACTOR_BODY_SCALE = 0.42;
  private static readonly ACTOR_ROTATION_OFFSET = Math.PI / 2;
  private static readonly PLAYER_WEAPON_SCALE = 0.64;
  private static readonly DUMMY_WEAPON_SCALE = 0.6;
  private static readonly BODY_TURN_RATE = Math.PI * 1.6;
  private static readonly TURRET_FRAME_WIDTH = 128;
  private static readonly TURRET_FRAME_HEIGHT = 128;
  private static readonly CARBINE_TURRET_FRAMES = 8;
  private static readonly SCATTER_TURRET_FRAMES = 11;
  private static readonly PLAYFIELD_MIN_X = 28;
  private static readonly PLAYFIELD_MAX_X = 932;
  private static readonly PLAYFIELD_MIN_Y = 24;
  private static readonly PLAYFIELD_MAX_Y = 516;
  private static readonly WEAPON_MACHINE_KEY = "runtime-weapon-machine";
  private static readonly WEAPON_GUN_KEY = "runtime-weapon-gun";
  private static readonly GROUND_BODY_BLUE_KEY = "ground-body-blue";
  private static readonly GROUND_BODY_RED_KEY = "ground-body-red";
  private static readonly GROUND_TERRAIN_KEY = "ground-terrain";
  private static readonly GROUND_TURRET_CARBINE_BLUE_KEY = "ground-turret-carbine-blue";
  private static readonly GROUND_TURRET_CARBINE_RED_KEY = "ground-turret-carbine-red";
  private static readonly GROUND_TURRET_SCATTER_BLUE_KEY = "ground-turret-scatter-blue";
  private static readonly GROUND_TURRET_SCATTER_RED_KEY = "ground-turret-scatter-red";
  private static readonly OBSTACLE_CORE_KEY = "arena-obstacle-core";
  private static readonly OBSTACLE_TOWER_KEY = "arena-obstacle-tower";
  private static readonly OBSTACLE_BARRIER_KEY = "arena-obstacle-barrier";
  private static readonly GATE_PANEL_KEY = "arena-gate-panel";
  private static readonly VENT_PANEL_KEY = "arena-vent-panel";
  private static readonly PICKUP_AMMO_KEY = "arena-pickup-ammo";
  private static readonly PICKUP_HEALTH_KEY = "arena-pickup-health";

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
    weapon3: Phaser.Input.Keyboard.Key;
    weapon4: Phaser.Input.Keyboard.Key;
    weapon5: Phaser.Input.Keyboard.Key;
    weapon6: Phaser.Input.Keyboard.Key;
    interact: Phaser.Input.Keyboard.Key;
  };
  private playerSprite!: Phaser.GameObjects.Image;
  private targetDummy!: Phaser.GameObjects.Image;
  private playerWeaponSprite!: Phaser.GameObjects.Sprite;
  private dummyWeaponSprite!: Phaser.GameObjects.Sprite;
  private crosshairHorizontal!: Phaser.GameObjects.Rectangle;
  private crosshairVertical!: Phaser.GameObjects.Rectangle;
  private muzzleFlash!: Phaser.GameObjects.Arc;
  private ammoPickup!: PickupView;
  private healthPickup!: PickupView;
  private readonly playerLogic: PlayerLogic;
  private readonly dummyLogic: PlayerLogic;
  private readonly weaponSlots: PlayerWeaponSlot[];
  private readonly weaponInventory: WeaponInventoryLogic;
  private readonly dummyWeaponSlots: PlayerWeaponSlot[];
  private readonly roundLogic: RoundLogic;
  private readonly dummyAiLogic: DummyAiLogic;
  private readonly soundCueLogic: SoundCueLogic;
  private readonly audioCuePlayer: GeneratedAudioCuePlayer;
  private readonly gameBalance: GameBalance;
  private readonly bullets: BulletView[];
  private readonly activeAirStrikes: ActiveAirStrikeView[];
  private readonly impactEffects: ImpactFxView[];
  private readonly shotTrails: ShotTrailView[];
  private readonly movementEffects: MovementFxView[];
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
  private dummyInCover: boolean;
  private dummyCoverBonusUntilMs: number;
  private activeDummyCoverIndex: number | null;
  private nextDummyRepairTickAtMs: number;
  private playerUnlimitedAmmoUntilMs: number;
  private lastDummyShouldFire: boolean;
  private lastDummySteerX: number;
  private lastDummySteerY: number;
  private dummySteerLockUntilMs: number;
  private lastSpawnSummary: string;
  private muzzleFlashUntilMs: number;
  private currentPlayerTeam: TeamId;
  private currentDummyTeam: TeamId;
  private currentDummyWeaponId: string;
  private playerBodyAngle: number;
  private dummyBodyAngle: number;
  private nextPlayerMoveFxAtMs: number;
  private nextDummyMoveFxAtMs: number;
  private lastDummyIntentKey: string;
  private lastActiveWeaponReloading: boolean;
  private overlayState: {
    visible: boolean;
    title: string;
    subtitle: string;
  };
  private playerConsecutiveBlockedFrames: number;
  private dummyConsecutiveBlockedFrames: number;
  private suppressPointerFireUntilMs: number;
  private nextGateInteractionAtMs: number;
  private static readonly STUCK_ESCAPE_THRESHOLD = 3;
  private static readonly SPIRAL_SCAN_MAX_STEPS = 24;
  private static readonly SPIRAL_SCAN_STEP_SIZE = 8;

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
    this.dummyWeaponSlots = this.createDummyWeaponSlots(gameBalance);
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
    this.activeAirStrikes = [];
    this.impactEffects = [];
    this.shotTrails = [];
    this.movementEffects = [];
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
    this.dummyInCover = false;
    this.dummyCoverBonusUntilMs = 0;
    this.activeDummyCoverIndex = null;
    this.nextDummyRepairTickAtMs = 0;
    this.playerUnlimitedAmmoUntilMs = 0;
    this.lastDummyShouldFire = false;
    this.lastDummySteerX = 1;
    this.lastDummySteerY = 0;
    this.dummySteerLockUntilMs = 0;
    this.lastSpawnSummary = "WAITING";
    this.muzzleFlashUntilMs = 0;
    this.currentPlayerTeam = "BLUE";
    this.currentDummyTeam = "RED";
    this.currentDummyWeaponId = "carbine";
    this.playerBodyAngle = 0;
    this.dummyBodyAngle = 0;
    this.nextPlayerMoveFxAtMs = 0;
    this.nextDummyMoveFxAtMs = 0;
    this.lastDummyIntentKey = "chase:false";
    this.lastActiveWeaponReloading = false;
    this.playerConsecutiveBlockedFrames = 0;
    this.dummyConsecutiveBlockedFrames = 0;
    this.suppressPointerFireUntilMs = 0;
    this.nextGateInteractionAtMs = 0;
    this.overlayState = {
      visible: false,
      title: "",
      subtitle: ""
    };
  }

  public preload(): void {
    this.load.image(MainScene.WEAPON_MACHINE_KEY, "/assets/runtime/sprites/weapon-machine.png");
    this.load.image(MainScene.WEAPON_GUN_KEY, "/assets/runtime/sprites/weapon-gun.png");
    this.load.image(MainScene.GROUND_BODY_BLUE_KEY, "/assets/runtime/sprites/ground-body-blue.png");
    this.load.image(MainScene.GROUND_BODY_RED_KEY, "/assets/runtime/sprites/ground-body-red.png");
    this.load.image(MainScene.GROUND_TERRAIN_KEY, "/assets/runtime/sprites/ground-terrain.png");
    this.load.spritesheet(MainScene.GROUND_TURRET_CARBINE_BLUE_KEY, "/assets/runtime/sprites/ground-turret-carbine-blue.png", {
      frameWidth: MainScene.TURRET_FRAME_WIDTH,
      frameHeight: MainScene.TURRET_FRAME_HEIGHT
    });
    this.load.spritesheet(MainScene.GROUND_TURRET_CARBINE_RED_KEY, "/assets/runtime/sprites/ground-turret-carbine-red.png", {
      frameWidth: MainScene.TURRET_FRAME_WIDTH,
      frameHeight: MainScene.TURRET_FRAME_HEIGHT
    });
    this.load.spritesheet(MainScene.GROUND_TURRET_SCATTER_BLUE_KEY, "/assets/runtime/sprites/ground-turret-scatter-blue.png", {
      frameWidth: MainScene.TURRET_FRAME_WIDTH,
      frameHeight: MainScene.TURRET_FRAME_HEIGHT
    });
    this.load.spritesheet(MainScene.GROUND_TURRET_SCATTER_RED_KEY, "/assets/runtime/sprites/ground-turret-scatter-red.png", {
      frameWidth: MainScene.TURRET_FRAME_WIDTH,
      frameHeight: MainScene.TURRET_FRAME_HEIGHT
    });
    if (this.gameBalance.actorSkinSource === "spritesheet") {
      this.load.spritesheet("actor-skins", this.gameBalance.actorSpritesheetPath, {
        frameWidth: this.gameBalance.actorFrameWidth,
        frameHeight: this.gameBalance.actorFrameHeight
      });
    }
  }

  public create(): void {
    if (this.input.keyboard === null) {
      throw new Error("Keyboard input is unavailable in MainScene.");
    }

    this.crosshairHorizontal = this.add.rectangle(0, 0, 20, 3, 0xf8fbff, 0.95).setDepth(20);
    this.crosshairVertical = this.add.rectangle(0, 0, 3, 20, 0xf8fbff, 0.95).setDepth(20);
    this.muzzleFlash = this.add.circle(0, 0, 8, 0xffd27a, 0.9).setDepth(8).setVisible(false);

    this.createArenaPropTextures();
    this.createActorSkins();
    this.createTurretAnimations();
    this.addArenaBackdrop();
    this.addObstacle(480, 270, 120, 120, 0xe0a54f, { x: 792, y: 64, width: 64, height: 64 });
    this.addObstacle(260, 180, 80, 180, 0x6bb6ff, { x: 448, y: 0, width: 96, height: 256 });
    this.addObstacle(710, 340, 160, 60, 0x7fd174, { x: 768, y: 320, width: 96, height: 96 });
    this.gate = this.addGate(482, 430, 96, 24, 0xffc15d, { x: 448, y: 0, width: 96, height: 256 });
    this.hazardZone = this.addHazardZone(510, 138, 170, 46);
    this.addCoverPointMarkers();
    this.ammoPickup = {
      sprite: this.add.image(160, 430, MainScene.PICKUP_AMMO_KEY).setScale(0.44).setDepth(4),
      label: this.add.text(160, 404, "AMMO", {
        color: "#9adfff",
        fontFamily: "monospace",
        fontSize: "10px"
      }).setOrigin(0.5).setAlpha(0.8),
      available: true,
      respawnAtMs: null
    };
    this.healthPickup = {
      sprite: this.add.image(870, 430, MainScene.PICKUP_HEALTH_KEY).setScale(0.44).setDepth(4),
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
    this.playerWeaponSprite = this.add
      .sprite(this.playerSprite.x, this.playerSprite.y, MainScene.GROUND_TURRET_CARBINE_BLUE_KEY, 0)
      .setDepth(6)
      .setOrigin(0.5, 0.72)
      .setScale(MainScene.PLAYER_WEAPON_SCALE);
    this.dummyWeaponSprite = this.add
      .sprite(this.targetDummy.x, this.targetDummy.y, MainScene.GROUND_TURRET_CARBINE_RED_KEY, 0)
      .setDepth(6)
      .setOrigin(0.5, 0.72)
      .setScale(MainScene.DUMMY_WEAPON_SCALE);
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
      weapon3: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      weapon4: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      weapon5: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
      weapon6: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SIX),
      interact: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    };
    this.lastCombatEvent = "PRESS ENTER TO ENTER STAGE";

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.events.on("shutdown", this.onSceneShutdown, this);
  }

  private onSceneShutdown(): void {
    this.input.off("pointerdown", this.handlePointerDown, this);
    const resetSnapshot: HudSnapshot = {
      phase: "STAGE ENTRY",
      team: "UNSET",
      spawn: "Awaiting deployment",
      activeWeapon: "Carbine",
      weaponSlot: 1,
      ammoInMagazine: this.gameBalance.magazineSize,
      reserveAmmo: this.gameBalance.reserveAmmo,
      isReloading: false,
      reloadProgress: 0,
      playerHealth: this.gameBalance.maxHealth,
      playerMaxHealth: this.gameBalance.maxHealth,
      dummyHealth: this.gameBalance.maxHealth,
      dummyMaxHealth: this.gameBalance.maxHealth,
      gateOpen: false,
      roundNumber: 1,
      playerScore: 0,
      dummyScore: 0,
      scoreToWin: this.gameBalance.matchScoreToWin,
      lastEvent: "Press Enter to enter the arena.",
      lastSoundCue: "NONE",
      movementMode: "Walk",
      movementBlocked: false,
      roundStartLabel: "LIVE",
      ammoPickupLabel: "READY",
      healthPickupLabel: "READY",
      coverVisionActive: false,
      coverVisionX: 480,
      coverVisionY: 270,
      coverVisionRadius: 72,
      overlay: { visible: false, title: "", subtitle: "" }
    };

    window.dispatchEvent(
      new CustomEvent<HudSnapshot>(HUD_SNAPSHOT_EVENT, { detail: resetSnapshot })
    );
  }

  private handlePointerDown(): void {
    if (!canPlayerUseCombatInteraction(this.getCombatAvailability(this.time.now))) {
      return;
    }

    const playerDistanceToGate = Phaser.Math.Distance.Between(
      this.playerSprite.x,
      this.playerSprite.y,
      this.gate.sprite.x,
      this.gate.sprite.y
    );

    if (this.time.now < this.nextGateInteractionAtMs || !isGateInteractionAllowed(playerDistanceToGate, 92)) {
      return;
    }

    this.applyGateToggle();
    this.nextGateInteractionAtMs = this.time.now + 500;
    this.suppressPointerFireUntilMs = this.time.now + 1000;
    this.emitSoundCue({ kind: "gate", action: this.gate.open ? "open" : "close" });
  }

  public update(_: number, delta: number): void {
    if (this.cursors === undefined || this.moveKeys === undefined) {
      return;
    }

    const now = this.time.now;
    const deltaSeconds = this.getStableDeltaSeconds(delta);

    // === INPUT === (gather all input state; no mutations)
    this.handleStageFlow(now);
    const combatLocked = !this.isCombatLive(now);
    const inputLocked = combatLocked || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || this.playerLogic.isStunned(now);
    const moveInputX = inputLocked
      ? 0
      : Number(this.moveKeys.right.isDown || this.cursors.right.isDown) -
        Number(this.moveKeys.left.isDown || this.cursors.left.isDown);
    const moveInputY = inputLocked
      ? 0
      : Number(this.moveKeys.down.isDown || this.cursors.down.isDown) -
        Number(this.moveKeys.up.isDown || this.cursors.up.isDown);
    const previousX = this.playerLogic.state.positionX;
    const previousY = this.playerLogic.state.positionY;
    const isPlayerMoving = moveInputX !== 0 || moveInputY !== 0;

    // === LOGIC === (game state mutations in dependency order)

    // -- Movement: player body rotation + position --
    if (!inputLocked && isPlayerMoving) {
      const desiredMoveAngle = Math.atan2(moveInputY, moveInputX);
      this.playerBodyAngle = this.rotateAngleTowards(
        this.playerBodyAngle,
        desiredMoveAngle,
        MainScene.BODY_TURN_RATE * deltaSeconds
      );
    }

    this.playerLogic.move(
      {
        x: moveInputX,
        y: moveInputY,
        sprint: this.moveKeys.sprint.isDown
      },
      deltaSeconds,
      now
    );

    let playerCenterX = Phaser.Math.Clamp(
      this.playerLogic.state.positionX + MainScene.ACTOR_HALF_SIZE,
      MainScene.PLAYFIELD_MIN_X,
      MainScene.PLAYFIELD_MAX_X
    );
    let playerCenterY = Phaser.Math.Clamp(
      this.playerLogic.state.positionY + MainScene.ACTOR_HALF_SIZE,
      MainScene.PLAYFIELD_MIN_Y,
      MainScene.PLAYFIELD_MAX_Y
    );

    this.updateDummyMovement(deltaSeconds, now);

    if (!this.roundLogic.state.isMatchOver && this.matchFlow.state.phase !== "stage-entry") {
      this.playerLogic.updateAim(this.input.activePointer.worldX - MainScene.ACTOR_HALF_SIZE, this.input.activePointer.worldY - MainScene.ACTOR_HALF_SIZE, now);
    }

    // -- Weapon ticks --
    for (const slot of this.weaponSlots) {
      slot.logic.update(now);
    }
    this.updateReloadAudioState(now);
    for (const slot of this.dummyWeaponSlots) {
      slot.logic.update(now);
    }
    this.handleWeaponSwitch();
    this.handleReloadInterrupt(now);
    this.handleReload(now);

    // -- Bullets: advance existing bullets BEFORE spawning new ones --
    // This prevents newly fired bullets from getting a double-update on their
    // spawn frame (move on fire + move on updateBullets in the same tick).
    this.updateBullets(deltaSeconds);
    this.updateAirStrikes(delta);

    // -- Fire: spawn new bullets (will be advanced next frame) --
    this.handleFire(now);
    this.handleDummyFire(now);

    // -- Death-causing operations (hazard, pickups, round logic) --
    // Grouped so all actor-death sources run before death-dependent logic.
    this.handleHazardZone(now);
    this.handleAmmoPickup(now);
    this.handleHealthPickup(now);
    this.handleGateInteraction();

    // -- Round / match state (depends on deaths above) --
    this.handleRoundReset(now);
    this.handleMatchConfirm(now);

    // === RESOLVE === (collision resolution, actor separation)
    const playerCollision = this.resolvePlayerObstacleCollision(playerCenterX, playerCenterY, previousX, previousY);
    const playerBlocked = playerCollision.blocked;
    playerCenterX = playerCollision.centerX;
    playerCenterY = playerCollision.centerY;

    this.resolveActorSeparation();
    this.updateDummyCoverState(now);

    // === VISUAL === (all rendering / HUD updates; no game-state mutations)
    this.playerSprite.setPosition(playerCenterX, playerCenterY);
    this.playerSprite.setRotation(this.getActorRotation(this.playerBodyAngle));
    this.emitMovementFxForActor("player", now, isPlayerMoving ? 1 : 0);
    this.updateImpactEffects(now);
    this.updateShotTrails(now);
    this.updateMovementEffects(now);
    this.updatePlayerVisuals(now);
    this.updateDummyVisuals(now);
    this.updateWeaponVisuals();
    this.updatePickupVisuals(now);
    this.updateCoverPointVisuals();
    this.updateCrosshair(now);
    this.updateMatchOverlay(now);

    // === EMIT === (outbound events: HUD snapshot, sound cues)
    this.publishHudSnapshot(now, playerBlocked);
  }

  private getStableDeltaSeconds(deltaMs: number): number {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      return 0;
    }

    return Math.min(deltaMs, MainScene.MAX_FRAME_DELTA_MS) / 1000;
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
      gateOpen: this.gate?.open ?? false,
      roundNumber: this.roundLogic.state.roundNumber,
      playerScore: this.roundLogic.state.playerScore,
      dummyScore: this.roundLogic.state.dummyScore,
      lastEvent: this.lastCombatEvent,
      playerX: this.playerSprite.x,
      playerY: this.playerSprite.y,
      playerHullAngle: this.playerBodyAngle
    };
  }

  public debugGetRuntimeStats(): {
    bullets: number;
    impactEffects: number;
    shotTrails: number;
    movementEffects: number;
  } {
    return {
      bullets: this.bullets.length,
      impactEffects: this.impactEffects.length,
      shotTrails: this.shotTrails.length,
      movementEffects: this.movementEffects.length
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
    this.emitSoundCue({ kind: "match-start" });
    this.lastCombatEvent = "COMBAT LIVE";
  }

  public debugSwapWeapon(): void {
    const nextIndex = (this.weaponInventory.getActiveIndex() + 1) % this.weaponSlots.length;

    this.tryEquipSlot(nextIndex, "SWAPPED TO");
  }

  public debugFire(): void {
    if (!this.isCombatLive(this.time.now) || this.dummyLogic.isDead() || this.playerLogic.isDead()) {
      return;
    }

    const activeWeapon = this.getActiveWeaponSlot();
    const attempt = activeWeapon.logic.tryFire(this.time.now);

    if (!attempt.allowed) {
      this.lastCombatEvent = attempt.reason.toUpperCase();
      if (attempt.reason === "empty" || attempt.reason === "no-reserve") {
        this.emitSoundCue({ kind: "reload", action: "empty" });
      }
      return;
    }

    this.resolvePlayerWeaponFire(activeWeapon, attempt.projectile, attempt.bulletSpeed, attempt.damage);
    this.lastCombatEvent = `${activeWeapon.label.toUpperCase()} FIRED`;
  }

  public debugMovePlayerTo(x: number, y: number): void {
    this.playerLogic.state.positionX = x - MainScene.ACTOR_HALF_SIZE;
    this.playerLogic.state.positionY = y - MainScene.ACTOR_HALF_SIZE;
    this.playerSprite.setPosition(x, y);
  }

  public debugSetPlayerHullAngle(angleRadians: number): void {
    this.playerBodyAngle = Phaser.Math.Angle.Wrap(angleRadians);
    this.playerSprite.setRotation(this.getActorRotation(this.playerBodyAngle));
  }

  public debugToggleGate(): void {
    this.applyGateToggle();
  }

  public debugForceMatchOver(winner: "PLAYER" | "DUMMY"): void {
    this.roundLogic.state.playerScore = winner === "PLAYER" ? this.roundLogic.state.scoreToWin : Math.max(0, this.roundLogic.state.scoreToWin - 1);
    this.roundLogic.state.dummyScore = winner === "DUMMY" ? this.roundLogic.state.scoreToWin : Math.max(0, this.roundLogic.state.scoreToWin - 1);
    this.roundLogic.state.matchWinner = winner;
    this.roundLogic.state.isMatchOver = true;
    this.roundLogic.state.lastResult = `${winner} WON MATCH`;
    this.matchFlow.enterMatchOver();
    this.matchConfirmAtMs = this.time.now;
    this.lastCombatEvent = `${winner} LOCKED`;
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
      this.emitSoundCue({ kind: "match-start" });
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
    this.currentDummyWeaponId = "carbine";
    this.lastDummyIntentKey = "chase:false";
    this.lastActiveWeaponReloading = false;
    this.playerBodyAngle = deployment.playerRotation;
    this.dummyBodyAngle = deployment.dummyRotation;
    this.playerSprite.setPosition(deployment.playerPositionX, deployment.playerPositionY);
    this.playerSprite.setRotation(this.getActorRotation(this.playerBodyAngle));
    this.targetDummy.setPosition(deployment.dummyPositionX, deployment.dummyPositionY);
    this.targetDummy.setRotation(this.getActorRotation(this.dummyBodyAngle));
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

    if (this.isAmmoOverdriveActive(now)) {
      this.getActiveWeaponSlot().logic.cancelReload(now);
      this.getActiveWeaponSlot().logic.restockAllAmmo(now);
      this.lastCombatEvent = "AMMO OVERDRIVE";
      return;
    }

    if (!Phaser.Input.Keyboard.JustDown(this.moveKeys!.reload)) {
      return;
    }

    if (this.getActiveWeaponSlot().logic.startReload(now)) {
      this.lastCombatEvent = "RELOADING";
      this.emitSoundCue({ kind: "reload", action: "start" });
      return;
    }

    this.lastCombatEvent = "NO RESERVE";
    this.emitSoundCue({ kind: "reload", action: "empty" });
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
    const pointerFirePressed = now >= this.suppressPointerFireUntilMs && this.input.activePointer.leftButtonDown();
    const firePressed = pointerFirePressed || this.moveKeys?.fire.isDown === true;

    if (!firePressed || !canPlayerFire(this.getCombatAvailability(now))) {
      return;
    }

    const activeWeapon = this.getActiveWeaponSlot();
    const attempt = activeWeapon.logic.tryFire(now);

    if (!attempt.allowed) {
      this.lastCombatEvent = attempt.reason.toUpperCase();
      return;
    }

    this.resolvePlayerWeaponFire(activeWeapon, attempt.projectile, attempt.bulletSpeed, attempt.damage);
    if (this.isAmmoOverdriveActive(now)) {
      activeWeapon.logic.refundRound(now);
    }
    this.lastCombatEvent = `${activeWeapon.label.toUpperCase()} FIRED`;
    this.emitSoundCue({ kind: "fire", weaponId: activeWeapon.id === "scatter" ? "scatter" : activeWeapon.id === "carbine" ? "carbine" : "generic" });

    if (attempt.ammoInMagazine === 0) {
      this.lastCombatEvent = "MAG EMPTY";
    }
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
    this.playTurretFireAnimation(this.playerWeaponSprite, this.getWeaponTurretTexture(this.currentPlayerTeam, activeWeapon.id));
    const pelletCount = projectileConfig.pelletCount ?? activeWeapon.pelletCount;
    const spreadRadians = projectileConfig.spreadRadians ?? activeWeapon.spreadRadians;
    const pelletStart = -(pelletCount - 1) / 2;

    for (let index = 0; index < pelletCount; index += 1) {
      const spreadOffset = (pelletStart + index) * spreadRadians;
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
      effectProfile: this.getImpactProfile(activeWeapon.id),
      projectileConfig,
      bouncesRemaining: projectileConfig.bounceCount
    });
      this.trimBulletPool();

      this.spawnShotTrail(
        spawnX,
        spawnY,
        angle,
        activeWeapon.id === "scatter" ? 26 : 44,
        activeWeapon.id === "scatter" ? 0xffb86c : 0xffef9a,
        activeWeapon.id === "scatter" ? 90 : 70
      );
    }

    const muzzleAngle = this.playerLogic.state.aimAngleRadians;
    const muzzleProfile = activeWeapon.id === "scatter"
      ? { radius: 16, color: 0xffa44b, durationMs: 120 }
      : { radius: 9, color: 0xffef7b, durationMs: 80 };

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

  private firePlayerBeam(activeWeapon: PlayerWeaponSlot, projectileConfig: ProjectileConfig, damage: number): void {
    this.playTurretFireAnimation(this.playerWeaponSprite, this.getWeaponTurretTexture(this.currentPlayerTeam, activeWeapon.id));
    const angle = this.playerLogic.state.aimAngleRadians;
    const origin = {
      x: this.playerSprite.x + Math.cos(angle) * 24,
      y: this.playerSprite.y + Math.sin(angle) * 24
    };
    const hit = castBeam(
      origin,
      angle,
      projectileConfig.beamRange ?? 820,
      this.getActiveObstacles().map((obstacle) => obstacle.bounds),
      this.dummyLogic.isDead()
        ? []
        : [{
            ...this.getActorCollisionBounds(this.targetDummy.x, this.targetDummy.y),
            id: "dummy"
          }]
    );

    this.spawnShotTrail(origin.x, origin.y, angle, hit.distance, 0xdff8ff, 140);
    this.spawnImpactEffect(hit.hitPoint.x, hit.hitPoint.y, "sniper");

    if (hit.kind === "actor" && hit.targetId === "dummy" && !this.hasDummyCoverProtection(this.time.now)) {
      this.dummyLogic.takeDamage(projectileConfig.blastDamage ?? damage);
      this.emitSoundCue({ kind: "hit", target: "dummy" });
      this.lastCombatEvent = this.dummyLogic.isDead() ? "DUMMY DOWN" : "DUMMY HIT";

      if (this.dummyLogic.isDead()) {
        this.roundLogic.registerPlayerWin();
        this.scheduleResetAfterRound(this.time.now);
      }
      return;
    }

    if (hit.kind === "actor") {
      this.emitSoundCue({ kind: "deflect", mode: "shield" });
      this.lastCombatEvent = "COVER BLOCKED";
    }
  }

  private callPlayerAirStrike(projectileConfig: ProjectileConfig): void {
    const targetX = Phaser.Math.Clamp(this.input.activePointer.worldX, MainScene.PLAYFIELD_MIN_X, MainScene.PLAYFIELD_MAX_X);
    const targetY = Phaser.Math.Clamp(this.input.activePointer.worldY, MainScene.PLAYFIELD_MIN_Y, MainScene.PLAYFIELD_MAX_Y);

    this.playTurretFireAnimation(this.playerWeaponSprite, this.getWeaponTurretTexture(this.currentPlayerTeam, "airStrike"));
    this.activeAirStrikes.push({
      owner: "player",
      state: createAirStrike(targetX, targetY, {
        blastCount: projectileConfig.aoeCount ?? 5,
        blastDelayMs: projectileConfig.aoeIntervalMs ?? 320,
        spreadRadius: projectileConfig.aoeSpreadRadius ?? 48,
        blastRadius: projectileConfig.blastRadius ?? 96,
        damage: projectileConfig.blastDamage ?? 30,
        knockback: projectileConfig.knockback ?? 120
      })
    });
    this.spawnImpactEffect(targetX, targetY, "airStrike");
    this.lastCombatEvent = "AIR STRIKE CALLED";
  }

  private updateAirStrikes(deltaMs: number): void {
    for (let index = this.activeAirStrikes.length - 1; index >= 0; index -= 1) {
      const airStrike = this.activeAirStrikes[index];
      const result = advanceAirStrike(airStrike.state, deltaMs);
      airStrike.state = result.state;

      for (const blast of result.blasts) {
        this.spawnImpactEffect(blast.x, blast.y, "airStrike");
        this.applyExplosionDamage(blast.x, blast.y, blast.radius, blast.damage, blast.knockback, airStrike.owner);
      }

      if (airStrike.state.completed) {
        this.activeAirStrikes.splice(index, 1);
      }
    }
  }

  private handleDummyFire(now: number): void {
    if (!canDummyFire(this.getCombatAvailability(now))) {
      return;
    }

    if (!this.lastDummyShouldFire) {
      return;
    }

    const activeWeapon = this.getActiveDummyWeaponSlot();
    this.currentDummyWeaponId = activeWeapon.id;
    const attempt = activeWeapon.logic.tryFire(now);

    if (!attempt.allowed) {
      return;
    }

    const turretTexture = this.getWeaponTurretTexture(this.currentDummyTeam, activeWeapon.id);
    this.playTurretFireAnimation(this.dummyWeaponSprite, turretTexture);

    const pelletStart = -(activeWeapon.pelletCount - 1) / 2;
    for (let index = 0; index < activeWeapon.pelletCount; index += 1) {
      const spreadOffset = (pelletStart + index) * activeWeapon.spreadRadians;
      const angle = this.dummyLogic.state.aimAngleRadians + spreadOffset;
      const spawnX = this.targetDummy.x + Math.cos(angle) * 24;
      const spawnY = this.targetDummy.y + Math.sin(angle) * 24;
      const bullet = this.add.rectangle(
        spawnX,
        spawnY,
        activeWeapon.bulletWidth,
        activeWeapon.bulletHeight,
        activeWeapon.id === "scatter" ? 0xffaa72 : 0xff8b8b,
        1
      );
      bullet.setRotation(angle);

      this.bullets.push({
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

      this.spawnShotTrail(
        spawnX,
        spawnY,
        angle,
        activeWeapon.id === "scatter" ? 26 : 30,
        activeWeapon.id === "scatter" ? 0xffb47a : 0xff8c8c,
        activeWeapon.id === "scatter" ? 90 : 75
      );
    }

    this.emitSoundCue({ kind: "fire", weaponId: activeWeapon.id === "scatter" ? "scatter" : activeWeapon.id === "carbine" ? "carbine" : "generic" });
  }

  private handleWeaponSwitch(): void {
    if (this.moveKeys === undefined || !canPlayerUseCombatInteraction(this.getCombatAvailability(this.time.now))) {
      return;
    }

    const numberKeySlots = [
      this.moveKeys.weapon1,
      this.moveKeys.weapon2,
      this.moveKeys.weapon3,
      this.moveKeys.weapon4,
      this.moveKeys.weapon5,
      this.moveKeys.weapon6
    ];

    for (const [slotIndex, key] of numberKeySlots.entries()) {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        this.tryEquipSlot(slotIndex, "EQUIPPED");
        return;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.moveKeys.swap)) {
      const nextIndex = (this.weaponInventory.getActiveIndex() + 1) % this.weaponSlots.length;
      this.tryEquipSlot(nextIndex, "SWAPPED TO");
    }
  }

  private tryEquipSlot(slotIndex: number, eventPrefix: string): void {
    if (this.weaponInventory.selectSlot(slotIndex)) {
      this.getActiveWeaponSlot().logic.cancelReload(this.time.now);
      this.lastActiveWeaponReloading = false;
      this.lastCombatEvent = `${eventPrefix} ${this.getActiveWeaponSlot().label.toUpperCase()}`;
      this.emitSoundCue({ kind: "weapon-state", action: "swap" });
    }
  }

  private handleGateInteraction(): void {
    if (this.moveKeys === undefined || !canPlayerUseCombatInteraction(this.getCombatAvailability(this.time.now))) {
      return;
    }

    const distanceToGate = Phaser.Math.Distance.Between(
      this.playerSprite.x,
      this.playerSprite.y,
      this.gate.sprite.x,
      this.gate.sprite.y
    );
    const pointerDistanceToGate = Phaser.Math.Distance.Between(
      this.input.activePointer.worldX,
      this.input.activePointer.worldY,
      this.gate.sprite.x,
      this.gate.sprite.y
    );
    const interactionPressed = Phaser.Input.Keyboard.JustDown(this.moveKeys.interact) || this.moveKeys.interact.isDown;
    const pointerPressedGate = this.input.activePointer.leftButtonDown() && pointerDistanceToGate <= 36;

    if (this.time.now < this.nextGateInteractionAtMs || (!interactionPressed && !pointerPressedGate)) {
      return;
    }

    if (!pointerPressedGate && !isGateInteractionAllowed(distanceToGate, 92)) {
      this.lastCombatEvent = "GATE TOO FAR";
      return;
    }

    this.applyGateToggle();
    this.nextGateInteractionAtMs = this.time.now + 500;
    this.suppressPointerFireUntilMs = this.time.now + 1000;
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
      this.getActorCollisionBounds(sprite.x, sprite.y),
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
    const dummyBounds = dummyAlive ? this.getActorCollisionBounds(this.targetDummy.x, this.targetDummy.y) : null;
    const playerBounds = playerAlive ? this.getActorCollisionBounds(this.playerSprite.x, this.playerSprite.y) : null;

    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];
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

      const dummyCoverProtected = frame.hitDummy && bullet.owner === "player" && this.hasDummyCoverProtection(this.time.now);
      const appliedDamage = frame.hitDummy && bullet.owner === "player"
        ? dummyCoverProtected
          ? 0
          : bullet.damage
        : bullet.damage;

      if (frame.hitDummy && bullet.owner === "player" && !dummyCoverProtected) {
        this.dummyLogic.takeDamage(appliedDamage);
      }

      if (frame.hitDummy && bullet.owner === "player" && dummyCoverProtected) {
        this.spawnImpactEffect(frame.nextX, frame.nextY, bullet.effectProfile === "scatter" ? "scatter" : "carbine");
        this.spawnShotTrail(
          frame.nextX,
          frame.nextY,
          this.dummyLogic.state.aimAngleRadians + Math.PI,
          bullet.effectProfile === "scatter" ? 18 : 22,
          0x7dd3fc,
          85
        );
      }

      if (frame.hitPlayer && bullet.owner === "dummy") {
        this.playerLogic.takeDamage(appliedDamage, this.gameBalance.hitStunMs, this.time.now);
      }

      const bulletResolution = resolveBulletCollision({
        owner: bullet.owner,
        hitDummy: frame.hitDummy,
        hitPlayer: frame.hitPlayer,
        hitObstacle: frame.hitObstacle,
        outOfBounds: frame.outOfBounds,
        damage: bullet.damage,
        appliedDamage,
        targetDied: bullet.owner === "player" ? this.dummyLogic.isDead() : this.playerLogic.isDead(),
        coverProtected: dummyCoverProtected
      });

      if (bulletResolution.combatEvent !== null) {
        this.lastCombatEvent = bulletResolution.combatEvent;
      }

      if (dummyCoverProtected) {
        this.emitSoundCue({ kind: "deflect", mode: "shield" });
      } else if (frame.hitObstacle) {
        this.emitSoundCue({ kind: "deflect", mode: "ricochet" });
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

      if ((frame.hitObstacle || frame.hitDummy || frame.hitPlayer || frame.outOfBounds) && bullet.projectileConfig.blastRadius !== undefined) {
        this.spawnImpactEffect(frame.nextX, frame.nextY, bullet.effectProfile);
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
        this.bullets.splice(index, 1);
      }
    }
  }

  private applyExplosionDamage(
    centerX: number,
    centerY: number,
    radius: number,
    damage: number,
    knockback: number,
    owner: "player" | "dummy"
  ): void {
    const playerWasDead = this.playerLogic.isDead();
    const dummyWasDead = this.dummyLogic.isDead();
    const results = resolveExplosion({
      centerX,
      centerY,
      blastRadius: radius,
      baseDamage: damage,
      knockback,
      targets: [
        { id: "player", x: this.playerSprite.x, y: this.playerSprite.y },
        { id: "dummy", x: this.targetDummy.x, y: this.targetDummy.y }
      ]
    });

    for (const result of results) {
      if (owner === "player" && result.id === "dummy" && !this.dummyLogic.isDead()) {
        this.dummyLogic.takeDamage(this.hasDummyCoverProtection(this.time.now) ? 0 : result.damage);
      }

      if (owner === "dummy" && result.id === "player" && !this.playerLogic.isDead()) {
        this.playerLogic.takeDamage(result.damage, this.gameBalance.hitStunMs, this.time.now);
      }
    }

    if (!dummyWasDead && this.dummyLogic.isDead() && !this.roundLogic.state.isMatchOver) {
      this.roundLogic.registerPlayerWin();
      this.scheduleResetAfterRound(this.time.now);
    } else if (!playerWasDead && this.playerLogic.isDead() && !this.roundLogic.state.isMatchOver) {
      this.roundLogic.registerDummyWin();
      this.scheduleResetAfterRound(this.time.now);
    }
  }

  private spawnImpactEffect(x: number, y: number, profile: ImpactProfile): void {
    const fxProfile = profile === "scatter"
      ? { flashRadius: 12, ringRadius: 20, flashColor: 0xffa44b, ringColor: 0xffe0aa, durationMs: 170, rayLength: 18 }
      : profile === "bazooka"
        ? { flashRadius: 18, ringRadius: 30, flashColor: 0xff7a3d, ringColor: 0xffd08a, durationMs: 220, rayLength: 26 }
      : profile === "grenade"
        ? { flashRadius: 16, ringRadius: 27, flashColor: 0x7cff8a, ringColor: 0xd5ffb0, durationMs: 210, rayLength: 22 }
      : profile === "sniper"
        ? { flashRadius: 10, ringRadius: 18, flashColor: 0xdff8ff, ringColor: 0x83eaff, durationMs: 160, rayLength: 28 }
      : profile === "airStrike"
        ? { flashRadius: 24, ringRadius: 42, flashColor: 0xfff06a, ringColor: 0xff6f4a, durationMs: 260, rayLength: 34 }
      : profile === "pickup-ammo"
        ? { flashRadius: 15, ringRadius: 28, flashColor: 0x6ce5ff, ringColor: 0xbaf4ff, durationMs: 260, rayLength: 22 }
        : profile === "pickup-health"
          ? { flashRadius: 14, ringRadius: 24, flashColor: 0x7effa8, ringColor: 0xd9ffe6, durationMs: 240, rayLength: 20 }
      : profile === "dummy"
        ? { flashRadius: 7, ringRadius: 11, flashColor: 0xff8d8d, ringColor: 0xffdfdf, durationMs: 110, rayLength: 10 }
        : { flashRadius: 8, ringRadius: 12, flashColor: 0xffe16c, ringColor: 0xfff0ad, durationMs: 115, rayLength: 13 };
    const flash = this.add.circle(x, y, fxProfile.flashRadius, fxProfile.flashColor, 0.85).setDepth(9);
    const ring = this.add
      .circle(x, y, fxProfile.ringRadius, fxProfile.ringColor, 0)
      .setDepth(9)
      .setStrokeStyle(profile === "scatter" || profile === "bazooka" || profile.startsWith("pickup-") ? 3 : 2, fxProfile.ringColor, 0.9);
    const rays = [0, 1, 2, 3].map((index) => {
      const angle = Phaser.Math.DegToRad(index * 45 + (profile === "scatter" || profile === "bazooka" ? 12 : profile.startsWith("pickup-") ? 8 : 0));
      return this.add.line(
        x,
        y,
        Math.cos(angle) * 3,
        Math.sin(angle) * 3,
        Math.cos(angle) * fxProfile.rayLength,
        Math.sin(angle) * fxProfile.rayLength,
        fxProfile.ringColor,
        0.95
      ).setDepth(9).setLineWidth(profile === "scatter" || profile === "bazooka" || profile.startsWith("pickup-") ? 3 : 2);
    });

    this.impactEffects.push({
      flash,
      ring,
      rays,
      expiresAtMs: this.time.now + fxProfile.durationMs,
      durationMs: fxProfile.durationMs
    });
    this.trimImpactEffectPool();
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

  private spawnShotTrail(x: number, y: number, angle: number, length: number, color: number, durationMs: number): void {
    const line = this.add.line(
      x,
      y,
      0,
      0,
      Math.cos(angle) * length,
      Math.sin(angle) * length,
      color,
      0.72
    ).setDepth(8).setLineWidth(3);

    this.shotTrails.push({
      line,
      expiresAtMs: this.time.now + durationMs,
      durationMs
    });
    this.trimShotTrailPool();
  }

  private updateShotTrails(now: number): void {
    for (let index = this.shotTrails.length - 1; index >= 0; index -= 1) {
      const trail = this.shotTrails[index];
      const remainingMs = trail.expiresAtMs - now;

      if (remainingMs <= 0) {
        trail.line.destroy();
        this.shotTrails.splice(index, 1);
        continue;
      }

      const progress = 1 - remainingMs / trail.durationMs;
      trail.line.setAlpha(0.72 - progress * 0.6);
      trail.line.setScale(1 + progress * 0.08);
    }
  }

  private updateMovementEffects(now: number): void {
    for (let index = this.movementEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.movementEffects[index];
      const remainingMs = effect.expiresAtMs - now;

      if (remainingMs <= 0) {
        effect.sprite.destroy();
        this.movementEffects.splice(index, 1);
        continue;
      }

      const progress = 1 - remainingMs / effect.durationMs;
      effect.sprite.x += effect.driftX;
      effect.sprite.y += effect.driftY;
      effect.sprite.setScale(1 + progress * 0.65);
      effect.sprite.setAlpha(0.22 * (1 - progress));
    }
  }

  private emitMovementFxForActor(actor: "player" | "dummy", now: number, throttleInput: number): void {
    const isPlayer = actor === "player";
    const sprite = isPlayer ? this.playerSprite : this.targetDummy;
    const actorLogic = isPlayer ? this.playerLogic : this.dummyLogic;
    const bodyAngle = isPlayer ? this.playerBodyAngle : this.dummyBodyAngle;
    const nextAllowedAtMs = isPlayer ? this.nextPlayerMoveFxAtMs : this.nextDummyMoveFxAtMs;
    const appliedSpeed = actorLogic.state.lastAppliedSpeed;

    if (sprite === undefined || actorLogic.isDead() || appliedSpeed <= 4 || now < nextAllowedAtMs) {
      return;
    }

    const direction = throttleInput < 0 ? 1 : -1;
    const offsetDistance = 18;
    const sideOffset = 12;
    const baseX = sprite.x + Math.cos(bodyAngle) * offsetDistance * direction;
    const baseY = sprite.y + Math.sin(bodyAngle) * offsetDistance * direction;
    const lateralX = Math.cos(bodyAngle + Math.PI / 2) * sideOffset;
    const lateralY = Math.sin(bodyAngle + Math.PI / 2) * sideOffset;
    const driftScale = throttleInput < 0 ? 0.12 : 0.2;

    this.spawnMovementFx(baseX - lateralX, baseY - lateralY, -Math.cos(bodyAngle) * driftScale, -Math.sin(bodyAngle) * driftScale, 0x9fb6c8, 3.8);
    this.spawnMovementFx(baseX + lateralX, baseY + lateralY, -Math.cos(bodyAngle) * driftScale, -Math.sin(bodyAngle) * driftScale, 0x8aa0b4, 3.4);

    if (isPlayer) {
      this.nextPlayerMoveFxAtMs = now + (this.moveKeys?.sprint.isDown === true ? 70 : 110);
      return;
    }

    this.nextDummyMoveFxAtMs = now + 120;
  }

  private spawnMovementFx(
    x: number,
    y: number,
    driftX: number,
    driftY: number,
    color: number,
    radius: number
  ): void {
    const sprite = this.add.circle(x, y, radius, color, 0.22).setDepth(4);
    this.movementEffects.push({
      sprite,
      expiresAtMs: this.time.now + 260,
      durationMs: 260,
      driftX,
      driftY
    });
    this.trimMovementEffectPool();
  }

  private trimBulletPool(): void {
    while (this.bullets.length > MainScene.MAX_BULLETS) {
      const oldest = this.bullets.shift();
      oldest?.sprite.destroy();
    }
  }

  private trimImpactEffectPool(): void {
    while (this.impactEffects.length > MainScene.MAX_IMPACT_EFFECTS) {
      const oldest = this.impactEffects.shift();
      if (oldest === undefined) {
        return;
      }
      oldest.flash.destroy();
      oldest.ring.destroy();
      for (const ray of oldest.rays) {
        ray.destroy();
      }
    }
  }

  private trimShotTrailPool(): void {
    while (this.shotTrails.length > MainScene.MAX_SHOT_TRAILS) {
      const oldest = this.shotTrails.shift();
      oldest?.line.destroy();
    }
  }

  private trimMovementEffectPool(): void {
    while (this.movementEffects.length > MainScene.MAX_MOVEMENT_EFFECTS) {
      const oldest = this.movementEffects.shift();
      oldest?.sprite.destroy();
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
    this.targetDummy.setScale(MainScene.ACTOR_BODY_SCALE * visual.scale);
  }

  private updateWeaponVisuals(): void {
    const playerAngle = this.playerLogic.state.aimAngleRadians;
    const dummyAngle = this.dummyLogic.state.aimAngleRadians;
    const activeWeapon = this.getActiveWeaponSlot();
    const playerWeaponTexture = this.getWeaponTurretTexture(this.currentPlayerTeam, activeWeapon.id);
    const dummyWeaponTexture = this.getWeaponTurretTexture(this.currentDummyTeam, this.currentDummyWeaponId);

    if (this.playerWeaponSprite.texture.key !== playerWeaponTexture) {
      this.playerWeaponSprite.setTexture(playerWeaponTexture, 0);
    }
    if (this.dummyWeaponSprite.texture.key !== dummyWeaponTexture) {
      this.dummyWeaponSprite.setTexture(dummyWeaponTexture, 0);
    }

    if (!this.playerWeaponSprite.anims.isPlaying) {
      this.playerWeaponSprite.setFrame(0);
    }
    if (!this.dummyWeaponSprite.anims.isPlaying) {
      this.dummyWeaponSprite.setFrame(0);
    }

    this.playerWeaponSprite
      .setPosition(this.playerSprite.x, this.playerSprite.y)
      .setRotation(this.getActorRotation(playerAngle))
      .setScale(MainScene.PLAYER_WEAPON_SCALE * this.playerSprite.scaleX)
      .setAlpha(this.playerSprite.alpha);

    this.dummyWeaponSprite
      .setPosition(this.targetDummy.x, this.targetDummy.y)
      .setRotation(this.getActorRotation(dummyAngle))
      .setScale(MainScene.DUMMY_WEAPON_SCALE * this.targetDummy.scaleX)
      .setAlpha(this.targetDummy.alpha);
  }

  private updatePickupVisuals(now: number): void {
    const ammoBob = Math.sin(now / 150) * 3;
    const healthBob = Math.cos(now / 170) * 3;
    this.ammoPickup.sprite.setY(430 + ammoBob);
    this.ammoPickup.label.setY(404 + ammoBob);
    this.healthPickup.sprite.setY(430 + healthBob);
    this.healthPickup.label.setY(404 + healthBob);
    this.ammoPickup.sprite.setScale(this.ammoPickup.available ? 1.08 + Math.sin(now / 120) * 0.04 : 1);
    this.healthPickup.sprite.setScale(this.healthPickup.available ? 1.08 + Math.cos(now / 130) * 0.04 : 1);
    this.ammoPickup.label.setAlpha(this.ammoPickup.available ? 0.88 : 0.2);
    this.healthPickup.label.setAlpha(this.healthPickup.available ? 0.88 : 0.2);
  }

  private updateDummyCoverState(now: number): void {
    const coverIndex = this.getActiveCoverIndexForActor(this.targetDummy.x, this.targetDummy.y);
    const inCoverNow = coverIndex !== null;

    if (inCoverNow && !this.dummyInCover) {
      this.dummyCoverBonusUntilMs = now + 1400;
      this.lastCombatEvent = this.getCoverEnterEvent(coverIndex);
    }

    this.dummyInCover = inCoverNow;
    this.activeDummyCoverIndex = coverIndex;

    if (coverIndex !== null && this.getCoverEffectId(coverIndex) === "repair" && now >= this.nextDummyRepairTickAtMs && !this.dummyLogic.isDead()) {
      const restored = this.dummyLogic.heal(2);
      this.nextDummyRepairTickAtMs = now + 280;

      if (restored > 0) {
        this.lastCombatEvent = `COVER REPAIR +${restored}`;
      }
    }
  }

  private hasDummyCoverProtection(now: number): boolean {
    return this.activeDummyCoverIndex !== null && this.getCoverEffectId(this.activeDummyCoverIndex) === "shield"
      ? true
      : now < this.dummyCoverBonusUntilMs && this.activeDummyCoverIndex !== null && this.getCoverEffectId(this.activeDummyCoverIndex) === "shield";
  }

  private isActorInsideCoverZone(centerX: number, centerY: number): boolean {
    return this.getActiveCoverIndexForActor(centerX, centerY) !== null;
  }

  private getActiveCoverIndexForActor(centerX: number, centerY: number): number | null {
    const coverRadius = this.gameBalance.coverPointRadius + 10;

    for (let index = 0; index < this.dummyCoverPoints.length; index += 1) {
      const coverPoint = this.dummyCoverPoints[index];
      if (Math.hypot(coverPoint.x - centerX, coverPoint.y - centerY) <= coverRadius) {
        return index;
      }
    }

    return null;
  }

  private getCoverEffectId(index: number): CoverEffectId {
    switch (index) {
      case 0:
        return "vision-jam";
      case 1:
        return "shield";
      default:
        return "repair";
    }
  }

  private getCoverLabel(index: number): string {
    switch (this.getCoverEffectId(index)) {
      case "vision-jam":
        return "VISION JAM";
      case "shield":
        return "SHIELD COVER";
      case "repair":
        return "REPAIR COVER";
    }
  }

  private getCoverEnterEvent(index: number | null): string {
    if (index === null) {
      return "DUMMY TOOK COVER";
    }

    switch (this.getCoverEffectId(index)) {
      case "vision-jam":
        return "DUMMY ACTIVATED VISION JAM";
      case "shield":
        return "DUMMY ACTIVATED SHIELD COVER";
      case "repair":
        return "DUMMY ACTIVATED REPAIR COVER";
    }
  }

  private updateDummyIntentEvent(decision: DummyAiDecision): void {
    const intentKey = `${decision.mode}:${decision.shouldFire}`;

    if (intentKey === this.lastDummyIntentKey) {
      return;
    }

    this.lastDummyIntentKey = intentKey;
    const nextEvent = this.getDummyIntentEvent(decision);

    if (nextEvent !== null) {
      this.lastCombatEvent = nextEvent;
    }
  }

  private updateReloadAudioState(now: number): void {
    const isReloading = this.getActiveWeaponSlot().logic.isReloading(now);

    if (this.lastActiveWeaponReloading && !isReloading) {
      this.emitSoundCue({ kind: "reload", action: "complete" });
    }

    this.lastActiveWeaponReloading = isReloading;
  }

  private getDummyIntentEvent(decision: DummyAiDecision): string | null {
    if (decision.mode === "cover") {
      if (decision.shouldFire) {
        return this.dummyInCover ? "DUMMY PEEKING FROM COVER" : "DUMMY HOLDING ANGLE";
      }

      return this.dummyInCover ? "DUMMY HOLDING COVER" : "DUMMY SETTING COVER";
    }

    if (decision.mode === "flank") {
      return this.dummyInCover ? "DUMMY RE-ENGAGING" : "DUMMY FLANKING";
    }

    if (decision.mode === "reposition") {
      return "DUMMY SHIFTING ANGLE";
    }

    if (decision.mode === "retreat" && decision.shouldFire) {
      return "DUMMY FALLING BACK";
    }

    if (decision.mode === "avoid-hazard") {
      return "DUMMY EVADING HAZARD";
    }

    return null;
  }

  private updateCoverPointVisuals(): void {
    const highlightCover = this.lastDummyDecision === "cover" || this.lastDummyDecision === "reposition";
    const pulse = 0.88 + Math.sin(this.time.now / 140) * 0.08;

    for (let index = 0; index < this.coverPointViews.length; index += 1) {
      const view = this.coverPointViews[index];
      const coverPoint = this.dummyCoverPoints[index];
      const activeCover = Math.hypot(coverPoint.x - this.targetDummy.x, coverPoint.y - this.targetDummy.y) <= this.gameBalance.coverPointRadius + 10;
      const baseColor = this.getCoverEffectId(index) === "vision-jam"
        ? 0xa78bfa
        : this.getCoverEffectId(index) === "shield"
          ? 0x38bdf8
          : 0x34d399;
      const activeColor = this.getCoverEffectId(index) === "vision-jam"
        ? 0xc4b5fd
        : this.getCoverEffectId(index) === "shield"
          ? 0x7dd3fc
          : 0x86efac;

      view.sprite.setFillStyle(activeCover ? activeColor : highlightCover ? 0xfde68a : baseColor, activeCover ? 0.4 : highlightCover ? 0.34 : 0.18);
      view.sprite.setStrokeStyle(1, activeCover ? activeColor : highlightCover ? 0xfacc15 : baseColor, activeCover ? 0.98 : highlightCover ? 0.95 : 0.65);
      view.label.setText(activeCover ? this.getCoverLabel(index) : this.getCoverLabel(index));
      view.label.setColor(activeCover ? "#f8fafc" : highlightCover ? "#fde68a" : "#dbeafe");
      view.label.setAlpha(activeCover ? 0.98 : highlightCover ? 0.95 : 0.7);
      view.sprite.setScale(activeCover ? pulse * 1.06 : highlightCover ? pulse : 1);
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
    this.playerSprite.setScale(MainScene.ACTOR_BODY_SCALE * visual.scale);
  }

  private updateCrosshair(now: number): void {
    const pointerX = Phaser.Math.Clamp(this.input.activePointer.worldX, MainScene.PLAYFIELD_MIN_X, MainScene.PLAYFIELD_MAX_X);
    const pointerY = Phaser.Math.Clamp(this.input.activePointer.worldY, MainScene.PLAYFIELD_MIN_Y, MainScene.PLAYFIELD_MAX_Y);
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
      currentHealth: this.dummyLogic.state.health,
      playerHealthRatio: this.playerLogic.state.health / this.playerLogic.state.maxHealth,
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
    this.updateDummyBodyAngle(desiredSteer.moveX, desiredSteer.moveY, deltaSeconds);

    this.currentDummyWeaponId = this.getActiveDummyWeaponSlot().id;
    this.lastDummyDecision = decision.mode;
    this.lastDummyShouldFire = decision.shouldFire;
    this.updateDummyIntentEvent(decision);
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

    let dummyCenterX = Phaser.Math.Clamp(
      this.dummyLogic.state.positionX + MainScene.ACTOR_HALF_SIZE,
      MainScene.PLAYFIELD_MIN_X,
      MainScene.PLAYFIELD_MAX_X
    );
    let dummyCenterY = Phaser.Math.Clamp(
      this.dummyLogic.state.positionY + MainScene.ACTOR_HALF_SIZE,
      MainScene.PLAYFIELD_MIN_Y,
      MainScene.PLAYFIELD_MAX_Y
    );
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
    this.targetDummy.setRotation(this.getActorRotation(this.dummyBodyAngle));
    this.emitMovementFxForActor("dummy", now, this.dummyLogic.state.lastAppliedSpeed > 0 ? 1 : 0);
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

    if (!Phaser.Input.Keyboard.JustDown(this.moveKeys.confirm) && !this.moveKeys.confirm.isDown) {
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
    const coverVision = this.getHudCoverVisionState();

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
        isReloading: activeWeapon.logic.isReloading(now),
        reloadProgress: activeWeapon.logic.isReloading(now)
          ? 1 - (activeWeapon.logic.getReloadRemaining(now) / activeWeapon.logic.getReloadDuration())
          : 0,
        playerHealth: this.playerLogic.state.health,
        playerMaxHealth: this.playerLogic.state.maxHealth,
        dummyHealth: this.dummyLogic.state.health,
        dummyMaxHealth: this.dummyLogic.state.maxHealth,
        gateOpen: this.gate?.open ?? false,
        lastEvent: this.lastCombatEvent,
        lastSoundCue: this.lastSoundCue,
        movementMode: this.playerLogic.state.isSprinting ? "Sprint" : "Walk",
        movementBlocked,
        roundStartLabel: this.getRoundStartStatus(now),
        ammoPickupLabel: this.getPickupStatus(now),
        healthPickupLabel: this.getHealthPickupStatus(now),
        coverVisionActive: this.activeDummyCoverIndex !== null && this.getCoverEffectId(this.activeDummyCoverIndex) === "vision-jam",
        coverVisionX: coverVision.x,
        coverVisionY: coverVision.y,
        coverVisionRadius: coverVision.radius
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

  private getHudCoverVisionState(): { x: number; y: number; radius: number } {
    const designWidth = Number(this.scale.gameSize.width) || 960;
    const designHeight = Number(this.scale.gameSize.height) || 540;
    const displayWidth = this.scale.displaySize.width > 0 ? this.scale.displaySize.width : designWidth;
    const displayHeight = this.scale.displaySize.height > 0 ? this.scale.displaySize.height : designHeight;
    const widthRatio = displayWidth / designWidth;
    const heightRatio = displayHeight / designHeight;
    const radiusRatio = Math.min(widthRatio, heightRatio);

    return {
      x: this.playerSprite.x * widthRatio,
      y: this.playerSprite.y * heightRatio,
      radius: Math.max(10, MainScene.COVER_VISION_RADIUS * radiusRatio)
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

    for (const slot of this.weaponSlots) {
      slot.logic.restockAllAmmo(now);
    }
    this.playerUnlimitedAmmoUntilMs = now + MainScene.AMMO_OVERDRIVE_MS;

    this.ammoPickup.available = false;
    this.ammoPickup.respawnAtMs = now + this.gameBalance.ammoPickupRespawnMs;
    this.ammoPickup.sprite.setVisible(false);
    this.ammoPickup.label.setVisible(false);
    this.spawnImpactEffect(this.playerSprite.x, this.playerSprite.y, "pickup-ammo");
    this.spawnImpactEffect(this.ammoPickup.sprite.x, this.ammoPickup.sprite.y, "pickup-ammo");
    this.lastCombatEvent = "AMMO OVERDRIVE";
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
      return;
    }

    this.healthPickup.available = false;
    this.healthPickup.respawnAtMs = now + this.gameBalance.healthPickupRespawnMs;
    this.healthPickup.sprite.setVisible(false);
    this.healthPickup.label.setVisible(false);
    this.spawnImpactEffect(this.playerSprite.x, this.playerSprite.y, "pickup-health");
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
    for (const slot of this.dummyWeaponSlots) {
      slot.logic.reset();
    }
    this.currentDummyWeaponId = "carbine";
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
    this.lastDummyIntentKey = "chase:false";
    this.lastActiveWeaponReloading = false;
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

    for (const trail of this.shotTrails) {
      trail.line.destroy();
    }

    this.shotTrails.length = 0;
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

  private getActiveDummyWeaponSlot(): PlayerWeaponSlot {
    const distanceToPlayer = Phaser.Math.Distance.Between(
      this.targetDummy.x,
      this.targetDummy.y,
      this.playerSprite.x,
      this.playerSprite.y
    );
    const preferredWeaponId = distanceToPlayer <= 164 ? "scatter" : "carbine";
    return this.dummyWeaponSlots.find((slot) => slot.id === preferredWeaponId) ?? this.dummyWeaponSlots[0];
  }

  private getImpactProfile(weaponId: string): ImpactProfile {
    if (weaponId === "scatter" || weaponId === "bazooka" || weaponId === "grenade" || weaponId === "sniper" || weaponId === "airStrike") {
      return weaponId;
    }

    return "carbine";
  }

  private getActiveObstacles(): ObstacleView[] {
    if (this.gate === undefined) {
      return this.obstacles;
    }

    return this.obstacles.filter((obstacle) => obstacle !== this.gate || !this.gate.open);
  }

  private getPickupStatus(now: number): string {
    if (this.isAmmoOverdriveActive(now)) {
      return `LIVE ${Math.ceil((this.playerUnlimitedAmmoUntilMs - now) / 1000)}S`;
    }

    if (this.ammoPickup.available) {
      return "READY";
    }

    if (this.ammoPickup.respawnAtMs === null) {
      return "OFF";
    }

    return Math.max(0, this.ammoPickup.respawnAtMs - now).toFixed(0);
  }

  private isAmmoOverdriveActive(now: number): boolean {
    return now < this.playerUnlimitedAmmoUntilMs;
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

  private createArenaPropTextures(): void {
    this.createObstacleTexture(MainScene.OBSTACLE_CORE_KEY, 96, 96, 0xe6b35f, 0x8c5a21, 0xfff0ca);
    this.createObstacleTexture(MainScene.OBSTACLE_TOWER_KEY, 96, 160, 0x5bb3d8, 0x214f7a, 0xd7f2ff);
    this.createObstacleTexture(MainScene.OBSTACLE_BARRIER_KEY, 160, 64, 0x72cb8a, 0x2d6b42, 0xe0ffe8);
    this.createGateTexture();
    this.createVentTexture();
    this.createPickupTexture(MainScene.PICKUP_AMMO_KEY, 0x6ce5ff, 0xd9f9ff, "A");
    this.createPickupTexture(MainScene.PICKUP_HEALTH_KEY, 0x7cff9e, 0xeafff0, "+");
  }

  private createObstacleTexture(
    textureKey: string,
    width: number,
    height: number,
    fillColor: number,
    shadowColor: number,
    highlightColor: number
  ): void {
    if (this.textures.exists(textureKey)) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0);
    graphics.fillRect(0, 0, width, height);
    graphics.fillStyle(shadowColor, 0.94);
    graphics.fillRoundedRect(4, 6, width - 8, height - 10, 10);
    graphics.fillStyle(fillColor, 0.96);
    graphics.fillRoundedRect(6, 4, width - 12, height - 12, 10);
    graphics.fillStyle(highlightColor, 0.78);
    graphics.fillRoundedRect(12, 10, width - 24, Math.max(8, Math.floor(height * 0.16)), 6);
    graphics.lineStyle(3, 0xffffff, 0.18);
    graphics.strokeRoundedRect(6, 4, width - 12, height - 12, 10);
    graphics.generateTexture(textureKey, width, height);
    graphics.destroy();
  }

  private createGateTexture(): void {
    if (this.textures.exists(MainScene.GATE_PANEL_KEY)) {
      return;
    }

    const width = 128;
    const height = 48;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0);
    graphics.fillRect(0, 0, width, height);
    graphics.fillStyle(0x65462d, 0.94);
    graphics.fillRoundedRect(4, 6, width - 8, height - 10, 8);
    graphics.fillStyle(0xd59a47, 0.96);
    graphics.fillRoundedRect(6, 4, width - 12, height - 12, 8);
    graphics.fillStyle(0xffe3a0, 0.7);
    graphics.fillRect(14, 12, width - 28, 6);
    graphics.lineStyle(3, 0xffffff, 0.18);
    graphics.strokeRoundedRect(6, 4, width - 12, height - 12, 8);
    graphics.generateTexture(MainScene.GATE_PANEL_KEY, width, height);
    graphics.destroy();
  }

  private createVentTexture(): void {
    if (this.textures.exists(MainScene.VENT_PANEL_KEY)) {
      return;
    }

    const width = 192;
    const height = 64;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0);
    graphics.fillRect(0, 0, width, height);
    graphics.fillStyle(0x6f2f94, 0.92);
    graphics.fillRoundedRect(6, 6, width - 12, height - 12, 10);
    graphics.fillStyle(0xc34cff, 0.28);
    graphics.fillRoundedRect(10, 10, width - 20, height - 20, 8);
    graphics.lineStyle(2, 0xffffff, 0.2);
    for (let x = 18; x < width - 18; x += 18) {
      graphics.lineBetween(x, 16, x, height - 16);
    }
    graphics.generateTexture(MainScene.VENT_PANEL_KEY, width, height);
    graphics.destroy();
  }

  private createPickupTexture(textureKey: string, fillColor: number, highlightColor: number, glyph: string): void {
    if (this.textures.exists(textureKey)) {
      return;
    }

    const size = 48;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0);
    graphics.fillRect(0, 0, size, size);
    graphics.fillStyle(0x12202a, 0.4);
    graphics.fillCircle(size / 2, size / 2 + 3, 17);
    graphics.fillStyle(fillColor, 1);
    graphics.fillCircle(size / 2, size / 2, 16);
    graphics.fillStyle(highlightColor, 0.86);
    graphics.fillCircle(size / 2 - 5, size / 2 - 5, 6);
    graphics.lineStyle(2, 0xffffff, 0.24);
    graphics.strokeCircle(size / 2, size / 2, 16);
    graphics.lineStyle(3, 0x0c1520, 0.72);

    if (glyph === "+") {
      graphics.lineBetween(size / 2, 13, size / 2, size - 13);
      graphics.lineBetween(13, size / 2, size - 13, size / 2);
    } else {
      graphics.lineBetween(size / 2, 13, size / 2, size - 13);
      graphics.lineBetween(size / 2, 13, size - 15, size / 2);
    }

    graphics.generateTexture(textureKey, size, size);
    graphics.destroy();
  }

  private addArenaBackdrop(): void {
    const playfieldWidth = MainScene.PLAYFIELD_MAX_X - MainScene.PLAYFIELD_MIN_X;
    const playfieldHeight = MainScene.PLAYFIELD_MAX_Y - MainScene.PLAYFIELD_MIN_Y;
    const playfieldCenterX = (MainScene.PLAYFIELD_MIN_X + MainScene.PLAYFIELD_MAX_X) * 0.5;
    const playfieldCenterY = (MainScene.PLAYFIELD_MIN_Y + MainScene.PLAYFIELD_MAX_Y) * 0.5;

    this.add.rectangle(480, 270, 960, 540, 0x0a121b, 0.02).setDepth(-2);
    this.addTerrainSurface(
      playfieldCenterX,
      playfieldCenterY,
      playfieldWidth,
      playfieldHeight,
      { x: 0, y: 0, width: 896, height: 640 },
      0.94,
      -1
    );
    this.add.rectangle(playfieldCenterX, playfieldCenterY, playfieldWidth, playfieldHeight, 0x10273a, 0.035).setDepth(0);
    this.add.rectangle(playfieldCenterX, playfieldCenterY, playfieldWidth, playfieldHeight, 0x234f85, 0).setStrokeStyle(2, 0xa7ddff, 0.42).setDepth(1);
  }

  private addTerrainSurface(
    x: number,
    y: number,
    width: number,
    height: number,
    crop: TerrainCrop,
    alpha: number,
    depth: number
  ): Phaser.GameObjects.Image {
    return this.add
      .image(x, y, MainScene.GROUND_TERRAIN_KEY)
      .setCrop(crop.x, crop.y, crop.width, crop.height)
      .setDisplaySize(width, height)
      .setAlpha(alpha)
      .setDepth(depth);
  }

  private addObstacle(x: number, y: number, width: number, height: number, color: number, crop?: TerrainCrop): void {
    const visualKey = width > 140 ? MainScene.OBSTACLE_BARRIER_KEY : height > width ? MainScene.OBSTACLE_TOWER_KEY : MainScene.OBSTACLE_CORE_KEY;
    this.add.rectangle(x + 6, y + 8, width, height, 0x0c1420, 0.26).setDepth(2);
    if (crop !== undefined) {
      this.addTerrainSurface(x, y, width, height, crop, 0.92, 2);
    }
    this.add.image(x, y, visualKey).setDisplaySize(width, height).setDepth(3).setAlpha(0.96);
    const sprite = this.add
      .rectangle(x, y, width, height, color, crop === undefined ? 0.14 : 0.08)
      .setStrokeStyle(3, 0xffffff, crop === undefined ? 0.18 : 0.12)
      .setDepth(4);
    this.obstacles.push({
      sprite,
      bounds: createCenteredRect(x, y, width, height)
    });
  }

  private addGate(x: number, y: number, width: number, height: number, color: number, crop?: TerrainCrop): GateView {
    this.add.rectangle(x + 5, y + 6, width, height, 0x0c1420, 0.22).setDepth(2);
    if (crop !== undefined) {
      this.addTerrainSurface(x, y, width, height, crop, 0.9, 2);
    }
    this.add.image(x, y, MainScene.GATE_PANEL_KEY).setDisplaySize(width, height).setDepth(3).setAlpha(0.95);
    const sprite = this.add
      .rectangle(x, y, width, height, color, crop === undefined ? 0.12 : 0.08)
      .setStrokeStyle(3, 0xffffff, crop === undefined ? 0.24 : 0.16)
      .setDepth(4);
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
    this.add.image(x, y, MainScene.VENT_PANEL_KEY).setDisplaySize(width, height).setDepth(2).setAlpha(0.92);
    const sprite = this.add
      .rectangle(x, y, width, height, 0xc34cff, 0.26)
      .setStrokeStyle(3, 0xffffff, 0.42)
      .setDepth(3);

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
      .circle(coverPoint.x, coverPoint.y, this.gameBalance.coverPointRadius, 0x4dc7ff, 0.22)
      .setStrokeStyle(3, 0xffffff, 0.72);
      const label = this.add
        .text(coverPoint.x, coverPoint.y - this.gameBalance.coverPointRadius - 10, "COVER", {
          color: "#e6f7ff",
          fontFamily: "monospace",
          fontSize: "10px"
        })
        .setOrigin(0.5)
        .setAlpha(0.7);

      this.coverPointViews.push({ sprite, label });
    }
  }

  private createPlayerWeaponSlots(gameBalance: GameBalance): PlayerWeaponSlot[] {
    const weapons = (gameBalance.weapons ?? {}) as Record<string, BalanceWeaponConfig>;
    return [
      this.createWeaponSlot("carbine", "Carbine", this.mergeWeaponConfig({
        fireRateMs: gameBalance.fireRateMs,
        bulletSpeed: gameBalance.bulletSpeed,
        damage: gameBalance.bulletDamage,
        magazineSize: gameBalance.magazineSize,
        reloadTimeMs: gameBalance.reloadTimeMs,
        reserveAmmo: gameBalance.reserveAmmo
      }, weapons.carbine), {
        bulletColor: 0xfff27a,
        bulletWidth: 10,
        bulletHeight: 4,
        pelletCount: 1,
        spreadRadians: 0
      }),
      this.createWeaponSlot("scatter", "Scatter", this.mergeWeaponConfig({
        fireRateMs: 620,
        bulletSpeed: gameBalance.bulletSpeed * 0.82,
        damage: 12,
        magazineSize: 2,
        reloadTimeMs: 1450,
        reserveAmmo: 12
      }, weapons.scatter), {
        bulletColor: 0xffb86c,
        bulletWidth: 8,
        bulletHeight: 4,
        pelletCount: 3,
        spreadRadians: Phaser.Math.DegToRad(7)
      }),
      this.createWeaponSlot("bazooka", "Bazooka", this.mergeWeaponConfig({
        fireRateMs: 1250,
        bulletSpeed: gameBalance.bulletSpeed * 0.54,
        damage: 45,
        magazineSize: 1,
        reloadTimeMs: 1700,
        reserveAmmo: 5
      }, weapons.bazooka), {
        bulletColor: 0xff8f3f,
        bulletWidth: 16,
        bulletHeight: 8,
        pelletCount: 1,
        spreadRadians: 0
      }),
      this.createWeaponSlot("grenade", "Grenade", this.mergeWeaponConfig({
        fireRateMs: 1100,
        bulletSpeed: gameBalance.bulletSpeed * 0.66,
        damage: 35,
        magazineSize: 1,
        reloadTimeMs: 1500,
        reserveAmmo: 6
      }, weapons.grenade), {
        bulletColor: 0x7cff8a,
        bulletWidth: 12,
        bulletHeight: 12,
        pelletCount: 1,
        spreadRadians: 0
      }),
      this.createWeaponSlot("sniper", "Sniper", this.mergeWeaponConfig({
        fireRateMs: 2000,
        bulletSpeed: 0,
        damage: 55,
        magazineSize: 1,
        reloadTimeMs: 1900,
        reserveAmmo: 8
      }, weapons.sniper), {
        bulletColor: 0xdff8ff,
        bulletWidth: 14,
        bulletHeight: 3,
        pelletCount: 1,
        spreadRadians: 0
      }),
      this.createWeaponSlot("airStrike", "Air Strike", this.mergeWeaponConfig({
        fireRateMs: 15000,
        bulletSpeed: 0,
        damage: 30,
        magazineSize: 1,
        reloadTimeMs: 0,
        reserveAmmo: 3
      }, weapons.airStrike), {
        bulletColor: 0xfff06a,
        bulletWidth: 18,
        bulletHeight: 18,
        pelletCount: 1,
        spreadRadians: 0
      })
    ];
  }

  private createDummyWeaponSlots(gameBalance: GameBalance): PlayerWeaponSlot[] {
    return [
      this.createWeaponSlot("carbine", "Dummy Carbine", {
        fireRateMs: 900,
        bulletSpeed: gameBalance.bulletSpeed * 0.75,
        damage: 12,
        magazineSize: 99,
        reloadTimeMs: 1,
        reserveAmmo: 999
      }, {
        bulletColor: 0xff8b8b,
        bulletWidth: 10,
        bulletHeight: 4,
        pelletCount: 1,
        spreadRadians: 0
      }, {
        trajectory: "linear",
        speed: gameBalance.bulletSpeed * 0.75
      }),
      this.createWeaponSlot("scatter", "Dummy Scatter", {
        fireRateMs: 1100,
        bulletSpeed: gameBalance.bulletSpeed * 0.68,
        damage: 8,
        magazineSize: 99,
        reloadTimeMs: 1,
        reserveAmmo: 999
      }, {
        bulletColor: 0xffaf73,
        bulletWidth: 8,
        bulletHeight: 4,
        pelletCount: 3,
        spreadRadians: Phaser.Math.DegToRad(8)
      }, {
        trajectory: "linear",
        speed: gameBalance.bulletSpeed * 0.68
      })
    ];
  }

  private mergeWeaponConfig(defaultConfig: WeaponConfig, balanceConfig: BalanceWeaponConfig | undefined): WeaponConfig {
    return {
      ...defaultConfig,
      ...balanceConfig,
      bulletSpeed: balanceConfig?.bulletSpeed ?? balanceConfig?.projectile?.speed ?? defaultConfig.bulletSpeed
    };
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
    },
    projectileConfig: ProjectileConfig = {
      trajectory: "linear",
      speed: config.bulletSpeed
    }
  ): PlayerWeaponSlot {
    return {
      id,
      label,
      logic: new WeaponLogic(config),
      projectileConfig: config.projectile ?? projectileConfig,
      ...view
    };
  }

  private createActorSkins(): void {
    this.createActorTexture("skin-player-blue", {
      bodyColor: 0x4ec9ff,
      headColor: 0xffffff,
      accentColor: 0x1d6cb5,
      weaponColor: 0xffcf4c
    });
    this.createActorTexture("skin-player-red", {
      bodyColor: 0xff6d7a,
      headColor: 0xfff3f3,
      accentColor: 0xbe3348,
      weaponColor: 0xffbf54
    });
    this.createActorTexture("skin-dummy-blue", {
      bodyColor: 0x70d8ff,
      headColor: 0xf8fdff,
      accentColor: 0x1b6eb1,
      weaponColor: 0xffd464
    });
    this.createActorTexture("skin-dummy-red", {
      bodyColor: 0xff7a6d,
      headColor: 0xfff2f2,
      accentColor: 0xc14431,
      weaponColor: 0xffd464
    });
  }

  private createActorImage(actor: "player" | "dummy", x: number, y: number): Phaser.GameObjects.Image {
    const textureKey = actor === "player" ? MainScene.GROUND_BODY_BLUE_KEY : MainScene.GROUND_BODY_RED_KEY;
    return this.add.image(x, y, textureKey).setDepth(5).setScale(MainScene.ACTOR_BODY_SCALE);
  }

  private createTurretAnimations(): void {
    this.ensureTurretAnimation(MainScene.GROUND_TURRET_CARBINE_BLUE_KEY, MainScene.CARBINE_TURRET_FRAMES, 18);
    this.ensureTurretAnimation(MainScene.GROUND_TURRET_CARBINE_RED_KEY, MainScene.CARBINE_TURRET_FRAMES, 18);
    this.ensureTurretAnimation(MainScene.GROUND_TURRET_SCATTER_BLUE_KEY, MainScene.SCATTER_TURRET_FRAMES, 22);
    this.ensureTurretAnimation(MainScene.GROUND_TURRET_SCATTER_RED_KEY, MainScene.SCATTER_TURRET_FRAMES, 22);
  }

  private ensureTurretAnimation(textureKey: string, frameCount: number, frameRate: number): void {
    const animationKey = this.getTurretAnimationKey(textureKey);

    if (this.anims.exists(animationKey)) {
      return;
    }

    this.anims.create({
      key: animationKey,
      frames: this.anims.generateFrameNumbers(textureKey, {
        start: 0,
        end: frameCount - 1
      }),
      frameRate,
      repeat: 0
    });
  }

  private applyTeamVisuals(playerTeam: TeamId, dummyTeam: TeamId): void {
    this.currentPlayerTeam = playerTeam;
    this.currentDummyTeam = dummyTeam;

    if (this.playerSprite !== undefined) {
      this.playerSprite.setTexture(playerTeam === "BLUE" ? MainScene.GROUND_BODY_BLUE_KEY : MainScene.GROUND_BODY_RED_KEY);
    }

    if (this.targetDummy !== undefined) {
      this.targetDummy.setTexture(dummyTeam === "BLUE" ? MainScene.GROUND_BODY_BLUE_KEY : MainScene.GROUND_BODY_RED_KEY);
    }
  }

  private getWeaponTurretTexture(team: TeamId, weaponId: string): string {
    const isScatter = weaponId === "scatter";
    if (team === "RED") {
      return isScatter ? MainScene.GROUND_TURRET_SCATTER_RED_KEY : MainScene.GROUND_TURRET_CARBINE_RED_KEY;
    }
    return isScatter ? MainScene.GROUND_TURRET_SCATTER_BLUE_KEY : MainScene.GROUND_TURRET_CARBINE_BLUE_KEY;
  }

  private getActorRotation(angleRadians: number): number {
    return angleRadians + MainScene.ACTOR_ROTATION_OFFSET;
  }

  private getActorCollisionBounds(centerX: number, centerY: number) {
    return createCenteredRect(centerX, centerY, MainScene.ACTOR_COLLIDER_WIDTH, MainScene.ACTOR_COLLIDER_HEIGHT);
  }

  private getTurretAnimationKey(textureKey: string): string {
    return `${textureKey}-fire`;
  }

  private playTurretFireAnimation(sprite: Phaser.GameObjects.Sprite, textureKey: string): void {
    const animationKey = this.getTurretAnimationKey(textureKey);

    if (sprite.texture.key !== textureKey) {
      sprite.setTexture(textureKey, 0);
    }

    sprite.play(animationKey, true);
  }

  private updateDummyBodyAngle(moveX: number, moveY: number, deltaSeconds: number): void {
    if (moveX === 0 && moveY === 0) {
      return;
    }

    const desiredMoveAngle = Math.atan2(moveY, moveX);
    this.dummyBodyAngle = this.rotateAngleTowards(
      this.dummyBodyAngle,
      this.resolveHullAngle(this.dummyBodyAngle, desiredMoveAngle),
      MainScene.BODY_TURN_RATE * deltaSeconds
    );
  }

  private resolveHullAngle(currentHullAngle: number, desiredMoveAngle: number): number {
    const forwardDelta = Phaser.Math.Angle.Wrap(desiredMoveAngle - currentHullAngle);
    if (Math.abs(forwardDelta) <= Math.PI / 2) {
      return desiredMoveAngle;
    }

    return Phaser.Math.Angle.Wrap(desiredMoveAngle + Math.PI);
  }

  private rotateAngleTowards(current: number, target: number, maxStep: number): number {
    const delta = Phaser.Math.Angle.Wrap(target - current);

    if (Math.abs(delta) <= maxStep) {
      return target;
    }

    return current + Math.sign(delta) * maxStep;
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

    const isDummy = textureKey.includes("dummy");
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0);
    graphics.fillRect(0, 0, 48, 48);
    graphics.fillStyle(0x102030, 0.28);
    graphics.fillEllipse(24, 33, 26, 14);
    graphics.fillStyle(palette.accentColor, 1);
    graphics.fillCircle(24, 24, 17);
    graphics.lineStyle(3, 0xffffff, 0.95);
    graphics.strokeCircle(24, 24, 17);
    graphics.fillStyle(palette.bodyColor, 1);

    if (isDummy) {
      graphics.fillRoundedRect(13, 13, 22, 22, 8);
      graphics.fillStyle(palette.headColor, 1);
      graphics.fillCircle(24, 24, 7);
      graphics.fillStyle(palette.weaponColor, 1);
      graphics.fillRoundedRect(24, 21, 15, 6, 3);
      graphics.lineStyle(2, 0x203040, 0.45);
      graphics.strokeRoundedRect(13, 13, 22, 22, 8);
    } else {
      graphics.fillTriangle(11, 14, 11, 34, 34, 24);
      graphics.fillStyle(palette.headColor, 1);
      graphics.fillCircle(20, 24, 6);
      graphics.fillStyle(palette.weaponColor, 1);
      graphics.fillRoundedRect(29, 21, 12, 6, 3);
      graphics.lineStyle(2, 0x203040, 0.45);
      graphics.strokeTriangle(11, 14, 11, 34, 34, 24);
    }

    graphics.generateTexture(textureKey, 48, 48);
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
    const attemptedBounds = this.getActorCollisionBounds(centerX, centerY);

    const isPlayer = actorLogic === this.playerLogic;

    if (!this.getActiveObstacles().some((obstacle) => intersectsRect(attemptedBounds, obstacle.bounds))) {
      if (isPlayer) { this.playerConsecutiveBlockedFrames = 0; } else { this.dummyConsecutiveBlockedFrames = 0; }
      return {
        blocked: false,
        centerX,
        centerY
      };
    }

    const xOnlyBounds = this.getActorCollisionBounds(centerX, previousY + MainScene.ACTOR_HALF_SIZE);
    const yOnlyBounds = this.getActorCollisionBounds(previousX + MainScene.ACTOR_HALF_SIZE, centerY);
    const canKeepX = !this.getActiveObstacles().some((obstacle) => intersectsRect(xOnlyBounds, obstacle.bounds));
    const canKeepY = !this.getActiveObstacles().some((obstacle) => intersectsRect(yOnlyBounds, obstacle.bounds));

    if (canKeepX) {
      actorLogic.state.positionX = centerX - MainScene.ACTOR_HALF_SIZE;
      actorLogic.state.positionY = previousY;
      if (isPlayer) { this.playerConsecutiveBlockedFrames = 0; } else { this.dummyConsecutiveBlockedFrames = 0; }
      return {
        blocked: false,
        centerX,
        centerY: previousY + MainScene.ACTOR_HALF_SIZE
      };
    }

    if (canKeepY) {
      actorLogic.state.positionX = previousX;
      actorLogic.state.positionY = centerY - MainScene.ACTOR_HALF_SIZE;
      if (isPlayer) { this.playerConsecutiveBlockedFrames = 0; } else { this.dummyConsecutiveBlockedFrames = 0; }
      return {
        blocked: false,
        centerX: previousX + MainScene.ACTOR_HALF_SIZE,
        centerY
      };
    }

    const overlapResolution = this.resolveObstacleOverlap(attemptedBounds);

    if (overlapResolution !== null) {
      actorLogic.state.positionX = overlapResolution.centerX - MainScene.ACTOR_HALF_SIZE;
      actorLogic.state.positionY = overlapResolution.centerY - MainScene.ACTOR_HALF_SIZE;
      if (isPlayer) { this.playerConsecutiveBlockedFrames = 0; } else { this.dummyConsecutiveBlockedFrames = 0; }
      return {
        blocked: false,
        centerX: overlapResolution.centerX,
        centerY: overlapResolution.centerY
      };
    }

    // Increment blocked frame counter
    if (isPlayer) { this.playerConsecutiveBlockedFrames++; } else { this.dummyConsecutiveBlockedFrames++; }
    const blockedFrames = isPlayer ? this.playerConsecutiveBlockedFrames : this.dummyConsecutiveBlockedFrames;

    // Safety spiral escape: if stuck for too many consecutive frames, scan outward for a valid position
    if (blockedFrames > MainScene.STUCK_ESCAPE_THRESHOLD) {
      const escapePrevCenterX = previousX + MainScene.ACTOR_HALF_SIZE;
      const escapePrevCenterY = previousY + MainScene.ACTOR_HALF_SIZE;
      const spiralResult = this.findSpiralEscapePosition(escapePrevCenterX, escapePrevCenterY);

      if (spiralResult !== null) {
        actorLogic.state.positionX = spiralResult.centerX - MainScene.ACTOR_HALF_SIZE;
        actorLogic.state.positionY = spiralResult.centerY - MainScene.ACTOR_HALF_SIZE;
        if (isPlayer) { this.playerConsecutiveBlockedFrames = 0; } else { this.dummyConsecutiveBlockedFrames = 0; }
        return {
          blocked: false,
          centerX: spiralResult.centerX,
          centerY: spiralResult.centerY
        };
      }
    }

    actorLogic.state.positionX = previousX;
    actorLogic.state.positionY = previousY;

    if (isPlayer) {
      this.lastCombatEvent = "MOVE BLOCKED";
    }

    return {
      blocked: true,
      centerX: previousX + MainScene.ACTOR_HALF_SIZE,
      centerY: previousY + MainScene.ACTOR_HALF_SIZE
    };
  }

  private resolveObstacleOverlap(targetBounds: Rect): { centerX: number; centerY: number } | null {
    const overlappingObstacles = this.getActiveObstacles().filter((obstacle) => intersectsRect(targetBounds, obstacle.bounds));

    if (overlappingObstacles.length === 0) {
      return null;
    }

    const targetCenterX = targetBounds.x + targetBounds.width / 2;
    const targetCenterY = targetBounds.y + targetBounds.height / 2;
    let bestCandidate: { centerX: number; centerY: number; translation: number } | null = null;

    for (const obstacle of overlappingObstacles) {
      const bounds = obstacle.bounds;
      const leftPush = bounds.x - (targetBounds.x + targetBounds.width) - MainScene.OBSTACLE_CONTACT_EPSILON;
      const rightPush = bounds.x + bounds.width - targetBounds.x + MainScene.OBSTACLE_CONTACT_EPSILON;
      const topPush = bounds.y - (targetBounds.y + targetBounds.height) - MainScene.OBSTACLE_CONTACT_EPSILON;
      const bottomPush = bounds.y + bounds.height - targetBounds.y + MainScene.OBSTACLE_CONTACT_EPSILON;

      const translations = [
        { x: leftPush, y: 0 },
        { x: rightPush, y: 0 },
        { x: 0, y: topPush },
        { x: 0, y: bottomPush },
        { x: leftPush, y: topPush },
        { x: rightPush, y: topPush },
        { x: leftPush, y: bottomPush },
        { x: rightPush, y: bottomPush }
      ];

      for (const translation of translations) {
        const candidateCenterX = Phaser.Math.Clamp(
          targetCenterX + translation.x,
          MainScene.PLAYFIELD_MIN_X,
          MainScene.PLAYFIELD_MAX_X
        );
        const candidateCenterY = Phaser.Math.Clamp(
          targetCenterY + translation.y,
          MainScene.PLAYFIELD_MIN_Y,
          MainScene.PLAYFIELD_MAX_Y
        );
        const candidateBounds = this.getActorCollisionBounds(candidateCenterX, candidateCenterY);

        if (this.getActiveObstacles().some((activeObstacle) => intersectsRect(candidateBounds, activeObstacle.bounds))) {
          continue;
        }

        const translationDistance = Math.abs(translation.x) + Math.abs(translation.y);
        if (bestCandidate === null || translationDistance < bestCandidate.translation) {
          bestCandidate = {
            centerX: candidateCenterX,
            centerY: candidateCenterY,
            translation: translationDistance
          };
        }
      }
    }

    if (bestCandidate === null) {
      return null;
    }

    return {
      centerX: bestCandidate.centerX,
      centerY: bestCandidate.centerY
    };
  }

  private findSpiralEscapePosition(originX: number, originY: number): { centerX: number; centerY: number } | null {
    const step = MainScene.SPIRAL_SCAN_STEP_SIZE;
    let x = 0;
    let y = 0;
    let dx = step;
    let dy = 0;
    let segmentLength = 1;
    let segmentPassed = 0;
    let turnsMade = 0;

    for (let i = 0; i < MainScene.SPIRAL_SCAN_MAX_STEPS; i++) {
      x += dx;
      y += dy;
      segmentPassed++;

      const candidateX = Phaser.Math.Clamp(
        originX + x,
        MainScene.PLAYFIELD_MIN_X,
        MainScene.PLAYFIELD_MAX_X
      );
      const candidateY = Phaser.Math.Clamp(
        originY + y,
        MainScene.PLAYFIELD_MIN_Y,
        MainScene.PLAYFIELD_MAX_Y
      );
      const candidateBounds = this.getActorCollisionBounds(candidateX, candidateY);

      if (!this.getActiveObstacles().some((obstacle) => intersectsRect(candidateBounds, obstacle.bounds))) {
        return { centerX: candidateX, centerY: candidateY };
      }

      if (segmentPassed === segmentLength) {
        segmentPassed = 0;
        // Turn 90 degrees counter-clockwise
        const tempDx = dx;
        dx = -dy;
        dy = tempDx;
        turnsMade++;
        if (turnsMade % 2 === 0) {
          segmentLength++;
        }
      }
    }

    return null;
  }

  private resolveStaticActorCenter(
    sprite: Phaser.GameObjects.Image,
    actorLogic: PlayerLogic,
    targetCenterX: number,
    targetCenterY: number
  ): { x: number; y: number } {
    const clampedCenterX = Phaser.Math.Clamp(targetCenterX, MainScene.PLAYFIELD_MIN_X, MainScene.PLAYFIELD_MAX_X);
    const clampedCenterY = Phaser.Math.Clamp(targetCenterY, MainScene.PLAYFIELD_MIN_Y, MainScene.PLAYFIELD_MAX_Y);
    const targetBounds = this.getActorCollisionBounds(clampedCenterX, clampedCenterY);

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
