export type ArcadeCharacter = "arcade-bunny" | "arcade-bear";
export type ArcadeStage = "garden-maze" | "bubble-bay" | "picnic-plaza";

export interface ArcadeExperience {
  readonly enabled: boolean;
  readonly character: ArcadeCharacter;
  readonly stage: ArcadeStage;
}

/** Map-safe anchors keep the existing cover policies usable in the new layouts. */
export function createExperienceCoverPoints(arcade: boolean): { x: number; y: number }[] {
  return arcade
    ? [{ x: 120, y: 150 }, { x: 840, y: 390 }, { x: 120, y: 390 }]
    : [{ x: 700, y: 160 }, { x: 690, y: 390 }, { x: 260, y: 330 }];
}

export function resolveArcadeExperience(search: string): ArcadeExperience {
  const query = new URLSearchParams(search);
  const stage = query.get("stage");
  return {
    enabled: query.get("arcade") === "cozy",
    character: query.get("actorSkin") === "arcade-bear" ? "arcade-bear" : "arcade-bunny",
    stage: stage === "bubble-bay" || stage === "picnic-plaza" ? stage : "garden-maze"
  };
}

/** Rebuild a known local route; never forward arbitrary parameters as HTML. */
export function createArcadeExperienceSearch(character: string, stage: string): string {
  const selected = resolveArcadeExperience(new URLSearchParams({ actorSkin: character, stage }).toString());
  return `?${new URLSearchParams({ arcade: "cozy", actorSkin: selected.character, stage: selected.stage })}`;
}
