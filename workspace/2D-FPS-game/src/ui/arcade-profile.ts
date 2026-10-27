export type ArcadeProfileRole = "player" | "rival";
export type ArcadeProfileCharacter = "arcade-bunny" | "arcade-bear" | "arcade-fox" | "arcade-cat";

const PROFILE_SHAPES: Readonly<Record<ArcadeProfileCharacter, string>> = Object.freeze({
  "arcade-bunny": "bunny",
  "arcade-bear": "bear",
  "arcade-fox": "fox",
  "arcade-cat": "cat"
});

export function renderArcadeProfileMarkup(role: ArcadeProfileRole, character: string, label: string): string {
  const profileCharacter = isArcadeProfileCharacter(character) ? character : "arcade-bunny";
  const shape = PROFILE_SHAPES[profileCharacter];
  const rivalClass = role === "rival" ? " cozy-mascot--rival" : "";
  const safeLabel = escapeAttribute(label);

  return `<span class="arcade-profile arcade-profile--${role} cozy-mascot cozy-mascot--${shape}${rivalClass}" role="img" aria-label="${safeLabel}"><i></i><b>•ᴗ•</b></span>`;
}

function isArcadeProfileCharacter(value: string): value is ArcadeProfileCharacter {
  return value in PROFILE_SHAPES;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
