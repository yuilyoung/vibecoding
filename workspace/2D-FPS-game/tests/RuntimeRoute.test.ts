import { describe, expect, it } from "vitest";
import { runtimeRoute } from "./e2e/runtime-route";

describe("runtimeRoute", () => {
  it("opens the default game route with a completed setup", () => {
    expect(runtimeRoute()).toBe("/?setup=complete");
  });

  it("preserves a deployment path, existing query, and fragment", () => {
    expect(runtimeRoute("/releases/current/game?stage=foundry#arena"))
      .toBe("/releases/current/game?stage=foundry&setup=complete#arena");
  });

  it("replaces every stale setup value with one completed value", () => {
    const result = runtimeRoute("/?setup=1&stage=relay-yard&setup=legacy");
    const url = new URL(result, "https://runtime.invalid");

    expect(url.searchParams.getAll("setup")).toEqual(["complete"]);
    expect(url.searchParams.get("stage")).toBe("relay-yard");
  });

  it("preserves an absolute external origin and deployment URL", () => {
    expect(runtimeRoute("https://play.example.com/deploy/v7/?weather=storm#canvas"))
      .toBe("https://play.example.com/deploy/v7/?weather=storm&setup=complete#canvas");
  });

  it("can explicitly select classic mode without losing an external route", () => {
    expect(runtimeRoute("https://play.example.com/deploy/v7/?weather=storm#canvas", { arcade: "classic" }))
      .toBe("https://play.example.com/deploy/v7/?weather=storm&arcade=classic&setup=complete#canvas");
  });

  it("replaces a stale mode when the caller declares its runtime intent", () => {
    const result = runtimeRoute("/?arcade=cozy&stage=foundry", { arcade: "classic" });
    const url = new URL(result, "https://runtime.invalid");

    expect(url.searchParams.getAll("arcade")).toEqual(["classic"]);
    expect(url.searchParams.get("stage")).toBe("foundry");
  });
});
