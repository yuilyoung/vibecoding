import { createMapObject } from "../src/domain/map/MapObjectLogic";
import {
  scoreCoverPositions,
  selectFlankPosition,
  selectRetreatAnchor,
  selectTacticalPosition,
  type TacticalPositionConfig
} from "../src/domain/ai/TacticalPositionLogic";

const config: TacticalPositionConfig = {
  coverSearchRadius: 220,
  preferredDistance: 130,
  retreatDistance: 120,
  flankDistance: 90,
  anchorPadding: 28,
  weatherCautionMultiplier: 1
};

describe("TacticalPositionLogic", () => {
  it("prefers cover that breaks line of sight and stays near the preferred range", () => {
    const candidates = scoreCoverPositions({
      actor: { x: 120, y: 120 },
      target: { x: 300, y: 120 },
      intent: "hold",
      cover: [
        createMapObject({ id: "best-cover", kind: "cover", x: 210, y: 120 }),
        createMapObject({ id: "wide-cover", kind: "cover", x: 150, y: 210 })
      ],
      config
    });

    expect(candidates[0]?.coverId).toBe("best-cover");
    expect(candidates[0]?.blocksTargetLineOfSight).toBe(true);
  });

  it("selects a retreat anchor from cover when one is available", () => {
    const selection = selectRetreatAnchor({
      actor: { x: 180, y: 140 },
      target: { x: 320, y: 140 },
      cover: [
        createMapObject({ id: "retreat-cover", kind: "cover", x: 110, y: 140 }),
        createMapObject({ id: "far-cover", kind: "cover", x: 240, y: 240 })
      ],
      config
    });

    expect(selection.source).toBe("cover");
    expect(selection.coverId).toBe("retreat-cover");
    expect(selection.blocksTargetLineOfSight).toBe(true);
    expect(selection.targetX).toBeLessThan(110);
  });

  it("falls back to a perpendicular flank point when no cover is usable", () => {
    const selection = selectFlankPosition({
      actor: { x: 100, y: 100 },
      target: { x: 220, y: 100 },
      cover: [],
      config
    });

    expect(selection.source).toBe("fallback");
    expect(selection.targetX).toBeCloseTo(220);
    expect(selection.targetY).toBeCloseTo(190);
  });

  it("uses a retreat fallback when all cover is outside the search radius", () => {
    const selection = selectTacticalPosition({
      actor: { x: 180, y: 180 },
      target: { x: 260, y: 180 },
      intent: "retreat",
      cover: [createMapObject({ id: "distant-cover", kind: "cover", x: 460, y: 180 })],
      config
    });

    expect(selection.source).toBe("fallback");
    expect(selection.targetX).toBeCloseTo(60);
    expect(selection.targetY).toBeCloseTo(180);
  });
});
