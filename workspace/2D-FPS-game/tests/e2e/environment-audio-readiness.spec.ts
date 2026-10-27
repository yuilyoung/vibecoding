import { expect, test } from "@playwright/test";
import { runtimeRoute } from "./runtime-route";

interface EnvironmentScene {
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  getHudSnapshot(): {
    areaPreview?: { stageId: string };
    weather?: { type: string; movementMultiplier: number; windStrengthMultiplier: number };
    audio?: {
      activeAmbientLoopCue: string | null;
      activeWeatherLoopCue: string | null;
      contextState: string;
      ambientLoopScheduled: boolean;
      weatherLoopScheduled: boolean;
      outputVolume: number;
    };
  };
}

test("real UI deployment starts selected map audio and live settings mute its loops", async ({ page }) => {
  await page.goto(runtimeRoute("/?stage=neon-city&weather=storm"));
  await page.waitForFunction(() => typeof (window.__FPS_GAME__?.scene.keys.MainScene as EnvironmentScene | undefined)?.getHudSnapshot === "function");
  await expect(page.getByTestId("primary-play")).toBeEnabled();

  await page.getByTestId("primary-play").click();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as EnvironmentScene | undefined;
    const audio = scene?.getHudSnapshot().audio;
    return audio?.activeAmbientLoopCue === "ambient.neon-city" && audio.contextState === "running";
  });

  const snapshot = await page.evaluate(() => {
    const scene = window.__FPS_GAME__!.scene.keys.MainScene as unknown as EnvironmentScene;
    return scene.getHudSnapshot();
  });

  expect(snapshot.areaPreview?.stageId).toBe("neon-city");
  expect(snapshot.weather).toMatchObject({ type: "storm", movementMultiplier: 0.9, windStrengthMultiplier: 1 });
  expect(snapshot.audio).toMatchObject({
    activeAmbientLoopCue: "ambient.neon-city",
    activeWeatherLoopCue: "weather.storm.loop",
    contextState: "running",
    ambientLoopScheduled: true,
    weatherLoopScheduled: true,
    outputVolume: 1
  });
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-weather", "storm");

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByTestId("settings-master-volume").fill("0");
  await expect(page.locator("#settings-master-volume-text")).toHaveText("0%");
  const mutedAudio = await page.evaluate(() => {
    const scene = window.__FPS_GAME__!.scene.keys.MainScene as unknown as EnvironmentScene;
    return scene.getHudSnapshot().audio;
  });
  expect(mutedAudio).toMatchObject({
    activeAmbientLoopCue: "ambient.neon-city",
    activeWeatherLoopCue: "weather.storm.loop",
    ambientLoopScheduled: true,
    weatherLoopScheduled: true,
    outputVolume: 0
  });
});
