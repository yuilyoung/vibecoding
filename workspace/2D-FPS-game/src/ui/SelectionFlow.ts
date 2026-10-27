import { createArcadeExperienceSearch } from "../domain/visual/ArcadeExperience";
import { getCharacterGameplayProfile, type CharacterGameplayId } from "../domain/player/CharacterGameplayProfile";
import type { DeploymentSelection } from "../domain/deployment/DeploymentSelection";
import { ARCADE_STAGE_PREVIEWS } from "./arcade-stage-preview-catalog";

const CHARACTERS: readonly [CharacterGameplayId, string, string][] = [
  ["arcade-bunny", "Soda Bunny", "bunny"],
  ["arcade-bear", "Honey Bear", "bear"],
  ["arcade-fox", "Turbo Fox", "fox"],
  ["arcade-cat", "Mochi Cat", "cat"]
];
export function renderSelectionFlow(selection: DeploymentSelection): string {
  const selectedCharacter = String(selection.actorSkin);
  const defaultCharacter = CHARACTERS.some(([id]) => id === selectedCharacter)
    ? selectedCharacter as CharacterGameplayId
    : "arcade-bunny";
  const characterCards = CHARACTERS.map(([id, label, shape]) => {
    const profile = getCharacterGameplayProfile(id);
    return `<label class="selection-flow__card selection-flow__character-card"><input type="radio" name="character" value="${id}" ${defaultCharacter === id ? "checked" : ""}><span class="cozy-mascot cozy-mascot--${shape}" aria-hidden="true"><i></i><b>•ᴗ•</b></span><strong>${label}</strong><small>${profile.traitLabel}</small><em>${profile.traitDescription}</em></label>`;
  }).join("");
  const mapCards = ARCADE_STAGE_PREVIEWS.map(({ id, label, subtitle }, index) => `<label class="selection-flow__card selection-flow__map-card"><input type="radio" name="stage" value="${id}" ${index === 0 ? "checked" : ""}><span class="selection-flow__map-thumb cozy-stage-preview cozy-stage-preview--${id}"><strong>${label}</strong><small>${subtitle}</small></span></label>`).join("");

  return `<section class="selection-flow" data-testid="selection-flow"><div class="selection-flow__hero"><p class="panel-kicker">ARCADE BATTLE ENTRY</p><h1>Pick your buddy and arena</h1><p>Choose a character and map, then jump straight into a short duel.</p></div><form id="selection-flow-form" class="selection-flow__form" aria-label="Arcade duel setup"><section class="selection-step selection-step--combined is-active" data-selection-step="setup"><div class="selection-flow__station"><p class="selection-step__eyebrow">01 CHARACTER</p><h2>Choose your buddy</h2><div class="selection-flow__cards selection-flow__cards--characters">${characterCards}</div></div><div class="selection-flow__station"><p class="selection-step__eyebrow">02 MAP</p><h2>Choose your arena</h2><div class="selection-flow__cards selection-flow__cards--maps">${mapCards}</div></div><div class="selection-flow__extras"><label>Rivals <select name="enemyCount"><option value="1" selected>1 rival</option><option value="2">2 rivals</option><option value="3">3 rivals</option><option value="4">4 rivals</option></select></label><label>Weather <select name="weather"><option value="clear" selected>Clear</option><option value="rain">Rain</option><option value="fog">Fog</option><option value="sandstorm">Sandstorm</option><option value="storm">Storm</option></select></label></div><button type="submit" class="selection-flow__submit" data-testid="duel-entry">Enter duel</button></section></form></section>`;
}

export function bindSelectionFlow(root: HTMLElement, navigate: (search: string) => void): () => void {
  const form = root.querySelector<HTMLFormElement>("#selection-flow-form");
  if (!form) return () => undefined;
  const submit = (event: Event): void => {
    event.preventDefault();
    const fields = new FormData(form);
    const base = createArcadeExperienceSearch(String(fields.get("character")), String(fields.get("stage")));
    navigate(`${base}&enemies=${Number(fields.get("enemyCount"))}&weather=${String(fields.get("weather"))}`);
  };
  form.addEventListener("submit", submit);
  return () => form.removeEventListener("submit", submit);
}
