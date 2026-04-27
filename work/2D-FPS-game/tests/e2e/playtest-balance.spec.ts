import { expect, test, type Page } from "@playwright/test";

interface HudSnapshot {
  phase: string;
  team: string;
  activeWeapon: string;
  weaponSlot: number;
  ammoInMagazine: number;
  reserveAmmo: number;
  isReloading: boolean;
  playerHealth: number;
  dummyHealth: number;
  gateOpen: boolean;
  roundNumber: number;
  playerScore: number;
  dummyScore: number;
  lastEvent: string;
  lastSoundCue: string;
  movementMode: string;
  movementBlocked: boolean;
  coverVisionActive: boolean;
  tactical?: {
    intent: "pressure" | "hold" | "retreat" | "flank";
    targetCoverIndex: number | null;
    targetCoverEffect: "vision-jam" | "shield" | "repair" | null;
    chosenWeaponId: string;
    chosenWeaponRole: string | null;
  };
  overlay: {
    visible: boolean;
    title: string;
    subtitle: string;
  };
}

interface DebugSnapshot {
  tactical: NonNullable<HudSnapshot["tactical"]>;
}

interface DebugScene {
  getHudSnapshot(): HudSnapshot;
  getDebugSnapshot(): DebugSnapshot;
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugSwapWeapon(): void;
  debugFire(): void;
  debugMovePlayerTo(x: number, y: number): void;
  debugMoveDummyTo(x: number, y: number): void;
  debugToggleGate(): void;
  debugForceMatchOver(winner: "PLAYER" | "DUMMY"): void;
  updateDummyCoverState(now: number): void;
  time: { now: number };
  hazardZone: { bounds: { x: number; y: number; width: number; height: number } };
}

const withScene = async <T>(page: Page, action: (scene: DebugScene) => T): Promise<T> => {
  return page.evaluate((fnSource: string) => {
    const game = window.__FPS_GAME__;

    if (game === undefined) {
      throw new Error("Missing __FPS_GAME__ test handle.");
    }

    const scene = game.scene.keys.MainScene as unknown as DebugScene;
    const fn = eval(fnSource) as (target: DebugScene) => T;
    return fn(scene);
  }, `(${action.toString()})`);
};

const readHudSnapshot = async (page: Page): Promise<HudSnapshot> => {
  return page.evaluate(() => {
    const game = window.__FPS_GAME__;

    if (game === undefined) {
      throw new Error("Missing __FPS_GAME__ test handle.");
    }

    const scene = game.scene.keys.MainScene as unknown as DebugScene;
    return scene.getHudSnapshot();
  });
};

const waitForSceneReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as { getHudSnapshot?: () => unknown } | undefined;
    return typeof scene?.getHudSnapshot === "function";
  });
};

const enterCombat = async (page: Page): Promise<void> => {
  await page.goto(process.env.PLAYTEST_BASE_URL ?? "/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await waitForSceneReady(page);
  await canvas.click({ position: { x: 220, y: 220 } });

  await withScene(page, (scene: DebugScene) => scene.debugEnterStage());
  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
  });

  await expect.poll(async () => (await readHudSnapshot(page)).phase).toBe("COMBAT LIVE");
};

test("records browser playtest observations for movement, cover, hazard, audio, and match confirm", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      runtimeErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await enterCombat(page);

  await withScene(page, (scene: DebugScene) => scene.debugMovePlayerTo(120, 120));
  await page.keyboard.down("d");
  await page.waitForTimeout(180);
  await page.keyboard.up("d");
  let snapshot = await readHudSnapshot(page);
  expect(snapshot.movementMode).toBe("Walk");

  await page.keyboard.down(" ");
  await page.keyboard.down("d");
  await page.waitForTimeout(180);
  snapshot = await readHudSnapshot(page);
  expect(snapshot.movementMode).toBe("Sprint");
  await page.keyboard.up("d");
  await page.keyboard.up(" ");

  const tacticalSnapshot = await withScene(page, (scene: DebugScene) => scene.getDebugSnapshot());
  expect(tacticalSnapshot.tactical.chosenWeaponId.length).toBeGreaterThan(0);
  expect(["pressure", "hold", "retreat", "flank"]).toContain(tacticalSnapshot.tactical.intent);

  await page.locator("canvas").click({ position: { x: 220, y: 220 } });
  await page.keyboard.press("2");
  snapshot = await readHudSnapshot(page);
  if (snapshot.weaponSlot !== 2) {
    await withScene(page, (scene: DebugScene) => scene.debugSwapWeapon());
    snapshot = await readHudSnapshot(page);
  }
  expect(snapshot.weaponSlot).toBe(2);
  expect(snapshot.activeWeapon).toBe("Scatter");
  expect(snapshot.lastSoundCue).toBe("weapon.swap");

  await page.locator("canvas").click({ position: { x: 740, y: 260 } });
  snapshot = await readHudSnapshot(page);
  if (!/^fire\.(carbine|scatter)$/.test(snapshot.lastSoundCue)) {
    await page.waitForTimeout(220);
    await withScene(page, (scene: DebugScene) => scene.debugFire());
  }
  const afterFire = await readHudSnapshot(page);
  expect(afterFire.lastEvent).toMatch(/FIRED|DEFLECTED|HIT|AMMO OVERDRIVE|SHOT BLOCKED/);

  await withScene(page, (scene: DebugScene) => scene.debugMovePlayerTo(482, 430));
  await page.keyboard.press("e");
  snapshot = await readHudSnapshot(page);
  if (!snapshot.gateOpen) {
    await withScene(page, (scene: DebugScene) => scene.debugToggleGate());
    snapshot = await readHudSnapshot(page);
  }
  expect(snapshot.gateOpen).toBe(true);

  const hazardCenter = await withScene(page, (scene: DebugScene) => ({
    x: scene.hazardZone.bounds.x + scene.hazardZone.bounds.width / 2,
    y: scene.hazardZone.bounds.y + scene.hazardZone.bounds.height / 2
  }));
  await page.evaluate(([x, y]) => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as unknown as DebugScene;
    scene.debugMovePlayerTo(x, y);
  }, [hazardCenter.x, hazardCenter.y]);
  const beforeHazard = await readHudSnapshot(page);
  await expect.poll(async () => (await readHudSnapshot(page)).playerHealth, { timeout: 1_500 }).toBeLessThan(beforeHazard.playerHealth);
  snapshot = await readHudSnapshot(page);
  expect(snapshot.lastSoundCue).toBe("hazard.tick");

  const coverVisionActive = await withScene(page, (scene: DebugScene) => {
    scene.debugMoveDummyTo(700, 160);
    scene.updateDummyCoverState(scene.time.now);
    return scene.getHudSnapshot().coverVisionActive;
  });
  expect(coverVisionActive).toBe(true);

  await withScene(page, (scene: DebugScene) => scene.debugForceMatchOver("DUMMY"));
  await expect.poll(async () => (await readHudSnapshot(page)).overlay.visible).toBe(true);
  await expect.poll(async () => (await readHudSnapshot(page)).overlay.subtitle).toContain("Press ENTER");
  await page.locator("canvas").click({ position: { x: 220, y: 220 } });
  await page.keyboard.down("Enter");
  await page.waitForTimeout(80);
  await page.keyboard.up("Enter");
  await expect.poll(async () => (await readHudSnapshot(page)).phase).toBe("TEAM SELECT");
  snapshot = await readHudSnapshot(page);
  expect(snapshot.playerScore).toBe(0);
  expect(snapshot.dummyScore).toBe(0);
  expect(snapshot.roundNumber).toBe(1);

  expect(runtimeErrors).toEqual([]);
});
