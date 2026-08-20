import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial", timeout: 120_000 });

type Team = "BLUE" | "RED";
type AnimationState = "idle" | "run" | "fire" | "hit" | "death";

interface AnimatedActorDebugState {
  readonly requestedSkinId: string;
  readonly skinId: string;
  readonly fallbackReason: string | null;
  readonly atlasActive: boolean;
  readonly playerState: AnimationState;
  readonly dummyState: AnimationState;
  readonly playerDirection: string;
  readonly dummyDirection: string;
  readonly playerTextureKey: string | null;
  readonly dummyTextureKey: string | null;
  readonly playerAnimationKey: string | null;
  readonly dummyAnimationKey: string | null;
  readonly playerFrameName: string | number | null;
  readonly dummyFrameName: string | number | null;
  readonly playerWeaponVisible: boolean;
  readonly dummyWeaponVisible: boolean;
  readonly playerWeaponRotation: number | null;
  readonly dummyWeaponRotation: number | null;
  readonly destroyed: boolean;
}

interface AnimatedActorScene {
  time: { now: number };
  visualController: {
    getDebugState(): AnimatedActorDebugState;
    updatePlayerVisuals(now: number): void;
    updateDummyVisuals(now: number): void;
  };
  debugEnterStage(): void;
  debugSelectTeam(team: Team): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugFireAt(targetX: number, targetY: number): void;
  debugDamagePlayer(amount: number): void;
  debugSetPlayerHullAngle(angleRadians: number): void;
  debugRecordActorHit(actor: "player" | "dummy"): void;
  debugClearActorHitFeedback(): void;
  debugHoldPlayerFirePresentation(durationMs?: number): void;
  debugHoldActorHitPresentation(actor: "player" | "dummy", durationMs?: number): void;
  debugRestoreActorHealth(): void;
  debugRefreshActorPresentation(): void;
  getDebugSnapshot(): { phase: string; playerY: number };
}

const readPresentation = (page: Page): Promise<AnimatedActorDebugState> => page.evaluate(() => {
  const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
  if (scene === undefined) throw new Error("Missing MainScene test handle.");
  return scene.visualController.getDebugState();
});

const openGame = async (page: Page, path: string): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(path);
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    return typeof scene?.visualController?.getDebugState === "function";
  });
  return errors;
};

const enterCombat = async (page: Page, team: Team): Promise<void> => {
  await page.evaluate((selectedTeam: Team) => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    if (scene === undefined) throw new Error("Missing MainScene test handle.");
    scene.debugEnterStage();
    scene.debugSelectTeam(selectedTeam);
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
  }, team);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    return scene?.getDebugSnapshot().phase;
  })).toBe("COMBAT LIVE");
};

const expectFrameAdvance = async (
  page: Page,
  actor: "player" | "dummy",
  state: AnimationState
): Promise<void> => {
  const initial = await readPresentation(page);
  const initialFrame = actor === "player" ? initial.playerFrameName : initial.dummyFrameName;
  const samples: Array<{ state: AnimationState; frame: string | number | null }> = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(50);
    const current = await readPresentation(page);
    const currentState = actor === "player" ? current.playerState : current.dummyState;
    const currentFrame = actor === "player" ? current.playerFrameName : current.dummyFrameName;
    samples.push({ state: currentState, frame: currentFrame });
    if (currentState === state && currentFrame !== initialFrame) return;
  }
  throw new Error(`Expected ${actor} ${state} frame to advance from ${String(initialFrame)}; samples=${JSON.stringify(samples)}`);
};

const captureTriggeredFrameAdvance = (
  page: Page,
  trigger: "fire" | "hit" | "death"
): Promise<{
  initial: AnimatedActorDebugState;
  current: AnimatedActorDebugState;
  playerAdvanced: boolean;
  dummyAdvanced: boolean;
}> => page.evaluate(async (requestedTrigger) => {
  const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
  if (scene === undefined) throw new Error("Missing MainScene test handle.");

  if (requestedTrigger === "fire") {
    scene.debugRestoreActorHealth();
    scene.debugClearActorHitFeedback();
    scene.debugFireAt(900, scene.getDebugSnapshot().playerY);
    scene.debugHoldPlayerFirePresentation();
  } else if (requestedTrigger === "hit") {
    scene.debugRestoreActorHealth();
    scene.debugClearActorHitFeedback();
    scene.debugHoldActorHitPresentation("player");
    scene.debugHoldActorHitPresentation("dummy");
  } else {
    scene.debugDamagePlayer(10_000);
  }
  scene.debugRefreshActorPresentation();

  const initial = scene.visualController.getDebugState();
  const initialPlayerFrame = initial.playerFrameName;
  const initialDummyFrame = initial.dummyFrameName;
  const needsDummy = requestedTrigger === "hit";
  const startedAt = performance.now();

  return new Promise((resolve) => {
    const sample = (): void => {
      const current = scene.visualController.getDebugState();
      const playerAdvanced = current.playerState === requestedTrigger &&
        current.playerFrameName !== initialPlayerFrame;
      const dummyAdvanced = !needsDummy || (current.dummyState === requestedTrigger &&
        current.dummyFrameName !== initialDummyFrame);
      if ((playerAdvanced && dummyAdvanced) || performance.now() - startedAt >= 2_000) {
        resolve({ initial, current, playerAdvanced, dummyAdvanced });
        return;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}, trigger);

test("activates the complete Quaternius pair and swaps BLUE/RED atomically", async ({ page }) => {
  const errors = await openGame(page, "/?actorSkin=quaternius-animated");
  await enterCombat(page, "RED");

  await expect.poll(async () => (await readPresentation(page)).playerAnimationKey)
    .toMatch(/^quaternius-animated:red:idle:/);
  const presentation = await readPresentation(page);

  expect(presentation).toMatchObject({
    requestedSkinId: "quaternius-animated",
    skinId: "quaternius-animated",
    fallbackReason: null,
    atlasActive: true,
    playerTextureKey: "actor-animated-red",
    dummyTextureKey: "actor-animated-blue",
    playerWeaponVisible: true,
    dummyWeaponVisible: true,
    destroyed: false
  });
  expect(presentation.playerFrameName).toMatch(/^actor\/red\/idle\//);
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-actor-skin", "quaternius-animated");
  await expect(page.locator("#actor-skin-label")).toHaveText("Vanguard animated infantry");
  expect(errors).toEqual([]);
});

test("advances idle/run/fire/hit/death clips and separates movement from aim", async ({ page }) => {
  const errors = await openGame(page, "/?actorSkin=quaternius-animated");
  await enterCombat(page, "BLUE");

  await expect.poll(async () => (await readPresentation(page)).playerState).toBe("idle");
  await expectFrameAdvance(page, "player", "idle");

  const canvasBounds = await page.locator("canvas").boundingBox();
  const playerY = await page.evaluate(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    if (scene === undefined) throw new Error("Missing MainScene test handle.");
    return scene.getDebugSnapshot().playerY;
  });
  if (canvasBounds === null) throw new Error("Missing canvas bounds.");
  await page.mouse.move(
    canvasBounds.x + canvasBounds.width * (900 / 960),
    canvasBounds.y + canvasBounds.height * (playerY / 540)
  );
  await page.keyboard.down("ArrowLeft");
  await page.evaluate(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    if (scene === undefined) throw new Error("Missing MainScene test handle.");
    scene.debugSetPlayerHullAngle(Math.PI);
    scene.debugRefreshActorPresentation();
  });
  await expect.poll(async () => {
    const current = await readPresentation(page);
    return `${current.playerState}:${current.playerDirection}`;
  }).toBe("run:west");
  await expectFrameAdvance(page, "player", "run");

  const firing = await captureTriggeredFrameAdvance(page, "fire");
  expect(firing.initial).toMatchObject({
    playerState: "fire",
    playerDirection: "east"
  });
  expect(firing.initial.playerWeaponRotation).toBeCloseTo(Math.PI / 2, 1);
  expect(firing.playerAdvanced).toBe(true);
  await expect.poll(async () => {
    const current = await readPresentation(page);
    return `${current.playerState}:${current.playerDirection}`;
  }, { timeout: 3_000 }).toBe("run:west");
  await page.keyboard.up("ArrowLeft");

  const hit = await captureTriggeredFrameAdvance(page, "hit");
  expect(hit.initial).toMatchObject({
    playerState: "hit",
    dummyState: "hit"
  });
  expect(hit.playerAdvanced).toBe(true);
  expect(hit.dummyAdvanced).toBe(true);
  await expect.poll(async () => (await readPresentation(page)).playerState, { timeout: 3_000 }).toBe("idle");

  const death = await captureTriggeredFrameAdvance(page, "death");
  expect(death.initial.playerState).toBe("death");
  expect(death.playerAdvanced).toBe(true);
  expect(errors).toEqual([]);
});

test("falls back both actors when the RED atlas JSON is incomplete", async ({ page }) => {
  await page.route("**/assets/runtime/actors/actor-red.json", async (route) => {
    const response = await route.fetch();
    const atlas = await response.json() as { frames: Record<string, unknown> };
    delete atlas.frames[Object.keys(atlas.frames)[0]];
    await route.fulfill({ response, json: atlas });
  });
  const errors = await openGame(page, "/?actorSkin=quaternius-animated");
  const presentation = await readPresentation(page);

  expect(presentation).toMatchObject({
    requestedSkinId: "quaternius-animated",
    skinId: "legacy-vehicle",
    atlasActive: false,
    playerTextureKey: "ground-body-blue",
    dummyTextureKey: "ground-body-red",
    playerAnimationKey: null,
    dummyAnimationKey: null,
    playerWeaponVisible: true,
    dummyWeaponVisible: true
  });
  expect(presentation.fallbackReason).toContain("RED animated atlas frames are incomplete");
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-actor-skin", "legacy-vehicle");
  await expect(page.locator("#actor-skin-label")).toHaveText("Ground Shaker vehicle");
  expect(errors).toEqual([]);
});

test("cleans up and recreates the animated presentation across scene restarts", async ({ page }) => {
  const errors = await openGame(page, "/?actorSkin=quaternius-animated");

  const stopped = await page.evaluate(() => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    if (game === undefined || scene === undefined) throw new Error("Missing MainScene test handle.");
    const previousController = scene.visualController;
    game.scene.stop("MainScene");
    return previousController.getDebugState();
  });
  expect(stopped).toMatchObject({ destroyed: true, atlasActive: true });

  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    return typeof scene?.visualController?.getDebugState === "function";
  });
  const current = await readPresentation(page);
  expect(current).toMatchObject({
    skinId: "quaternius-animated",
    atlasActive: true,
    destroyed: false
  });

  const stoppedAgain = await page.evaluate(() => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    if (game === undefined || scene === undefined) throw new Error("Missing MainScene test handle.");
    const currentController = scene.visualController;
    game.scene.stop("MainScene");
    return currentController.getDebugState();
  });
  expect(stoppedAgain.destroyed).toBe(true);
  expect(errors).toEqual([]);
});
