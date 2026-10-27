import { expect, test } from "@playwright/test";
import { runtimeRoute } from "./runtime-route";

interface CombatRosterScene {
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugGetCombatRoster(): Array<{ id: string; team: string; controller: string; health: number; alive: boolean }>;
  debugForceCpuFire(actorId: string): boolean;
  debugDamageCombatActor(actorId: string, damage: number): boolean;
  debugResetCombatRound(): void;
  debugGetProjectileOwners(): Array<{ owner: string; ownerId: string; ownerTeam: string }>;
  getHudSnapshot(): { livingEnemyCount?: number; totalEnemyCount?: number; dummyHealth: number; dummyMaxHealth: number; playerScore: number };
}

test("one-versus-three deployment exposes three independently armed CPU actors", async ({ page }) => {
  await page.goto(runtimeRoute("/?enemies=3", { arcade: "cozy" }));
  await page.waitForFunction(() => typeof (window.__FPS_GAME__?.scene.keys.MainScene as CombatRosterScene | undefined)?.debugGetCombatRoster === "function");

  const result = await page.evaluate(() => {
    const scene = window.__FPS_GAME__!.scene.keys.MainScene as unknown as CombatRosterScene;
    scene.debugEnterStage();
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
    const fired = scene.debugForceCpuFire("cpu-2");
    return {
      roster: scene.debugGetCombatRoster(),
      hud: scene.getHudSnapshot(),
      fired,
      projectiles: scene.debugGetProjectileOwners()
    };
  });

  expect(result.roster.filter((actor) => actor.team === "RED")).toHaveLength(3);
  expect(result.roster.filter((actor) => actor.controller === "cpu" && actor.alive)).toHaveLength(3);
  expect(result.hud).toMatchObject({ livingEnemyCount: 3, totalEnemyCount: 3 });
  expect(result.hud.dummyHealth).toBe(result.hud.dummyMaxHealth);
  expect(result.fired).toBe(true);
  expect(result.projectiles).toContainEqual({ owner: "dummy", ownerId: "cpu-2", ownerTeam: "RED" });

  const elimination = await page.evaluate(() => {
    const scene = window.__FPS_GAME__!.scene.keys.MainScene as unknown as CombatRosterScene;
    scene.debugDamageCombatActor("cpu-2", 999);
    const afterOne = scene.getHudSnapshot();
    scene.debugDamageCombatActor("dummy", 999);
    scene.debugDamageCombatActor("cpu-3", 999);
    const afterAll = scene.getHudSnapshot();
    scene.debugResetCombatRound();
    return { afterOne, afterAll, afterReset: scene.getHudSnapshot(), roster: scene.debugGetCombatRoster() };
  });

  expect(elimination.afterOne).toMatchObject({ livingEnemyCount: 2, playerScore: 0 });
  expect(elimination.afterAll).toMatchObject({ livingEnemyCount: 0, playerScore: 1 });
  expect(elimination.afterReset).toMatchObject({ livingEnemyCount: 3, totalEnemyCount: 3 });
  expect(elimination.roster.filter((actor) => actor.controller === "cpu" && actor.alive)).toHaveLength(3);
});
