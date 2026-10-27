import { describe, expect, it } from "vitest";
import {
  createDeploymentSearch,
  resolveDeploymentSelection,
  type DeploymentSelection
} from "../src/domain/deployment/DeploymentSelection";

describe("DeploymentSelection", () => {
  it("uses safe defaults when no deployment query is supplied", () => {
    expect(resolveDeploymentSelection("")).toEqual<DeploymentSelection>({
      weapon: "carbine",
      stage: "foundry",
      enemyCount: 1,
      weather: "clear",
      actorSkin: "quaternius-animated",
      worldSkin: "legacy"
    });
  });

  it("normalizes supported values and clamps enemy count to one through four", () => {
    expect(resolveDeploymentSelection("?weapon=sniper&stage=storm-drain&enemies=4&weather=storm&actorSkin=kenney-infantry&worldSkin=product-v1")).toMatchObject({
      weapon: "sniper",
      stage: "storm-drain",
      enemyCount: 4,
      weather: "storm",
      actorSkin: "kenney-infantry",
      worldSkin: "product-v1"
    });
    expect(resolveDeploymentSelection("?enemies=99").enemyCount).toBe(4);
    expect(resolveDeploymentSelection("?enemies=0").enemyCount).toBe(1);
  });

  it("creates a deterministic normalized query string", () => {
    expect(createDeploymentSearch({
      weapon: "scatter",
      stage: "relay-yard",
      enemyCount: 3,
      weather: "rain",
      actorSkin: "kenney-infantry",
      worldSkin: "product-v1"
    })).toBe("?weapon=scatter&stage=relay-yard&enemies=3&weather=rain&actorSkin=kenney-infantry&worldSkin=product-v1");
  });
});
