import type { ArcadeStage } from "../domain/visual/ArcadeExperience";

export interface ArcadeStagePreview {
  readonly id: ArcadeStage;
  readonly label: string;
  readonly subtitle: string;
}

/** Shared selection metadata keeps the entry screen and the in-game picker aligned. */
export const ARCADE_STAGE_PREVIEWS: readonly ArcadeStagePreview[] = Object.freeze([
  { id: "garden-maze", label: "Garden Maze", subtitle: "Hedges, paths, and a lucky fountain" },
  { id: "bubble-bay", label: "Bubble Bay", subtitle: "Sunny sand and a boardwalk lane" },
  { id: "picnic-plaza", label: "Picnic Plaza", subtitle: "A gingham court with biscuit cover" },
  { id: "beach-boardwalk", label: "Sunny Beach", subtitle: "Tide pools and a breezy pier" },
  { id: "whispering-woods", label: "Whispering Woods", subtitle: "A leafy trail with log cover" },
  { id: "sun-dune", label: "Sun Dune", subtitle: "Warm dunes and an oasis pocket" },
  { id: "neon-city", label: "Neon City", subtitle: "Bright blocks and crosswalk pressure" },
  { id: "frost-festival", label: "Frost Festival", subtitle: "Snow lanes and an icy centerpiece" }
]);
