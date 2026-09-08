import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACTOR_ANIMATION_STATES,
  ACTOR_ATLAS_FRAMES_PER_TEAM,
  ACTOR_DIRECTIONS,
  ACTOR_SKIN_DEFINITIONS,
  createExpectedActorAtlasFrames,
  getActorAnimationFrameKeys,
  getActorSkinDefinition,
  getActorTeamTexture,
  resolveActorAnimationState,
  resolveActorDirection,
  resolveActorPresentationDirection,
  resolveActorSkinForRuntime,
  resolveActorSkinFromSearch
} from "../src/domain/visual/ActorSkinCatalog";

const readManifest = (): Record<string, unknown> => JSON.parse(
  readFileSync("public/assets/runtime/actors/manifest.json", "utf8")
) as Record<string, unknown>;

const readAtlasAvailability = () => (["BLUE", "RED"] as const).map((team) => {
  const lower = team.toLowerCase();
  const atlas = JSON.parse(readFileSync(`public/assets/runtime/actors/actor-${lower}.json`, "utf8")) as {
    frames: Record<string, unknown>;
    meta: { size: { w: number; h: number } };
  };
  return {
    team,
    textureKey: `actor-animated-${lower}`,
    width: atlas.meta.size.w,
    height: atlas.meta.size.h,
    frameKeys: Object.keys(atlas.frames)
  };
});

describe("ActorSkinCatalog", () => {
  it("keeps the legacy vehicle as the total default and query fallback", () => {
    const legacy = ACTOR_SKIN_DEFINITIONS["legacy-vehicle"];

    expect(getActorSkinDefinition(null)).toBe(legacy);
    expect(getActorSkinDefinition(undefined)).toBe(legacy);
    expect(getActorSkinDefinition("")).toBe(legacy);
    expect(getActorSkinDefinition("legacy-vehicle")).toBe(legacy);
    expect(getActorSkinDefinition("unknown-skin")).toBe(legacy);
    expect(resolveActorSkinFromSearch("?actorSkin=unknown-skin")).toBe(legacy);
    expect(resolveActorSkinFromSearch("").id).toBe("quaternius-animated");
    expect(resolveActorSkinFromSearch("?").id).toBe("quaternius-animated");
    expect(resolveActorSkinFromSearch("?actorSkin=legacy-vehicle")).toBe(legacy);
    expect(resolveActorSkinFromSearch("actorSkin=KENNEY-INFANTRY").id).toBe("kenney-infantry");
    expect(resolveActorSkinFromSearch("actorSkin=QUATERNIUS-ANIMATED").id).toBe("quaternius-animated");
  });

  it("resolves deterministic BLUE and RED textures with explicit weapon-layer policy", () => {
    const legacy = getActorSkinDefinition("legacy-vehicle");
    const infantry = getActorSkinDefinition("kenney-infantry");

    expect(legacy.weaponLayer).toBe("external");
    expect(infantry.weaponLayer).toBe("embedded");
    expect(getActorTeamTexture(legacy, "BLUE").textureKey).toBe("ground-body-blue");
    expect(getActorTeamTexture(legacy, "RED").textureKey).toBe("ground-body-red");
    expect(getActorTeamTexture(infantry, "BLUE").textureKey).toBe("actor-infantry-blue");
    expect(getActorTeamTexture(infantry, "RED").textureKey).toBe("actor-infantry-red");
    expect(infantry.teamTextures.BLUE.textureKey).not.toBe(infantry.teamTextures.RED.textureKey);

    const animated = getActorSkinDefinition("quaternius-animated");
    expect(animated.weaponLayer).toBe("external");
    expect(getActorTeamTexture(animated, "BLUE")).toMatchObject({
      kind: "atlas",
      textureKey: "actor-animated-blue",
      runtimePath: "/assets/runtime/actors/actor-blue.webp",
      atlasDataPath: "/assets/runtime/actors/actor-blue.json"
    });
  });

  it("traces every runtime texture to an existing vendored source", () => {
    for (const definition of Object.values(ACTOR_SKIN_DEFINITIONS)) {
      for (const texture of Object.values(definition.teamTextures)) {
        expect(texture.sourceId).toBe(definition.sourceId);
        if (texture.generated) {
          expect(definition.sourceId).toBe("original-arcade");
          expect(texture.runtimePath).toMatch(/^generated:actor-arcade-/);
          expect(existsSync(texture.sourcePath), texture.sourcePath).toBe(true);
          continue;
        }
        expect(existsSync(`public${texture.runtimePath}`), texture.runtimePath).toBe(true);
        expect(existsSync(`public${texture.sourcePath}`), texture.sourcePath).toBe(true);
      }
    }

    const infantry = getActorSkinDefinition("kenney-infantry");
    for (const texture of Object.values(infantry.teamTextures)) {
      expect(readFileSync(`public${texture.runtimePath}`).equals(readFileSync(`public${texture.sourcePath}`))).toBe(true);
    }
  });

  it("exposes two authored arcade skins with animated states and independent weapon layers", () => {
    for (const id of ["arcade-bunny", "arcade-bear"] as const) {
      const skin = getActorSkinDefinition(id);
      expect(resolveActorSkinFromSearch(`actorSkin=${id.toUpperCase()}`)).toBe(skin);
      expect(skin.sourceId).toBe("original-arcade");
      expect(skin.weaponLayer).toBe("external");
      expect(skin.teamTextures.BLUE.textureKey).not.toBe(skin.teamTextures.RED.textureKey);
      expect(Object.values(skin.animationClips).every((clip) => clip.kind === "atlas" && clip.framesPerDirection > 1)).toBe(true);
      expect(resolveActorSkinForRuntime(skin, undefined, [])).toMatchObject({
        definition: { id: "legacy-vehicle" }, fallbackReason: expect.stringContaining("arcade atlas")
      });
    }
  });

  it("represents all researched animation states and eight directions without Phaser types", () => {
    expect(ACTOR_ANIMATION_STATES).toEqual(["idle", "run", "fire", "hit", "death"]);
    expect(ACTOR_DIRECTIONS).toHaveLength(8);

    for (const definition of Object.values(ACTOR_SKIN_DEFINITIONS)) {
      expect(Object.keys(definition.animationClips)).toEqual([...ACTOR_ANIMATION_STATES]);
      expect(definition.directions).toEqual(ACTOR_DIRECTIONS);
    }
    expect(Object.values(getActorSkinDefinition("legacy-vehicle").animationClips).every((clip) => clip.kind === "static")).toBe(true);
    expect(Object.values(getActorSkinDefinition("kenney-infantry").animationClips).every((clip) => clip.kind === "static")).toBe(true);
    expect(Object.values(getActorSkinDefinition("quaternius-animated").animationClips).every((clip) => clip.kind === "atlas")).toBe(true);

    const animated = getActorSkinDefinition("quaternius-animated");
    expect(animated.bodyScale).toBe(0.42);
    expect(animated.animationClips).toEqual({
      idle: { kind: "atlas", framesPerDirection: 4, frameRate: 6, repeat: true },
      run: { kind: "atlas", framesPerDirection: 6, frameRate: 12, repeat: true },
      fire: { kind: "atlas", framesPerDirection: 4, frameRate: 12, repeat: false },
      hit: { kind: "atlas", framesPerDirection: 2, frameRate: 12, repeat: false },
      death: { kind: "atlas", framesPerDirection: 6, frameRate: 8, repeat: false }
    });

    const source = readFileSync("src/domain/visual/ActorSkinCatalog.ts", "utf8");
    expect(source).not.toMatch(/from ["']phaser["']/i);
  });

  it("uses death, hit, fire, run, idle priority for animation state", () => {
    expect(resolveActorAnimationState({ isDead: true, isHit: true, isFiring: true, isMoving: true })).toBe("death");
    expect(resolveActorAnimationState({ isDead: false, isHit: true, isFiring: true, isMoving: true })).toBe("hit");
    expect(resolveActorAnimationState({ isDead: false, isHit: false, isFiring: true, isMoving: true })).toBe("fire");
    expect(resolveActorAnimationState({ isDead: false, isHit: false, isFiring: false, isMoving: true })).toBe("run");
    expect(resolveActorAnimationState({ isDead: false, isHit: false, isFiring: false, isMoving: false })).toBe("idle");
  });

  it("quantizes finite angles to eight screen-space directions with a safe fallback", () => {
    expect(resolveActorDirection(0)).toBe("east");
    expect(resolveActorDirection(Math.PI / 4)).toBe("south-east");
    expect(resolveActorDirection(Math.PI / 2)).toBe("south");
    expect(resolveActorDirection(Math.PI)).toBe("west");
    expect(resolveActorDirection(-Math.PI / 2)).toBe("north");
    expect(resolveActorDirection(Number.NaN)).toBe("east");
    expect(resolveActorPresentationDirection("run", Math.PI, 0)).toBe("west");
    expect(resolveActorPresentationDirection("fire", Math.PI, 0)).toBe("east");

    const epsilon = 1e-12;
    expect(resolveActorDirection(Math.PI / 8 - epsilon)).toBe("east");
    expect(resolveActorDirection(Math.PI / 8)).toBe("south-east");
    expect(resolveActorDirection(Math.PI / 8 + epsilon)).toBe("south-east");
    expect(resolveActorDirection(Math.PI * 15 / 8 - epsilon)).toBe("north-east");
    expect(resolveActorDirection(Math.PI * 15 / 8)).toBe("north-east");
    expect(resolveActorDirection(Math.PI * 15 / 8 + epsilon)).toBe("east");
  });

  it("matches the generated five-state, eight-direction frame contract exactly", () => {
    const animated = getActorSkinDefinition("quaternius-animated");
    const frames = createExpectedActorAtlasFrames();

    expect(frames).toHaveLength(ACTOR_ATLAS_FRAMES_PER_TEAM * 2);
    expect(getActorAnimationFrameKeys(animated, "BLUE", "idle", "east")).toEqual([
      "actor/blue/idle/east/00",
      "actor/blue/idle/east/01",
      "actor/blue/idle/east/02",
      "actor/blue/idle/east/03"
    ]);
    expect(getActorAnimationFrameKeys(animated, "RED", "death", "north-east")).toHaveLength(6);
    expect(frames[0]).toMatchObject({ team: "BLUE", index: 0, key: "actor/blue/idle/east/00" });
    expect(frames[ACTOR_ATLAS_FRAMES_PER_TEAM]).toMatchObject({ team: "RED", index: 0, key: "actor/red/idle/east/00" });
  });

  it("activates both generated atlases only after complete manifest and texture validation", () => {
    const requested = getActorSkinDefinition("quaternius-animated");
    const manifest = readManifest();
    const availability = readAtlasAvailability();

    expect(resolveActorSkinForRuntime(requested, manifest, availability)).toEqual({
      definition: requested,
      fallbackReason: null
    });
  });

  it.each([
    ["missing manifest", null, readAtlasAvailability()],
    ["missing team", readManifest(), readAtlasAvailability().slice(0, 1)],
    ["wrong dimensions", readManifest(), readAtlasAvailability().map((item, index) => index === 0 ? { ...item, width: 1024 } : item)],
    ["missing frame", readManifest(), readAtlasAvailability().map((item, index) => index === 1 ? { ...item, frameKeys: item.frameKeys.slice(1) } : item)]
  ])("falls back totally for %s", (_label, manifest, availability) => {
    const resolution = resolveActorSkinForRuntime(
      getActorSkinDefinition("quaternius-animated"),
      manifest,
      availability
    );

    expect(resolution.definition.id).toBe("legacy-vehicle");
    expect(resolution.definition.weaponLayer).toBe("external");
    expect(resolution.fallbackReason).not.toBeNull();
  });

  it("falls back totally when the generated manifest is incomplete or over budget", () => {
    const requested = getActorSkinDefinition("quaternius-animated");
    const availability = readAtlasAvailability();
    const incomplete = readManifest();
    (incomplete.frames as unknown[]).pop();
    const overBudget = readManifest();
    (overBudget.budgets as Record<string, unknown>).transferBytes = 8 * 1024 * 1024 + 1;
    const understatedTransfer = readManifest();
    (understatedTransfer.budgets as Record<string, unknown>).transferBytes = 1;
    const wrongLimit = readManifest();
    (wrongLimit.budgets as Record<string, unknown>).gpuRgbaLimitBytes = 64 * 1024 * 1024;

    expect(resolveActorSkinForRuntime(requested, incomplete, availability).definition.id).toBe("legacy-vehicle");
    expect(resolveActorSkinForRuntime(requested, overBudget, availability).definition.id).toBe("legacy-vehicle");
    expect(resolveActorSkinForRuntime(requested, understatedTransfer, availability).definition.id).toBe("legacy-vehicle");
    expect(resolveActorSkinForRuntime(requested, wrongLimit, availability).definition.id).toBe("legacy-vehicle");
  });
});
