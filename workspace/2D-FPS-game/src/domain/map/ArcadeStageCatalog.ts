import type { StageDefinitionWithContent, StageContentDefinition } from "./StageContentDefinition";
import type { StageObstacleDefinition } from "./StageDefinition";

function block(id: string, x: number, y: number, width: number, height: number): StageObstacleDefinition {
  return { id, x, y, width, height };
}

/** Explicit static content prevents the training arena's fallback props leaking into a new stage. */
function supplies(prefix: string, ammo: readonly [number, number], health: readonly [number, number], gate: readonly [number, number], hazard: readonly [number, number]): StageContentDefinition {
  return {
    pickups: [
      { id: `${prefix}-ammo`, kind: "ammo", x: ammo[0], y: ammo[1], amount: 8, respawnMs: 5000, label: "버블 충전" },
      { id: `${prefix}-health`, kind: "health", x: health[0], y: health[1], amount: 28, respawnMs: 6500, label: "하트 간식" }
    ],
    gates: [{ id: `${prefix}-gate`, kind: "door", x: gate[0], y: gate[1], width: 24, height: 56, locked: false, label: "리본 게이트" }],
    hazards: [{ id: `${prefix}-splash`, kind: "steam", x: hazard[0], y: hazard[1], width: 64, height: 24, damage: 7, tickMs: 900, label: "톡톡 분수" }],
    mapObjects: []
  };
}

/** Original 960×540 arenas. Coordinates are centers, matching StageGeometryManager. */
export const ARCADE_STAGES: readonly StageDefinitionWithContent[] = [
  {
    id: "garden-maze", label: "클로버 미로", weight: 1,
    blueSpawns: [{ x: 110, y: 270, label: "민트 정원" }, { x: 110, y: 110, label: "꽃길 입구" }],
    redSpawns: [{ x: 850, y: 270, label: "복숭아 정원" }, { x: 850, y: 430, label: "꽃길 출구" }],
    wind: { angleDegrees: 25, strength: 0.15 }, weather: { type: "clear" },
    obstacles: [
      block("garden-hedge-west-north", 260, 155, 56, 142),
      block("garden-hedge-west-south", 260, 390, 56, 116),
      block("garden-hedge-north", 480, 150, 210, 56),
      block("garden-hedge-south", 480, 390, 210, 56),
      block("garden-hedge-east-north", 700, 150, 56, 116),
      block("garden-hedge-east-south", 700, 385, 56, 142),
      block("garden-hedge-inner-west", 396, 280, 104, 56),
      block("garden-hedge-inner-east", 564, 260, 104, 56)
    ],
    content: {
      ...supplies("garden", [480, 76], [480, 466], [480, 270], [480, 330]),
      mapObjects: [
        { id: "garden-gift-west", kind: "crate", x: 180, y: 190 },
        { id: "garden-gift-east", kind: "crate", x: 780, y: 350 },
        { id: "garden-pop-west", kind: "barrel", x: 180, y: 350 },
        { id: "garden-pop-east", kind: "barrel", x: 780, y: 190 }
      ]
    }
  },
  {
    id: "bubble-bay", label: "버블 베이", weight: 1,
    blueSpawns: [{ x: 104, y: 270, label: "조개 해변" }, { x: 112, y: 430, label: "서쪽 모래길" }],
    redSpawns: [{ x: 856, y: 270, label: "산호 해변" }, { x: 848, y: 110, label: "동쪽 모래길" }],
    wind: { angleDegrees: 0, strength: 0.25 }, weather: { type: "clear" },
    obstacles: [
      // The floor paints these exact rectangles as deep water. They block actors and shots.
      block("bay-water-north", 480, 110, 408, 84),
      block("bay-water-south", 480, 430, 408, 84),
      block("bay-boardwalk-west", 326, 254, 58, 70),
      block("bay-boardwalk-east", 634, 286, 58, 70),
      block("bay-boardwalk-north", 770, 145, 56, 64),
      block("bay-boardwalk-south", 190, 395, 56, 64)
    ],
    content: {
      ...supplies("bay", [190, 165], [770, 375], [480, 270], [480, 332]),
      mapObjects: [
        { id: "bay-gift-west", kind: "crate", x: 224, y: 270 },
        { id: "bay-gift-east", kind: "crate", x: 736, y: 270 },
        { id: "bay-pop-north", kind: "barrel", x: 180, y: 90 },
        { id: "bay-pop-south", kind: "barrel", x: 780, y: 450 }
      ]
    }
  },
  {
    id: "picnic-plaza", label: "피크닉 광장", weight: 1,
    blueSpawns: [{ x: 100, y: 270, label: "레몬 피크닉" }, { x: 140, y: 110, label: "햇살 산책로" }],
    redSpawns: [{ x: 860, y: 270, label: "딸기 피크닉" }, { x: 820, y: 430, label: "노을 산책로" }],
    wind: { angleDegrees: -30, strength: 0.1 }, weather: { type: "clear" },
    obstacles: [
      block("picnic-biscuit-northwest", 300, 150, 100, 62),
      block("picnic-biscuit-northeast", 660, 150, 100, 62),
      block("picnic-biscuit-southwest", 300, 390, 100, 62),
      block("picnic-biscuit-southeast", 660, 390, 100, 62),
      block("picnic-biscuit-center", 480, 270, 74, 74)
    ],
    content: {
      ...supplies("picnic", [480, 108], [480, 432], [752, 270], [480, 354]),
      mapObjects: [
        { id: "picnic-gift-west", kind: "crate", x: 268, y: 270 },
        { id: "picnic-gift-east", kind: "crate", x: 692, y: 270 },
        { id: "picnic-pop-north", kind: "barrel", x: 480, y: 184 },
        { id: "picnic-pop-south", kind: "barrel", x: 390, y: 354 }
      ]
    }
  },
  {
    id: "beach-boardwalk", label: "Sunny Beach", weight: 1,
    blueSpawns: [{ x: 110, y: 270, label: "Boardwalk West" }], redSpawns: [{ x: 850, y: 270, label: "Boardwalk East" }],
    wind: { angleDegrees: 0, strength: 0.2 }, weather: { type: "clear" },
    obstacles: [block("beach-pier-north", 320, 150, 160, 44), block("beach-pier-south", 640, 390, 160, 44), block("beach-cabana", 480, 270, 72, 120)],
    content: { ...supplies("beach", [180, 120], [780, 420], [480, 100], [480, 430]), mapObjects: [{ id: "beach-buoy-west", kind: "barrel", x: 220, y: 360 }, { id: "beach-buoy-east", kind: "crate", x: 740, y: 180 }] }
  },
  {
    id: "whispering-woods", label: "Whispering Woods", weight: 1,
    blueSpawns: [{ x: 110, y: 420, label: "Forest Trail West" }], redSpawns: [{ x: 850, y: 120, label: "Forest Trail East" }],
    wind: { angleDegrees: 35, strength: 0.3 }, weather: { type: "clear" },
    obstacles: [block("woods-tree-north", 300, 150, 72, 72), block("woods-tree-south", 660, 390, 72, 72), block("woods-log-center", 480, 270, 220, 42)],
    content: { ...supplies("woods", [180, 390], [780, 150], [480, 100], [480, 430]), mapObjects: [{ id: "woods-stump-west", kind: "crate", x: 200, y: 220 }, { id: "woods-stump-east", kind: "barrel", x: 760, y: 320 }] }
  },
  {
    id: "sun-dune", label: "Sun Dune", weight: 1,
    blueSpawns: [{ x: 110, y: 120, label: "Dune West" }], redSpawns: [{ x: 850, y: 420, label: "Dune East" }],
    wind: { angleDegrees: 180, strength: 0.3 }, weather: { type: "clear" },
    obstacles: [block("dune-rock-north", 330, 180, 120, 60), block("dune-rock-south", 630, 360, 120, 60), block("dune-oasis", 480, 270, 86, 86)],
    content: { ...supplies("dune", [180, 180], [780, 360], [480, 100], [480, 120]), mapObjects: [{ id: "dune-cactus-west", kind: "barrel", x: 220, y: 330 }, { id: "dune-cactus-east", kind: "crate", x: 740, y: 210 }] }
  },
  {
    id: "neon-city", label: "Neon City", weight: 1,
    blueSpawns: [{ x: 110, y: 270, label: "City West" }], redSpawns: [{ x: 850, y: 270, label: "City East" }],
    wind: { angleDegrees: -20, strength: 0.1 }, weather: { type: "clear" },
    obstacles: [block("city-building-north", 300, 145, 110, 90), block("city-building-south", 660, 395, 110, 90), block("city-crosswalk", 480, 270, 54, 210)],
    content: { ...supplies("city", [180, 420], [780, 120], [480, 100], [180, 350]), mapObjects: [{ id: "city-kiosk-west", kind: "crate", x: 200, y: 180 }, { id: "city-kiosk-east", kind: "barrel", x: 760, y: 360 }] }
  },
  {
    id: "frost-festival", label: "Frost Festival", weight: 1,
    blueSpawns: [{ x: 110, y: 390, label: "Snow Gate West" }], redSpawns: [{ x: 850, y: 150, label: "Snow Gate East" }],
    wind: { angleDegrees: 90, strength: 0.3 }, weather: { type: "clear" },
    obstacles: [block("frost-ice-north", 320, 150, 150, 48), block("frost-ice-south", 640, 390, 150, 48), block("frost-snowman", 480, 270, 66, 96)],
    content: { ...supplies("frost", [180, 150], [780, 390], [480, 100], [480, 430]), mapObjects: [{ id: "frost-gift-west", kind: "crate", x: 200, y: 300 }, { id: "frost-gift-east", kind: "barrel", x: 760, y: 240 }] }
  }
];

/** Rotates a copy so stage choice also preserves the complete three-stage loop. */
export function getArcadeStagesStartingWith(id: string | null): readonly StageDefinitionWithContent[] {
  const index = Math.max(0, ARCADE_STAGES.findIndex((stage) => stage.id === id));
  return [...ARCADE_STAGES.slice(index), ...ARCADE_STAGES.slice(0, index)];
}
