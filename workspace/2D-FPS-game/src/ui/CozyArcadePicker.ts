import { createArcadeExperienceSearch, type ArcadeExperience } from "../domain/visual/ArcadeExperience";
import { getCharacterGameplayProfile } from "../domain/player/CharacterGameplayProfile";
import { ARCADE_STAGE_PREVIEWS } from "./arcade-stage-preview-catalog";

export function renderCozyArcadePicker(selection: ArcadeExperience): string {
  return `<details class="cozy-picker" ${selection.enabled ? "open" : ""}>
    <summary><span class="cozy-new">NEW</span> COZY ARCADE <span>Pick a buddy and arena for a quick duel.</span><b>Character & map</b></summary>
    <form id="cozy-arcade-form" class="cozy-picker-body" aria-label="Cozy Arcade selection">
      <div class="cozy-picker-heading"><p>MAKE A LITTLE SPLASH</p><h2>Choose your arcade buddy</h2><span>Every buddy brings a different way to play.</span></div>
      <fieldset class="cozy-characters"><legend>01 · Your buddy</legend>
        ${characterCard("arcade-bunny", "bunny", "Soda Bunny", "QUICK PAWS", selection)}
        ${characterCard("arcade-bear", "bear", "Honey Bear", "COZY TANK", selection)}
        ${characterCard("arcade-fox", "fox", "Turbo Fox", "DASH SCOUT", selection)}
        ${characterCard("arcade-cat", "cat", "Mochi Cat", "SMOOTH LOADER", selection)}
      </fieldset>
      <fieldset class="cozy-stages"><legend>02 · Today's arena</legend>
        ${ARCADE_STAGE_PREVIEWS.map((stage) => stageCard(stage, selection)).join("")}
      </fieldset>
      <div class="cozy-launch"><span>WASD move · mouse aim & fire · Space sprint</span><button type="submit" data-testid="cozy-play">Enter cozy arcade<b>→</b></button>${selection.enabled ? '<a href="?arcade=classic&setup=complete">Classic mode</a>' : ""}</div>
    </form>
  </details>`;
}

export function bindCozyArcadePicker(root: HTMLElement, navigate: (search: string) => void, resetGameKeys: () => void = () => {}): () => void {
  const form = root.querySelector<HTMLFormElement>("#cozy-arcade-form");
  const submit = (event: Event): void => {
    event.preventDefault();
    if (!form) return;
    const fields = new FormData(form);
    navigate(createArcadeExperienceSearch(String(fields.get("character")), String(fields.get("stage"))));
  };
  const shieldKeys = (event: KeyboardEvent): void => {
    if (event.target instanceof Node && form?.contains(event.target)) event.stopImmediatePropagation();
  };
  form?.addEventListener("submit", submit);
  form?.addEventListener("focusin", resetGameKeys);
  window.addEventListener("keydown", shieldKeys, true);
  window.addEventListener("keyup", shieldKeys, true);
  return () => {
    form?.removeEventListener("submit", submit);
    form?.removeEventListener("focusin", resetGameKeys);
    window.removeEventListener("keydown", shieldKeys, true);
    window.removeEventListener("keyup", shieldKeys, true);
  };
}

function characterCard(id: string, shape: string, name: string, subtitle: string, selection: ArcadeExperience): string {
  const profile = getCharacterGameplayProfile(id);
  return `<label class="cozy-character-card"><input type="radio" name="character" value="${id}" ${selection.character === id ? "checked" : ""}><span class="cozy-mascot cozy-mascot--${shape}" aria-hidden="true"><i></i><b>•ᴗ•</b></span><strong>${name}</strong><small>${subtitle}</small><em>${profile.traitLabel}</em></label>`;
}

function stageCard(stage: (typeof ARCADE_STAGE_PREVIEWS)[number], selection: ArcadeExperience): string {
  return `<label class="cozy-stage-card"><input type="radio" name="stage" value="${stage.id}" ${selection.stage === stage.id ? "checked" : ""}><span class="cozy-stage-preview cozy-stage-preview--${stage.id}" aria-hidden="true"><i></i><i></i><i></i><b>✦</b></span><strong>${stage.label}</strong><small>${stage.subtitle}</small></label>`;
}
