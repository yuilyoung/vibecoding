import type { AmbientCueKey } from "./GeneratedAudioCuePlayer";

const AMBIENT_CUES: Readonly<Record<string, AmbientCueKey>> = Object.freeze({
  "garden-maze": "ambient.garden-maze",
  "bubble-bay": "ambient.bubble-bay",
  "picnic-plaza": "ambient.picnic-plaza",
  "beach-boardwalk": "ambient.beach-boardwalk",
  "whispering-woods": "ambient.whispering-woods",
  "sun-dune": "ambient.sun-dune",
  "neon-city": "ambient.neon-city",
  "frost-festival": "ambient.frost-festival"
});

export function getAmbientCueForStage(stageId: string): AmbientCueKey {
  return AMBIENT_CUES[stageId] ?? "ambient.casual";
}
