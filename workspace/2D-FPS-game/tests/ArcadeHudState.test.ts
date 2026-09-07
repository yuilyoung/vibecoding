import { advanceArcadeHud, createArcadeHudState, getWeaponReadiness } from "../src/ui/arcade-hud-state";
import type { HudSnapshot } from "../src/ui/hud-events";

const snapshot = (overrides: Partial<HudSnapshot> = {}): HudSnapshot => ({
  phase: "COMBAT LIVE", team: "BLUE", spawn: "Foundry", activeWeapon: "Carbine", weaponSlot: 1,
  weaponSlots: [], ammoInMagazine: 6, reserveAmmo: 24, isReloading: false, reloadProgress: 0,
  cooldownRemainingMs: 0, cooldownDurationMs: 180, playerHealth: 100, playerMaxHealth: 100,
  dummyHealth: 100, dummyMaxHealth: 100, gateOpen: false, roundNumber: 1, playerScore: 0,
  dummyScore: 0, scoreToWin: 5, lastEvent: "READY", lastSoundCue: "NONE", movementMode: "Walk",
  movementBlocked: false, roundStartLabel: "LIVE", ammoPickupLabel: "READY", healthPickupLabel: "READY",
  coverVisionActive: false, coverVisionX: 0, coverVisionY: 0, coverVisionRadius: 0,
  overlay: { visible: false, title: "", subtitle: "" }, ...overrides
});
const initial = () => advanceArcadeHud(createArcadeHudState(), snapshot(), 0);

describe("Arcade HUD feedback", () => {
  it("shows damage once and expires without repeated health snapshots extending it", () => {
    const damaged = snapshot({ playerHealth: 70 });
    const state = advanceArcadeHud(initial(), damaged, 100);
    expect(state.notice?.text).toContain("−30 HP");
    expect(state.damageUntil).toBe(460);
    expect(advanceArcadeHud(state, damaged, 900).notice).toEqual(state.notice);
    expect(advanceArcadeHud(state, damaged, 1100).notice).toBeNull();
  });
  it("prioritizes a round win over the finishing hit, without conflating enemy damage with HP damage", () => {
    const hit = advanceArcadeHud(initial(), snapshot({ dummyHealth: 80 }), 50);
    expect(hit.notice?.kind).toBe("hit");
    expect(hit.damageUntil).toBe(0);
    const won = advanceArcadeHud(hit, snapshot({ dummyHealth: 0, playerScore: 1, roundNumber: 2 }), 100);
    expect(won.notice?.kind).toBe("score");
  });
  it("reports recovery and equipment from real snapshot differences", () => {
    const hurt = advanceArcadeHud(initial(), snapshot({ playerHealth: 60 }), 10);
    const healed = advanceArcadeHud(hurt, snapshot({ playerHealth: 90 }), 20);
    expect(healed.notice?.text).toContain("+30 HP");
    expect(advanceArcadeHud(initial(), snapshot({ activeWeapon: "Scatter", weaponSlot: 2 }), 30).notice?.text).toBe("SCATTER EQUIPPED");
  });
  it.each([
    { phase: "STAGE ENTRY" }, { phase: "TEAM SELECT" }, { team: "RED" }, { roundNumber: 2 }
  ])("clears transient damage on lifecycle change %j", (change) => {
    const hurt = advanceArcadeHud(initial(), snapshot({ playerHealth: 70 }), 10);
    expect(advanceArcadeHud(hurt, snapshot({ playerHealth: 70, ...change }), 20)).toMatchObject({ notice: null, damageUntil: 0 });
  });
  it("clears defeat feedback on respawn and score reset", () => {
    const dead = advanceArcadeHud(initial(), snapshot({ playerHealth: 0, dummyScore: 1 }), 10);
    expect(dead.notice?.kind).toBe("defeat");
    expect(advanceArcadeHud(dead, snapshot({ dummyScore: 1 }), 20).notice).toBeNull();
    expect(advanceArcadeHud(dead, snapshot(), 20).notice).toBeNull();
  });
  it("does not announce restored scores when a scene is recreated", () => {
    const shutdown = advanceArcadeHud(initial(), snapshot({ phase: "STAGE ENTRY", team: "UNSET" }), 10);
    expect(advanceArcadeHud(shutdown, snapshot({ playerScore: 1 }), 20).notice).toBeNull();
  });
  it("does not announce healing or an equipment switch for a wounded winner's redeployment", () => {
    const winner = advanceArcadeHud(initial(), snapshot({ playerHealth: 60, playerScore: 1, roundNumber: 2 }), 10);
    expect(advanceArcadeHud(winner, snapshot({ phase: "ROUND START", playerScore: 1, roundNumber: 2 }), 20)).toMatchObject({ notice: null, damageUntil: 0 });
  });
});

describe("weapon readiness", () => {
  it("distinguishes reloading, cooldown, empty magazine, depleted reserve and ready", () => {
    expect(getWeaponReadiness(snapshot({ isReloading: true, reloadProgress: 0.4, ammoInMagazine: 0 }))).toMatchObject({ kind: "reload", progress: 0.4 });
    expect(getWeaponReadiness(snapshot({ cooldownRemainingMs: 90 }))).toMatchObject({ kind: "cooldown", progress: 0.5 });
    expect(getWeaponReadiness(snapshot({ ammoInMagazine: 0 })).label).toContain("R TO RELOAD");
    expect(getWeaponReadiness(snapshot({ ammoInMagazine: 0, reserveAmmo: 0 })).label).toContain("FIND PICKUP");
    expect(getWeaponReadiness(snapshot())).toMatchObject({ kind: "ready", progress: 1 });
  });
});
