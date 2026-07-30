import { createMapObject, destroyMapObject } from "../src/domain/map/MapObjectLogic";
import { getCoverLineOfSightObstacle, isBulletBlocked } from "../src/domain/map/CoverLogic";

describe("CoverLogic", () => {
  it("blocks bullets that cross an active cover rectangle", () => {
    const cover = createMapObject({
      id: "cover-1",
      kind: "cover",
      x: 200,
      y: 150
    });

    expect(
      isBulletBlocked(cover, {
        x: 220,
        y: 150,
        prevX: 170,
        prevY: 150
      })
    ).toBe(true);
  });

  it("does not block bullets once cover is destroyed", () => {
    const cover = destroyMapObject(
      createMapObject({
        id: "cover-1",
        kind: "cover",
        x: 200,
        y: 150
      })
    );

    expect(
      isBulletBlocked(cover, {
        x: 220,
        y: 150,
        prevX: 170,
        prevY: 150
      })
    ).toBe(false);
  });

  it("treats boundary contact as blocked", () => {
    const cover = createMapObject({
      id: "cover-1",
      kind: "cover",
      x: 200,
      y: 150
    });

    expect(
      isBulletBlocked(cover, {
        x: 176,
        y: 150,
        prevX: 150,
        prevY: 150
      })
    ).toBe(true);
  });

  it("ignores bullets that miss the cover bounds", () => {
    const cover = createMapObject({
      id: "cover-1",
      kind: "cover",
      x: 200,
      y: 150
    });

    expect(
      isBulletBlocked(cover, {
        x: 220,
        y: 190,
        prevX: 170,
        prevY: 190
      })
    ).toBe(false);
  });

  it("converts active cover into a line-of-sight obstacle", () => {
    const cover = createMapObject({
      id: "cover-1",
      kind: "cover",
      x: 200,
      y: 150
    });

    expect(getCoverLineOfSightObstacle(cover)).toEqual({
      x: 176,
      y: 142,
      width: 48,
      height: 16
    });
  });

  it("does not expose destroyed cover as a line-of-sight obstacle", () => {
    const cover = destroyMapObject(
      createMapObject({
        id: "cover-1",
        kind: "cover",
        x: 200,
        y: 150
      })
    );

    expect(getCoverLineOfSightObstacle(cover)).toBeUndefined();
  });
});
