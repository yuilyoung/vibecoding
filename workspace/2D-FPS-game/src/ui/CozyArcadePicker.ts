import { createArcadeExperienceSearch, type ArcadeExperience } from "../domain/visual/ArcadeExperience";

export function renderCozyArcadePicker(selection: ArcadeExperience): string {
  return `<details class="cozy-picker" ${selection.enabled ? "open" : ""}>
    <summary><span class="cozy-new">NEW</span> COZY ARCADE <span>작은 친구들의 반짝이는 한 판</span><b>캐릭터 & 맵 고르기 ↗</b></summary>
    <form id="cozy-arcade-form" class="cozy-picker-body" aria-label="Cozy Arcade 선택">
      <div class="cozy-picker-heading"><p>MAKE A LITTLE SPLASH</p><h2>오늘은 어디서 놀까?</h2><span>마음에 드는 친구와 놀이터를 골라요.</span></div>
      <fieldset class="cozy-characters"><legend>01 · 나의 친구</legend>
        ${characterCard("arcade-bunny", "bunny", "소다 버니", "SODA BUNNY", selection)}
        ${characterCard("arcade-bear", "bear", "허니 베어", "HONEY BEAR", selection)}
      </fieldset>
      <fieldset class="cozy-stages"><legend>02 · 오늘의 놀이터</legend>
        ${stageCard("garden-maze", "garden", "미로 정원", "민트빛 울타리 사이로 쏙!", selection)}
        ${stageCard("bubble-bay", "bay", "버블 비치", "나무다리 너머 푸른 바다", selection)}
        ${stageCard("picnic-plaza", "picnic", "피크닉 광장", "넓은 광장에서 가볍게 한 판", selection)}
      </fieldset>
      <div class="cozy-launch"><span>WASD 이동 · 마우스 조준 & 발사 · Space 달리기</span><button type="submit" data-testid="cozy-play">이 친구로 놀러 가기 <b>→</b></button>${selection.enabled ? '<a href="?experience=classic">기존 아레나</a>' : ""}</div>
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
  // Phaser captures arrows/Space globally. Keep native radio and button defaults,
  // but do not let focused picker controls also operate the live game.
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
  return `<label class="cozy-character-card"><input type="radio" name="character" value="${id}" ${selection.character === id ? "checked" : ""}><span class="cozy-mascot cozy-mascot--${shape}" aria-hidden="true"><i></i><b>•ᴗ•</b></span><strong>${name}</strong><small>${subtitle}</small></label>`;
}

function stageCard(id: string, theme: string, name: string, subtitle: string, selection: ArcadeExperience): string {
  return `<label class="cozy-stage-card"><input type="radio" name="stage" value="${id}" ${selection.stage === id ? "checked" : ""}><span class="cozy-stage-preview cozy-stage-preview--${theme}" aria-hidden="true"><i></i><i></i><i></i><b>✦</b></span><strong>${name}</strong><small>${subtitle}</small></label>`;
}
