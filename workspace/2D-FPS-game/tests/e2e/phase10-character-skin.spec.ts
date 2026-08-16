import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

type Team = "BLUE" | "RED";
type WeatherType = "clear" | "rain" | "fog" | "sandstorm" | "storm";

interface ActorPresentationDebugState {
  skinId: "legacy-vehicle" | "kenney-infantry";
  weaponLayer: "external" | "embedded";
  playerTextureKey: string | null;
  dummyTextureKey: string | null;
  playerWeaponVisible: boolean;
  dummyWeaponVisible: boolean;
  playerDirection: string;
  dummyDirection: string;
  destroyed: boolean;
}

interface DebugScene {
  visualController: { getDebugState(): ActorPresentationDebugState };
  debugEnterStage(): void;
  debugSelectTeam(team: Team): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugSetWeather(type: WeatherType): void;
  getDebugSnapshot(): { phase: string };
}

const readPresentation = (page: Page): Promise<ActorPresentationDebugState> => page.evaluate(() => {
  const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as DebugScene | undefined;
  if (scene === undefined) throw new Error("Missing MainScene test handle.");
  return scene.visualController.getDebugState();
});

const openGame = async (page: Page, path = "/"): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(path);
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as DebugScene | undefined;
    return typeof scene?.visualController?.getDebugState === "function";
  });
  return errors;
};

const enterCombat = async (page: Page, team: Team): Promise<void> => {
  await page.evaluate((selectedTeam: Team) => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as DebugScene | undefined;
    if (scene === undefined) throw new Error("Missing MainScene test handle.");
    scene.debugEnterStage();
    scene.debugSelectTeam(selectedTeam);
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
  }, team);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as DebugScene | undefined;
    if (scene === undefined) throw new Error("Missing MainScene test handle.");
    return scene.getDebugSnapshot().phase;
  })).toBe("COMBAT LIVE");
};

test("keeps the Ground Shaker vehicle and external weapon layer as the default", async ({ page }) => {
  const errors = await openGame(page);
  const presentation = await readPresentation(page);

  expect(presentation).toMatchObject({
    skinId: "legacy-vehicle",
    weaponLayer: "external",
    playerTextureKey: "ground-body-blue",
    dummyTextureKey: "ground-body-red",
    playerWeaponVisible: true,
    dummyWeaponVisible: true,
    destroyed: false
  });
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-actor-skin", "legacy-vehicle");
  expect(errors).toEqual([]);
});

test("switches the local infantry POC by team and keeps weather presentation active", async ({ page }) => {
  const errors = await openGame(page, "/?actorSkin=kenney-infantry");
  await page.locator("#tutorial-skip").click();
  await enterCombat(page, "RED");
  await page.evaluate(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as DebugScene | undefined;
    if (scene === undefined) throw new Error("Missing MainScene test handle.");
    scene.debugSetWeather("storm");
  });

  const presentation = await readPresentation(page);
  expect(presentation).toMatchObject({
    skinId: "kenney-infantry",
    weaponLayer: "embedded",
    playerTextureKey: "actor-infantry-red",
    dummyTextureKey: "actor-infantry-blue",
    playerWeaponVisible: false,
    dummyWeaponVisible: false,
    destroyed: false
  });
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-actor-skin", "kenney-infantry");
  await expect(page.locator(".enemy-card .identity-copy span")).toHaveText("Kenney infantry contract POC");
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-weather", "storm");
  await page.locator("canvas").screenshot({ path: test.info().outputPath("phase10-infantry-red-storm.png") });
  expect(errors).toEqual([]);
});

test("destroys the scene-lifetime owner on shutdown and recreates it after page restart", async ({ page }) => {
  const errors = await openGame(page, "/?actorSkin=kenney-infantry");

  const stopped = await page.evaluate(() => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as unknown as DebugScene | undefined;
    if (game === undefined || scene === undefined) throw new Error("Missing MainScene test handle.");
    const previousController = scene.visualController;
    game.scene.stop("MainScene");
    return previousController.getDebugState();
  });
  expect(stopped.destroyed).toBe(true);

  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as DebugScene | undefined;
    return typeof scene?.visualController?.getDebugState === "function";
  });

  const current = await readPresentation(page);
  expect(current).toMatchObject({
    skinId: "kenney-infantry",
    playerTextureKey: "actor-infantry-blue",
    dummyTextureKey: "actor-infantry-red",
    playerWeaponVisible: false,
    dummyWeaponVisible: false,
    destroyed: false
  });
  expect(errors).toEqual([]);
});
