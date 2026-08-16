import { expect, test, type Page } from "@playwright/test";
import type { HudSnapshot } from "../../src/ui/hud-events";

/**
 * Phase 3 smoke (T9) — closes QA audit gap.
 *
 * Original Phase 3 acceptance covered:
 *   1. Stage rotation across all 3 stages
 *   2. All 6 weapon slots fire
 *   3. Pickup acquisition (ammo / health)
 *   4. Level up via XP / weapon unlock progression
 *   5. Screenshots per stage rotation
 *
 * This file uses the deterministic MainScene debug surface.
 */

interface Phase3Scene {
  getHudSnapshot(): HudSnapshot;
  getDebugSnapshot(): {
    phase: string;
    activeWeapon: string;
    weaponSlot: number;
    ammoInMagazine: number;
    dummyHealth: number;
    lastEvent: string;
  };
  debugGetRuntimeStats(): {
    bullets: number;
    activeAirStrikes: number;
    impactEffects: number;
    shotTrails: number;
    movementEffects: number;
  };
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugSelectWeaponSlot(slotNumber: number): void;
  debugFire(): void;
  debugFireAt(targetX: number, targetY: number): void;
  debugMovePlayerTo(x: number, y: number): void;
  debugDamagePlayer(amount: number): void;
  debugMoveDummyTo(x: number, y: number): void;
  debugSetPlayerAimAngle(angleRadians: number): void;
  debugSetWeather(type: "clear" | "rain" | "fog" | "sandstorm" | "storm"): void;
  debugForceMatchOver(winner: "PLAYER" | "DUMMY"): void;
  debugRegisterPlayerRoundWin(): void;
  stageGeometry: { resetPickupState(): void };
  update(time: number, delta: number): void;
}

const withScene = async <T>(page: Page, action: (scene: Phase3Scene) => T): Promise<T> => {
  return page.evaluate((fnSource: string) => {
    const game = window.__FPS_GAME__;

    if (game === undefined) {
      throw new Error("Missing __FPS_GAME__ test handle.");
    }

    const scene = game.scene.keys.MainScene as unknown as Phase3Scene;
    const fn = eval(fnSource) as (target: Phase3Scene) => T;
    return fn(scene);
  }, `(${action.toString()})`);
};

const readHud = async (page: Page): Promise<HudSnapshot> => {
  return withScene(page, (scene: Phase3Scene) => scene.getHudSnapshot());
};

const waitForSceneReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as { getHudSnapshot?: () => unknown } | undefined;
    return typeof scene?.getHudSnapshot === "function";
  });
};

const stabilizeEnvironment = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as
      | {
          runtimeState?: { currentWind: { angleDegrees: number; strength: number } };
          debugSetWeather?: (type: "clear") => void;
        }
      | undefined;

    if (scene?.runtimeState === undefined || scene.debugSetWeather === undefined) {
      throw new Error("Missing environment debug handles.");
    }

    scene.runtimeState.currentWind = { angleDegrees: 0, strength: 0 };
    scene.debugSetWeather("clear");
  });
};

const enterCombat = async (page: Page): Promise<void> => {
  await withScene(page, (scene: Phase3Scene) => {
    scene.debugEnterStage();
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
  });
  await stabilizeEnvironment(page);
  await expect.poll(async () => (await readHud(page)).phase).toBe("COMBAT LIVE");
};

const advanceMatchAndConfirmNext = async (page: Page): Promise<void> => {
  // Force player to win match, then send the confirm key the scene listens for in
  // handleMatchConfirm. The scene rotates the stage on next-match prep.
  await withScene(page, (scene: Phase3Scene) => scene.debugForceMatchOver("PLAYER"));
  // handleMatchConfirm gates on now >= matchConfirmAtMs; give the scene a few frames.
  await page.waitForTimeout(250);
  await page.locator("canvas").focus();
  // Hold confirm long enough for handleMatchConfirm's isDown branch to trip.
  await page.keyboard.down("Enter");
  await page.waitForTimeout(120);
  await page.keyboard.up("Enter");
  // Scene returns to stage-entry / next match.
  await expect
    .poll(async () => (await readHud(page)).phase, { timeout: 5000 })
    .not.toBe("MATCH OVER");
};

test.setTimeout(60_000);

test("phase 3 smoke — stage rotation, all 6 weapons, pickups, progression", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await waitForSceneReady(page);

  // ---------- 1) All 6 weapons fire ----------
  await enterCombat(page);

  // Park the dummy in a safe spot so debugFireAt has a valid target trajectory.
  await withScene(page, (scene: Phase3Scene) => {
    scene.debugMovePlayerTo(200, 300);
    scene.debugMoveDummyTo(700, 300);
    scene.debugSetPlayerAimAngle(0);
  });

  const firedSlots: Array<{ slot: number; label: string }> = [];
  const slotNumbers = [1, 2, 3, 4, 5, 6] as const;
  for (const slot of slotNumbers) {
    await page.evaluate((targetSlot: number) => {
      const scene = window.__FPS_GAME__!.scene.keys.MainScene as unknown as {
        debugSelectWeaponSlot(n: number): void;
      };
      scene.debugSelectWeaponSlot(targetSlot);
    }, slot);
    const before = await readHud(page);
    await withScene(page, (scene: Phase3Scene) => {
      // Fire in mid-arena so AOE weapons land on the playfield.
      scene.debugFireAt(700, 300);
    });
    const after = await readHud(page);
    firedSlots.push({ slot, label: after.activeWeapon });

    // Either the lastEvent updates to "<weapon> FIRED" or ammo decremented or a
    // bullet/airstrike spawned. Use a soft union assertion to tolerate AOE vs hitscan.
    const stats = await withScene(page, (scene: Phase3Scene) => scene.debugGetRuntimeStats());
    const fired =
      after.lastEvent.includes("FIRED") ||
      after.lastEvent.includes("RELOAD") ||
      after.ammoInMagazine !== before.ammoInMagazine ||
      stats.bullets > 0 ||
      stats.activeAirStrikes > 0 ||
      stats.shotTrails > 0;
    expect.soft(fired, `slot ${slot} (${after.activeWeapon}) should produce a fire event`).toBe(true);
  }
  expect(firedSlots).toHaveLength(6);
  // The active weapon labels across the 6 slots should be distinct.
  const uniqueLabels = new Set(firedSlots.map((entry) => entry.label));
  expect(uniqueLabels.size).toBe(6);

  // ---------- 2) Pickup acquisition (ammo + health) ----------
  // Stage 1 (foundry) seeds health pickup near (870, 430) and ammo pickup near (160, 430).
  // Move the player onto the ammo pickup; lastEvent should reflect the pickup.
  await withScene(page, (scene: Phase3Scene) => {
    // BLUE can spawn close enough to collect ammo before this assertion when the
    // full suite is under load. Reset it while the player is safely off-pickup.
    scene.debugMovePlayerTo(200, 300);
    scene.stageGeometry.resetPickupState();
    scene.debugSelectWeaponSlot(1);
  });
  const beforeAmmo = await readHud(page);
  await withScene(page, (scene: Phase3Scene) => {
    scene.debugForceCombatLive();
    scene.debugMoveDummyTo(820, 120);
    scene.debugMovePlayerTo(160, 430);
    scene.update(0, 100);
  });
  const afterAmmo = await readHud(page);
  const ammoPickupRegistered =
    afterAmmo.lastEvent !== beforeAmmo.lastEvent ||
    afterAmmo.reserveAmmo !== beforeAmmo.reserveAmmo ||
    afterAmmo.ammoPickupLabel !== beforeAmmo.ammoPickupLabel;
  expect.soft(ammoPickupRegistered, "ammo pickup should register a state change").toBe(true);

  // Damage the player so the health pickup has a deterministic measurable effect.
  await withScene(page, (scene: Phase3Scene) => scene.debugDamagePlayer(30));
  const beforeHealth = await readHud(page);
  await withScene(page, (scene: Phase3Scene) => {
    scene.debugMovePlayerTo(870, 430);
    scene.update(0, 100);
  });
  const afterHealth = await readHud(page);
  expect(afterHealth.playerHealth).toBeGreaterThan(beforeHealth.playerHealth);
  expect(afterHealth.healthPickupLabel).not.toBe("READY");

  // ---------- 3) Level up / weapon unlock progression ----------
  // Award round wins — each call funnels through registerPlayerRoundWin → awardKillXp /
  // awardRoundClearXp → ProgressionLogic.addXp. After enough wins the level should rise.
  const beforeProgression = (await readHud(page)).progression;
  for (let i = 0; i < 12; i += 1) {
    await withScene(page, (scene: Phase3Scene) => scene.debugRegisterPlayerRoundWin());
  }
  const afterProgression = (await readHud(page)).progression;
  expect(beforeProgression).toBeDefined();
  expect(afterProgression).toBeDefined();
  expect(afterProgression?.totalXp).toBeGreaterThan(beforeProgression?.totalXp ?? 0);
  expect(afterProgression?.level).toBeGreaterThanOrEqual((beforeProgression?.level ?? 0) + 1);
  // In dev mode every weapon is unlocked from boot (unlockAllWeaponsForDev=true), so
  // newlyUnlockedWeaponIds will not change. We assert the unlock pane still reports the
  // full 6-weapon roster.
  const unlocks = (await readHud(page)).weaponUnlock;
  expect(unlocks).toBeDefined();
  expect(unlocks?.unlockedWeaponIds.length).toBeGreaterThanOrEqual(6);

  // ---------- 4) Stage rotation across all 3 stages + screenshots ----------
  const observedStageIds: string[] = [];
  const recordStage = async (round: number): Promise<void> => {
    const hud = await readHud(page);
    const stageId = hud.areaPreview?.stageId ?? `unknown-${round}`;
    observedStageIds.push(stageId);
    await page.screenshot({
      path: test.info().outputPath(`phase3-smoke-stage${round}.png`),
      fullPage: false
    });
  };

  await recordStage(1);

  // Rotate to the next stage by force-winning the match and confirming.
  await advanceMatchAndConfirmNext(page);
  await enterCombat(page);
  await recordStage(2);

  await advanceMatchAndConfirmNext(page);
  await enterCombat(page);
  await recordStage(3);

  // After rotating through 3 matches we should have visited at least 3 distinct stages
  // (the rotation pool defines foundry / relay-yard / storm-drain).
  const uniqueStages = new Set(observedStageIds.filter((id) => !id.startsWith("unknown-")));
  expect(uniqueStages.size).toBe(3);
});
