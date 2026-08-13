import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import gameBalance from "../assets/data/game-balance.json";
import {
  CONFIGURED_STAGE_IDS,
  CONFIGURED_WEAPON_IDS,
  MAP_OBJECT_KINDS,
  VISUAL_ASSET_SOURCES,
  WEATHER_TYPES,
  getMapObjectVisual,
  getOperatorPortraits,
  getStageVisualTheme,
  getWeaponHudAsset,
  getWeatherVisualTheme
} from "../src/domain/visual/VisualAssetCatalog";

describe("VisualAssetCatalog", () => {
  it("records the three selected vendored sources as CC0", () => {
    expect(Object.keys(VISUAL_ASSET_SOURCES)).toEqual([
      "kenney-top-down-shooter",
      "ground-shaker",
      "pixwep"
    ]);

    for (const source of Object.values(VISUAL_ASSET_SOURCES)) {
      expect(source.license).toBe("CC0-1.0");
      expect(source.homepage).toMatch(/^https:\/\//);
      expect(source.localLicense).toMatch(/^\/assets\/source\//);
    }
  });

  it("maps player and enemy operator portraits by team while keeping one safe preview", () => {
    const blue = getOperatorPortraits("BLUE");
    const red = getOperatorPortraits("RED");
    const fallback = getOperatorPortraits("INVALID");

    expect(blue.playerPath).toContain("player-blue.png");
    expect(blue.enemyPath).toContain("enemy-red.png");
    expect(red.playerPath).toContain("player-red.png");
    expect(red.enemyPath).toContain("enemy-blue.png");
    expect(fallback).toEqual(getOperatorPortraits("UNSET"));

    for (const path of [blue.playerPath, blue.enemyPath, red.playerPath, red.enemyPath]) {
      expect(existsSync(`public${path}`)).toBe(true);
    }
  });

  it("maps every configured weapon to one distinct runtime icon and one explicit fallback", () => {
    expect(Object.keys(gameBalance.weapons)).toEqual([...CONFIGURED_WEAPON_IDS]);
    const assets = CONFIGURED_WEAPON_IDS.map((id) => getWeaponHudAsset(id));

    expect(new Set(assets.map((asset) => asset.iconPath)).size).toBe(CONFIGURED_WEAPON_IDS.length);
    expect(assets.every((asset) => asset.sourceId === "pixwep" && !asset.fallback)).toBe(true);
    expect(assets.every((asset) => existsSync(`public${asset.iconPath}`))).toBe(true);
    expect(getWeaponHudAsset("not-configured")).toMatchObject({ id: "unknown", fallback: true });
  });

  it("gives all three stages distinct terrain crops, palettes, and a deterministic fallback", () => {
    const themes = CONFIGURED_STAGE_IDS.map((id) => getStageVisualTheme(id));

    expect(new Set(themes.map((theme) => JSON.stringify(theme.terrainCrop))).size).toBe(3);
    expect(new Set(themes.map((theme) => theme.borderColor)).size).toBe(3);
    expect(getStageVisualTheme("missing")).toEqual(getStageVisualTheme("foundry"));
  });

  it("defines a coherent legend entry for every runtime map-object kind", () => {
    const visuals = MAP_OBJECT_KINDS.map((kind) => getMapObjectVisual(kind));

    expect(visuals).toHaveLength(6);
    expect(new Set(visuals.map((visual) => visual.label)).size).toBe(6);
    expect(visuals.every((visual) => visual.glyph.length > 0 && visual.description.length > 0)).toBe(true);
  });

  it("defines five distinct weather identities and a zero-tint clear state", () => {
    const themes = WEATHER_TYPES.map((type) => getWeatherVisualTheme(type));

    expect(themes).toHaveLength(5);
    expect(new Set(themes.map((theme) => theme.atmosphereColor)).size).toBe(5);
    expect(getWeatherVisualTheme("clear").atmosphereAlpha).toBe(0);
    expect(themes.filter((theme) => theme.type !== "clear").every((theme) => theme.atmosphereAlpha > 0)).toBe(true);
  });
});
