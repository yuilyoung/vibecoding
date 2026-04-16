import type { BossWaveRules } from "../domain/round/BossWaveLogic";

export const RESPAWN_DELAY_MS = 1600;
export const RESPAWN_FX_MS = 900;
export const AMMO_OVERDRIVE_MS = 6000;
export const ACTOR_HALF_SIZE = 27;
export const ACTOR_MIN_SEPARATION = 42;
export const ACTOR_COLLIDER_WIDTH = 40;
export const ACTOR_COLLIDER_HEIGHT = 40;
export const COVER_VISION_RADIUS = 10;
export const MAX_BULLETS = 96;
export const MAX_IMPACT_EFFECTS = 72;
export const MAX_SHOT_TRAILS = 72;
export const MAX_MOVEMENT_EFFECTS = 56;
export const MAX_FRAME_DELTA_MS = 50;
export const OBSTACLE_CONTACT_EPSILON = 1.0;
export const ACTOR_BODY_SCALE = 0.42;
export const ACTOR_ROTATION_OFFSET = Math.PI / 2;
export const PLAYER_WEAPON_SCALE = 0.64;
export const DUMMY_WEAPON_SCALE = 0.6;
export const BODY_TURN_RATE = Math.PI * 1.6;
export const TURRET_FRAME_WIDTH = 128;
export const TURRET_FRAME_HEIGHT = 128;
export const CARBINE_TURRET_FRAMES = 8;
export const SCATTER_TURRET_FRAMES = 11;
export const PLAYFIELD_MIN_X = 28;
export const PLAYFIELD_MAX_X = 932;
export const PLAYFIELD_MIN_Y = 24;
export const PLAYFIELD_MAX_Y = 516;
export const WEAPON_MACHINE_KEY = "runtime-weapon-machine";
export const WEAPON_GUN_KEY = "runtime-weapon-gun";
export const GROUND_BODY_BLUE_KEY = "ground-body-blue";
export const GROUND_BODY_RED_KEY = "ground-body-red";
export const GROUND_TERRAIN_KEY = "ground-terrain";
export const GROUND_TURRET_CARBINE_BLUE_KEY = "ground-turret-carbine-blue";
export const GROUND_TURRET_CARBINE_RED_KEY = "ground-turret-carbine-red";
export const GROUND_TURRET_SCATTER_BLUE_KEY = "ground-turret-scatter-blue";
export const GROUND_TURRET_SCATTER_RED_KEY = "ground-turret-scatter-red";
export const OBSTACLE_CORE_KEY = "arena-obstacle-core";
export const OBSTACLE_TOWER_KEY = "arena-obstacle-tower";
export const OBSTACLE_BARRIER_KEY = "arena-obstacle-barrier";
export const GATE_PANEL_KEY = "arena-gate-panel";
export const VENT_PANEL_KEY = "arena-vent-panel";
export const PICKUP_AMMO_KEY = "arena-pickup-ammo";
export const PICKUP_HEALTH_KEY = "arena-pickup-health";
export const UNLOCK_NOTICE_DURATION_MS = 3200;
export const STUCK_ESCAPE_THRESHOLD = 3;
export const SPIRAL_SCAN_MAX_STEPS = 24;
export const SPIRAL_SCAN_STEP_SIZE = 8;

export const DEFAULT_BOSS_WAVE_RULES: BossWaveRules = {
  intervalRounds: 5,
  firstBossRound: 5,
  bossName: "Forge Titan",
  bossHealth: 240,
  bossSpeed: 115,
  rewardExperience: 160,
  rewardUnlockWeaponId: "airStrike",
  rewardLabel: "Titan cache secured",
  spawnLabel: "Boss Drop Zone"
};
