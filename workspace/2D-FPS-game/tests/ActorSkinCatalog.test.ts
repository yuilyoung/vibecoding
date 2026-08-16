import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACTOR_ANIMATION_STATES,
  ACTOR_DIRECTIONS,
  ACTOR_SKIN_DEFINITIONS,
  getActorSkinDefinition,
  getActorTeamTexture,
  resolveActorAnimationState,
  resolveActorDirection,
  resolveActorSkinFromSearch
} from "../src/domain/visual/ActorSkinCatalog";

describe("ActorSkinCatalog", () => {
  it("keeps the legacy vehicle as the total default and query fallback", () => {
    const legacy = ACTOR_SKIN_DEFINITIONS["legacy-vehicle"];

    expect(getActorSkinDefinition(null)).toBe(legacy);
    expect(getActorSkinDefinition(undefined)).toBe(legacy);
    expect(getActorSkinDefinition("")).toBe(legacy);
    expect(getActorSkinDefinition("legacy-vehicle")).toBe(legacy);
    expect(getActorSkinDefinition("unknown-skin")).toBe(legacy);
    expect(resolveActorSkinFromSearch("")).toBe(legacy);
    expect(resolveActorSkinFromSearch("?actorSkin=unknown-skin")).toBe(legacy);
    expect(resolveActorSkinFromSearch("actorSkin=KENNEY-INFANTRY").id).toBe("kenney-infantry");
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
  });

  it("traces every runtime texture to an existing vendored source", () => {
    for (const definition of Object.values(ACTOR_SKIN_DEFINITIONS)) {
      for (const texture of Object.values(definition.teamTextures)) {
        expect(texture.sourceId).toBe(definition.sourceId);
        expect(existsSync(`public${texture.runtimePath}`), texture.runtimePath).toBe(true);
        expect(existsSync(`public${texture.sourcePath}`), texture.sourcePath).toBe(true);
      }
    }

    const infantry = getActorSkinDefinition("kenney-infantry");
    for (const texture of Object.values(infantry.teamTextures)) {
      expect(readFileSync(`public${texture.runtimePath}`).equals(readFileSync(`public${texture.sourcePath}`))).toBe(true);
    }
  });

  it("represents all researched animation states and eight directions without Phaser types", () => {
    expect(ACTOR_ANIMATION_STATES).toEqual(["idle", "run", "fire", "hit", "death"]);
    expect(ACTOR_DIRECTIONS).toHaveLength(8);

    for (const definition of Object.values(ACTOR_SKIN_DEFINITIONS)) {
      expect(Object.keys(definition.animationClips)).toEqual([...ACTOR_ANIMATION_STATES]);
      expect(definition.directions).toEqual(ACTOR_DIRECTIONS);
      expect(Object.values(definition.animationClips).every((clip) => clip.kind === "static")).toBe(true);
    }

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
  });
});
