import { expect, test } from "@playwright/test";

test.describe("Original arcade actor art", () => {
  for (const skin of ["arcade-bunny", "arcade-bear"] as const) {
    test(`${skin} has complete, visibly changing animation frames`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width: 1280, height: 1100 });
      await page.goto(`/?actorSkin=${skin}`);
      await page.waitForFunction(() => {
        const scene = window.__FPS_GAME__?.scene.keys.MainScene;
        return scene?.textures.exists("arcade-blaster-blue-carbine");
      });
      await page.evaluate(() => {
        const scene = window.__FPS_GAME__!.scene.keys.MainScene as unknown as {
          debugEnterStage(): void;
          debugSelectTeam(team: "BLUE"): void;
          debugConfirmTeamSelection(): void;
          debugForceCombatLive(): void;
          debugMovePlayerTo(x: number, y: number): void;
          debugMoveDummyTo(x: number, y: number): void;
          debugSetPlayerHullAngle(angle: number): void;
          debugSetPlayerAimAngle(angle: number): void;
          debugRefreshActorPresentation(): void;
        };
        scene.debugEnterStage();
        scene.debugSelectTeam("BLUE");
        scene.debugConfirmTeamSelection();
        scene.debugForceCombatLive();
        scene.debugMovePlayerTo(340, 270);
        scene.debugMoveDummyTo(620, 270);
        scene.debugSetPlayerHullAngle(Math.PI / 4);
        scene.debugSetPlayerAimAngle(0);
        scene.debugRefreshActorPresentation();
      });
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.locator("canvas").first().screenshot({ path: testInfo.outputPath(`${skin}-in-game.png`) });
      const evidence = await page.evaluate((skinId) => {
        const game = window.__FPS_GAME__!;
        const scene = game.scene.keys.MainScene;
        const presentation = scene as unknown as {
          visualController: { getDebugState(): { skinId: string; atlasActive: boolean; fallbackReason: string | null } };
        };
        const states = ["idle", "run", "fire", "hit", "death"];
        const directions = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
        const frameCounts = [4, 6, 4, 2, 6];
        const canvas = document.createElement("canvas");
        canvas.id = "actor-inspection-sheet";
        canvas.width = 820;
        canvas.height = 840;
        canvas.style.cssText = "position:fixed;top:0;left:0;z-index:99999;width:820px;height:840px;";
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#f4f0e7";
        ctx.fillRect(0, 0, 820, 840);
        ctx.fillStyle = "#45506d";
        ctx.font = "18px sans-serif";
        ctx.fillText(`${skinId} · original animated art · 8 directions`, 20, 28);
        const variations: { team: string; state: string; direction: string; distinct: number }[] = [];
        const atlasFrames: number[] = [];
        for (const [teamIndex, team] of ["blue", "red"].entries()) {
          const atlas = scene.textures.get(`actor-${skinId}-${team}`);
          atlasFrames.push(atlas.getFrameNames().length);
          const source = atlas.getSourceImage() as HTMLCanvasElement;
          const sourceContext = source.getContext("2d")!;
          for (const [stateIndex, state] of states.entries()) {
            const row = teamIndex * 5 + stateIndex;
            ctx.fillStyle = team === "blue" ? "#547fab" : "#b67597";
            ctx.font = "14px sans-serif";
            ctx.fillText(`${team} ${state}`, 12, 85 + row * 76);
            for (const [column, direction] of directions.entries()) {
              const signatures = new Set<number>();
              for (let index = 0; index < frameCounts[stateIndex]; index++) {
                const frame = atlas.get(`actor/${team}/${state}/${direction}/${String(index).padStart(2, "0")}`);
                const pixels = sourceContext.getImageData(frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight).data;
                let hash = 2166136261;
                for (const value of pixels) hash = Math.imul(hash ^ value, 16777619);
                signatures.add(hash >>> 0);
                if (index === Math.min(1, frameCounts[stateIndex] - 1)) {
                  ctx.drawImage(source, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
                    112 + column * 86, 45 + row * 76, 64, 64);
                }
              }
              variations.push({ team, state, direction, distinct: signatures.size });
            }
          }
        }
        document.body.appendChild(canvas);
        return { debug: presentation.visualController.getDebugState(), atlasFrames, variations };
      }, skin);
      expect(evidence.debug).toMatchObject({ skinId: skin, atlasActive: true, fallbackReason: null });
      expect(evidence.atlasFrames).toEqual([176, 176]);
      expect(evidence.variations).toHaveLength(80);
      for (const clip of evidence.variations) expect(clip.distinct, `${clip.team}/${clip.state}/${clip.direction}`).toBeGreaterThan(1);
      await page.locator("#actor-inspection-sheet").screenshot({ path: testInfo.outputPath(`${skin}-directions.png`) });
      expect(errors).toEqual([]);
    });
  }
});
