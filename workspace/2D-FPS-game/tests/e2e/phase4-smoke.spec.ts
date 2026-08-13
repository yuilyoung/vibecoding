import { expect, test, type Page } from "@playwright/test";
import type { HudSnapshot } from "../../src/ui/hud-events";
import type { TutorialSignal } from "../../src/domain/tutorial/TutorialOverlayLogic";

interface Phase4Scene {
  getHudSnapshot(): HudSnapshot;
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugForceBossRound(): void;
  debugRegisterPlayerRoundWin(): void;
}

interface Phase4UiHandle {
  advanceTutorial(signal: TutorialSignal): void;
}

const withScene = async <T>(page: Page, action: (scene: Phase4Scene) => T): Promise<T> => {
  return page.evaluate((fnSource: string) => {
    const game = window.__FPS_GAME__;

    if (game === undefined) {
      throw new Error("Missing __FPS_GAME__ test handle.");
    }

    const scene = game.scene.keys.MainScene as unknown as Phase4Scene;
    const fn = eval(fnSource) as (target: Phase4Scene) => T;
    return fn(scene);
  }, `(${action.toString()})`);
};

const readHudSnapshot = async (page: Page): Promise<HudSnapshot> => {
  return withScene(page, (scene: Phase4Scene) => scene.getHudSnapshot());
};

const waitForSceneReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as { getHudSnapshot?: () => unknown } | undefined;
    return typeof scene?.getHudSnapshot === "function";
  });
};

const advanceTutorial = async (page: Page, signal: TutorialSignal): Promise<void> => {
  await page.evaluate((nextSignal) => {
    const ui = window.__FPS_UI__ as Phase4UiHandle | undefined;

    if (ui === undefined) {
      throw new Error("Missing __FPS_UI__ test handle.");
    }

    ui.advanceTutorial(nextSignal);
  }, signal);
};

const enterCombat = async (page: Page): Promise<void> => {
  await withScene(page, (scene: Phase4Scene) => scene.debugEnterStage());
  await withScene(page, (scene: Phase4Scene) => {
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
  });

  await expect.poll(async () => (await readHudSnapshot(page)).phase).toBe("COMBAT LIVE");
};

test("covers Phase 4 settings, tutorial replay, and boss overlay smoke", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await waitForSceneReady(page);

  const tutorial = page.getByTestId("tutorial-overlay");
  await expect(tutorial).toBeVisible();
  await expect(page.locator("#tutorial-title")).toHaveText("Move");

  await advanceTutorial(page, "moved");
  await expect(page.locator("#tutorial-title")).toHaveText("Aim And Fire");

  await page.keyboard.press("Escape");
  const settings = page.getByTestId("settings-panel");
  await expect(settings).toBeVisible();

  const masterVolume = page.getByTestId("settings-master-volume");
  await masterVolume.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "0.35";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator("#settings-master-volume-text")).toHaveText("35%");
  await page.screenshot({ path: test.info().outputPath("settings.png"), fullPage: true });

  await page.getByTestId("settings-replay-tutorial").click();
  await expect(page.locator("#tutorial-title")).toHaveText("Move");
  await page.getByTestId("settings-close").click();
  await expect(settings).toBeHidden();

  const storedMasterVolume = await page.evaluate(() => {
    const rawSettings = window.localStorage.getItem("2d-fps-game:settings");

    if (rawSettings === null) {
      return null;
    }

    const payload = JSON.parse(rawSettings) as { settings?: { masterVolume?: number } };
    return payload.settings?.masterVolume ?? null;
  });
  expect(storedMasterVolume).toBeCloseTo(0.35);

  await enterCombat(page);
  await withScene(page, (scene: Phase4Scene) => scene.debugForceBossRound());
  await expect.poll(async () => (await readHudSnapshot(page)).overlay.title).toBe("BOSS WAVE");
  await expect(page.locator("#banner-title")).toHaveText("BOSS WAVE");
  await expect(page.locator("#banner-subtitle")).toContainText("Forge Titan");
  await page.screenshot({ path: test.info().outputPath("boss.png"), fullPage: true });

  await withScene(page, (scene: Phase4Scene) => scene.debugRegisterPlayerRoundWin());
  await expect.poll(async () => (await readHudSnapshot(page)).lastEvent).toBe("TITAN CACHE SECURED");
  const afterBossHud = await readHudSnapshot(page);
  expect(afterBossHud.weaponUnlock?.newlyUnlockedWeaponIds).toContain("airStrike");
  await page.screenshot({ path: test.info().outputPath("after-boss.png"), fullPage: true });
});
