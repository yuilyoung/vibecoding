import { expect, test, type Page } from "@playwright/test";
import type { HudSnapshot } from "../../src/ui/hud-events";
import { runtimeRoute } from "./runtime-route";

interface DebugSnapshot {
  phase: string;
  lastEvent: string;
  playerHealth: number;
}

interface SpriteLike {
  x: number;
  y: number;
  setPosition(x: number, y: number): void;
}

interface ActorLogicLike {
  state: {
    positionX: number;
    positionY: number;
  };
}

interface BalanceScene {
  readonly time: { now: number };
  getDebugSnapshot(): DebugSnapshot;
  getHudSnapshot(): HudSnapshot;
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugMovePlayerTo(x: number, y: number): void;
  debugToggleGate(): void;
  clearBullets(): void;
  update(time: number, delta: number): void;
  targetDummy: SpriteLike;
  dummyLogic: ActorLogicLike;
  updateDummyCoverState(now: number): void;
}

const withScene = async <T>(page: Page, action: (scene: BalanceScene) => T): Promise<T> => {
  return page.evaluate((fnSource: string) => {
    const game = window.__FPS_GAME__;

    if (game === undefined) {
      throw new Error("Missing __FPS_GAME__ test handle.");
    }

    const scene = game.scene.keys.MainScene as unknown as BalanceScene;
    const fn = eval(fnSource) as (target: BalanceScene) => T;
    return fn(scene);
  }, `(${action.toString()})`);
};

const readSnapshot = async (page: Page): Promise<DebugSnapshot> => {
  return withScene(page, (scene: BalanceScene) => scene.getDebugSnapshot());
};

const readHudSnapshot = async (page: Page): Promise<HudSnapshot> => {
  return withScene(page, (scene: BalanceScene) => scene.getHudSnapshot());
};

const waitForSceneReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as { getDebugSnapshot?: () => unknown } | undefined;
    return typeof scene?.getDebugSnapshot === "function";
  });
};

const enterCombat = async (page: Page): Promise<void> => {
  await page.goto(runtimeRoute("/", { arcade: "classic" }));
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await waitForSceneReady(page);
  await canvas.click({ position: { x: 220, y: 220 } });

  await withScene(page, (scene: BalanceScene) => scene.debugEnterStage());
  await withScene(page, (scene: BalanceScene) => {
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
  });

  await expect.poll(async () => (await readSnapshot(page)).phase).toBe("COMBAT LIVE");
};

const moveDummyTo = async (page: Page, x: number, y: number): Promise<void> => {
  await page.evaluate(({ targetX, targetY }) => {
    const game = window.__FPS_GAME__;

    if (game === undefined) {
      throw new Error("Missing __FPS_GAME__ test handle.");
    }

    const scene = game.scene.keys.MainScene as unknown as BalanceScene;
    scene.dummyLogic.state.positionX = targetX - 27;
    scene.dummyLogic.state.positionY = targetY - 27;
    scene.targetDummy.setPosition(targetX, targetY);
  }, { targetX: x, targetY: y });
};

test("records cover, hazard, and audio balance signals in a browser session", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await enterCombat(page);
  await moveDummyTo(page, 900, 500);

  await page.keyboard.down("f");
  await expect.poll(async () => (await readHudSnapshot(page)).lastSoundCue).toBe("fire.carbine");
  await page.keyboard.up("f");
  await withScene(page, (scene: BalanceScene) => scene.clearBullets());

  const gateSnapshot = await withScene(page, (scene: BalanceScene) => {
    scene.debugMovePlayerTo(482, 430);
    scene.debugToggleGate();
    return scene.getHudSnapshot();
  });
  expect(gateSnapshot.lastSoundCue).toBe("gate.open");

  await moveDummyTo(page, 900, 500);
  const hazardResult = await page.evaluate(() => {
    const game = window.__FPS_GAME__;
    if (game === undefined) throw new Error("Missing __FPS_GAME__ test handle.");
    const scene = game.scene.keys.MainScene as unknown as BalanceScene;
    game.loop.sleep();
    try {
      scene.debugMovePlayerTo(510, 138);
      const beforeHealth = scene.getDebugSnapshot().playerHealth;
      scene.update(scene.time.now + 16, 16);
      return {
        beforeHealth,
        afterHealth: scene.getDebugSnapshot().playerHealth,
        lastSoundCue: scene.getHudSnapshot().lastSoundCue
      };
    } finally {
      scene.debugMovePlayerTo(120, 90);
      game.loop.wake();
    }
  });

  await moveDummyTo(page, 700, 160);
  await withScene(page, (scene: BalanceScene) => scene.updateDummyCoverState(performance.now()));
  const coverSnapshot = await readHudSnapshot(page);

  expect(pageErrors).toEqual([]);
  expect(hazardResult.afterHealth).toBe(hazardResult.beforeHealth - 7);
  expect(hazardResult.lastSoundCue).toBe("hazard.tick");
  expect(coverSnapshot.coverVisionActive).toBe(true);
  expect(coverSnapshot.coverVisionRadius).toBe(10);
});
