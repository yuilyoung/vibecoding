import Phaser from "phaser";
import gameBalance from "../assets/data/game-balance.json";
import { type SettingsState } from "./domain/settings/SettingsStorage";
import {
  advanceTutorial,
  createDeferredTutorialOverlayState,
  dismissTutorial,
  revealTutorial,
  resetTutorial,
  type TutorialSignal
} from "./domain/tutorial/TutorialOverlayLogic";
import { MainScene } from "./scenes/MainScene";
import type { GameBalance } from "./scenes/scene-types";
import {
  MAP_OBJECT_KINDS,
  getMapObjectVisual,
  getOperatorPortraits,
  getStageVisualTheme,
  getWeaponHudAsset,
  getWeatherVisualTheme
} from "./domain/visual/VisualAssetCatalog";
import { resolveActorSkinFromSearch } from "./domain/visual/ActorSkinCatalog";
import { resolveWorldObjectSkinFromSearch } from "./domain/visual/WorldObjectSkinCatalog";
import { HUD_SNAPSHOT_EVENT, type HudSnapshot } from "./ui/hud-events";
import {
  applySettingsPanelDraft,
  buildSettingsPanelRenderState,
  closeSettingsPanel,
  createSettingsPanelState,
  openSettingsPanel,
  saveSettingsPanelDraft,
  setSettingsPanelSliderValue,
  type SettingsPanelField
} from "./ui/SettingsPanel";
import { buildTutorialOverlayRenderState } from "./ui/TutorialOverlay";
import { ArcadeHud } from "./ui/ArcadeHud";
import "./styles.css";
import "./ui/arcade-hud.css";

declare global {
  interface Window {
    __FPS_GAME__?: Phaser.Game;
    __FPS_UI__?: {
      openSettings: () => void;
      closeSettings: () => void;
      replayTutorial: () => void;
      advanceTutorial: (signal: TutorialSignal) => void;
    };
  }
}

const GAME_VIEWPORT_WIDTH = 960;
const GAME_VIEWPORT_HEIGHT = 540;
const actorSkinDefinition = resolveActorSkinFromSearch(window.location.search);
const worldObjectSkinDefinition = resolveWorldObjectSkinFromSearch(window.location.search);

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (appRoot === null) {
  throw new Error("Missing #app root element.");
}

appRoot.innerHTML = `
  <div class="app-shell">
    <header class="shell-header">
      <div>
        <p class="eyebrow">THE LITTLE ARENA. THE BIG SHOWDOWN.</p>
        <h1>ARENA<span>STRIKE</span><i>★</i></h1>
      </div>
      <div class="header-actions"><span class="header-chip">1 vs 1 · ARCADE BATTLE</span><button id="open-settings" type="button" aria-label="Open settings" disabled>Settings <kbd>Esc</kbd></button></div>
    </header>
    <main class="shell-main">
      <section class="stage-panel">
        <div class="hud-strip hud-strip--top">
          <section class="hud-card player-card">
            <div class="identity-head">
              <img id="player-portrait" class="operator-portrait" src="/assets/runtime/sprites/player-blue.png" alt="Blue operator preview" />
              <span class="operator-badge operator-badge--blue" role="img" aria-label="Blue Vanguard">V</span>
              <div class="identity-copy">
                <p class="hud-label">YOU / CHALLENGER</p>
                <strong id="player-operator-text">Blue Vanguard operator</strong>
                <span id="team-chip" class="team-chip">UNSET</span>
              </div>
            </div>
          </section>
          <section class="match-scoreboard" aria-label="Match score">
            <span id="phase-chip" class="phase-chip">STAGE ENTRY</span>
            <div class="scoreline"><span class="score-side">YOU</span><span id="score-text">0 : 0</span><span class="score-side">RIVAL</span></div>
            <span id="round-text">Round 1</span>
          </section>
          <section class="hud-card enemy-card">
            <div class="identity-head identity-head--enemy">
              <img id="enemy-portrait" class="operator-portrait" src="/assets/runtime/sprites/enemy-red.png" alt="Red hitman preview" />
              <span class="operator-badge operator-badge--red" role="img" aria-label="Red Vanguard">V</span>
              <div class="identity-copy">
                <p class="hud-label">RIVAL / CHALLENGER</p>
                <strong id="enemy-operator-text">Red Vanguard operator</strong>
                <span id="actor-skin-label">${actorSkinDefinition.label}</span>
              </div>
            </div>
            <div class="rival-vitality">
              <div class="meter-copy">
                <span>Enemy</span>
                <span id="dummy-health-text">${gameBalance.maxHealth}/${gameBalance.maxHealth}</span>
              </div>
              <div class="meter-track"><div id="dummy-health-fill" class="meter-fill enemy-fill"></div></div>
            </div>
            <p id="spawn-text" class="support-text">Awaiting deployment</p>
          </section>
        </div>

        <div class="arena-context"><span>★ <strong id="stage-text">Foundry 1/3</strong></span><div id="weather-pill" data-weather="clear" data-testid="weather-pill"><span id="weather-text">CLR / Clear</span></div><span id="progression-text">Lv 1 | 0 XP</span></div>
        <div id="stage-frame" class="stage-frame" data-stage-id="foundry" data-weather="clear" data-actor-skin="${actorSkinDefinition.id}" data-world-skin="${worldObjectSkinDefinition.id}">
          <div id="game-root" class="game-root" tabindex="0" role="group" aria-label="Battle arena"></div>
          <div id="blast-preview" class="blast-preview"></div>
          <div id="cover-vision" class="cover-vision"></div>
          <div id="damage-flash" class="damage-flash" aria-hidden="true"></div>
          <div id="combat-feedback" class="combat-feedback" role="status" aria-live="polite" aria-atomic="true"></div>
          <div class="hud-overlay">
            <section id="banner-card" class="banner-card">
              <p id="banner-kicker" class="banner-kicker">MATCH FLOW</p>
              <h2 id="banner-title">LOADING ARENA</h2>
              <p id="banner-subtitle">Getting the arena ready…</p>
              <button id="primary-play" class="primary-play" type="button" data-testid="primary-play" disabled>
                <strong>PLAY</strong>
                <span>Preparing arena…</span>
              </button>
            </section>
          </div>
          <section id="settings-panel-root" class="settings-panel is-hidden" data-testid="settings-panel" aria-hidden="true">
            <div class="settings-panel-surface" role="dialog" aria-modal="true" aria-labelledby="settings-panel-title">
              <div class="overlay-head">
                <p class="panel-kicker">Settings</p>
                <button id="settings-close" class="overlay-icon-button" type="button" data-testid="settings-close" aria-label="Close settings">Close</button>
              </div>
              <h2 id="settings-panel-title">Combat Settings</h2>
              <label class="settings-field" for="settings-master-volume">
                <span>Master Volume</span>
                <strong id="settings-master-volume-text">100%</strong>
                <input id="settings-master-volume" data-testid="settings-master-volume" data-settings-field="masterVolume" type="range" min="0" max="1" step="0.01" value="1" />
              </label>
              <label class="settings-field" for="settings-sfx-volume">
                <span>SFX Volume</span>
                <strong id="settings-sfx-volume-text">100%</strong>
                <input id="settings-sfx-volume" data-testid="settings-sfx-volume" data-settings-field="sfxVolume" type="range" min="0" max="1" step="0.01" value="1" />
              </label>
              <label class="settings-field" for="settings-mouse-sensitivity">
                <span>Mouse Sensitivity</span>
                <strong id="settings-mouse-sensitivity-text">1.00x</strong>
                <input id="settings-mouse-sensitivity" data-testid="settings-mouse-sensitivity" data-settings-field="mouseSensitivity" type="range" min="0.1" max="5" step="0.1" value="1" />
              </label>
              <div class="overlay-actions">
                <button id="settings-apply" type="button" data-testid="settings-apply">Apply</button>
                <button id="settings-save" type="button" data-testid="settings-save">Save</button>
                <button id="settings-replay-tutorial" type="button" data-testid="settings-replay-tutorial">Replay Tutorial</button>
              </div>
            </div>
          </section>
          <section id="tutorial-overlay-root" class="tutorial-overlay is-hidden" data-testid="tutorial-overlay" aria-hidden="true">
            <div class="tutorial-overlay-panel" role="status" aria-live="polite">
              <p id="tutorial-counter" class="panel-kicker">Step 1 of 5</p>
              <h2 id="tutorial-title">Move</h2>
              <p id="tutorial-body">Use WASD to move and Space to sprint.</p>
              <div class="overlay-actions">
                <button id="tutorial-skip" type="button" data-testid="tutorial-skip">Skip</button>
                <button id="tutorial-hide" type="button" data-testid="tutorial-hide">Don't Show Again</button>
              </div>
            </div>
          </section>
        </div>

        <section class="combat-dock" aria-label="Combat HUD">
          <div id="energy-panel" class="energy-panel">
            <div class="meter-copy"><span><b class="energy-heart">♥</b> ENERGY / HP</span><strong id="player-health-text">100/100</strong></div>
            <div id="energy-meter" class="meter-track" role="meter" aria-label="Health energy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><div id="player-health-fill" class="meter-fill player-fill"></div></div>
            <div class="vitality-caption"><span id="energy-status">BATTLE READY</span><span><kbd>Space</kbd> Sprint</span></div>
          </div>
          <div class="loadout-panel">
            <div class="weapon-strip">
              <img id="weapon-icon" class="weapon-icon" src="/assets/runtime/sprites/weapon-hud-carbine.png" alt="" />
              <strong id="weapon-name">Carbine</strong>
              <span class="ammo-label">AMMO <strong id="ammo-count">6/24</strong></span>
              <span id="weapon-readiness" class="weapon-readiness">READY</span>
              <span class="weapon-key-hint"><kbd>Q</kbd> Switch · <kbd>R</kbd> Reload</span>
            </div>
            <div id="weapon-slot-grid" class="weapon-slot-grid" role="group" aria-label="Weapon slots"></div>
            <div class="reload-strip"><span id="reload-text">READY</span><div class="reload-track"><div id="reload-fill" class="reload-fill"></div></div></div>
          </div>
        </section>
        <section class="hud-card support-card">
          <div class="support-headline">
            <p class="micro-label">ARENA RADIO</p>
            <strong id="event-text" class="support-callout">Press Enter to enter the arena.</strong>
          </div>
          <details class="arena-details"><summary>Match details &amp; pickups</summary><div class="support-rail">
            <div class="support-pill">
              <p class="micro-label">Gate</p>
              <strong id="gate-text">Closed</strong>
            </div>
            <div class="support-pill">
              <p class="micro-label">Loadout</p>
              <strong>Slot <span id="weapon-slot-text">1</span></strong>
            </div>
            <div class="support-pill support-pill--pickup">
              <p class="micro-label">Ammo Pickup</p>
              <strong id="ammo-pickup-text">Ready</strong>
            </div>
            <div class="support-pill support-pill--pickup">
              <p class="micro-label">Health Pickup</p>
              <strong id="health-pickup-text">Ready</strong>
            </div>
            <div class="support-pill support-pill--unlock">
              <p class="micro-label">Armory</p>
              <strong id="unlock-text">Next: Bazooka Lv 2</strong>
            </div>
            <div class="support-pill support-pill--cooldown">
              <p class="micro-label">Weapon Ready</p>
              <strong id="cooldown-text">Ready</strong>
            </div>
          </div></details>
        </section>
      </section>

      <details class="arena-guide"><summary><span><kbd>W A S D</kbd> Move &nbsp; <kbd>Mouse</kbd> Aim &amp; fire &nbsp; <kbd>1–6</kbd> Equip</span><span>Arena guide ＋</span></summary><section class="ops-panel">
        <article class="ops-card">
          <p class="panel-kicker">Controls</p>
          <h2>How To Play</h2>
          <p class="ops-copy">Move with WASD, sprint with Space, aim with the mouse, fire with click or F, reload with R, and use E near the gate. Equip a weapon with 1–6 or its slot button; Q cycles available weapons.</p>
        </article>
        <article class="ops-card">
          <p class="panel-kicker">Arena Guide</p>
          <h2>What Matters</h2>
          <dl class="ops-grid ops-grid--guide">
            <div>
              <dt>Cover</dt>
              <dd>Blue markers show safer pockets to break line of sight. Use them to reset fights instead of tanking damage in the open.</dd>
            </div>
            <div>
              <dt>Vent</dt>
              <dd>The purple strip is a hazard lane. Cross it quickly or you will keep taking damage.</dd>
            </div>
            <div>
              <dt>Pickups</dt>
              <dd>Blue restores reserve ammo and green restores health. If a pickup is unavailable, wait for it to come back rather than hovering on top of it.</dd>
            </div>
          </dl>
        </article>
      <aside id="map-object-legend" class="map-object-legend" aria-label="Arena object legend"><p>KNOW YOUR ARENA</p><div class="map-object-legend-grid">${renderMapObjectLegendMarkup()}</div></aside>
      </section></details>
    </main>
  </div>
`;

const gameContainer = document.querySelector<HTMLDivElement>("#game-root");

if (gameContainer === null) {
  throw new Error("Missing #game-root element.");
}

const mainScene = new MainScene(
  gameBalance as unknown as GameBalance,
  actorSkinDefinition,
  worldObjectSkinDefinition,
  (resolvedSkin) => {
    queryText("#actor-skin-label").textContent = resolvedSkin.label;
    queryElement("#stage-frame").dataset.actorSkin = resolvedSkin.id;
  },
  (resolvedSkin) => {
    queryElement("#stage-frame").dataset.worldSkin = resolvedSkin.id;
  }
);
const hudElements = {
  playerPortrait: queryElement("#player-portrait"),
  playerOperatorText: queryText("#player-operator-text"),
  enemyPortrait: queryElement("#enemy-portrait"),
  enemyOperatorText: queryText("#enemy-operator-text"),
  teamChip: queryText("#team-chip"),
  phaseChip: queryText("#phase-chip"),
  playerHealthText: queryText("#player-health-text"),
  playerHealthFill: queryElement("#player-health-fill"),
  weaponIcon: queryElement("#weapon-icon"),
  weaponName: queryText("#weapon-name"),
  ammoCount: queryText("#ammo-count"),
  weaponSlotGrid: queryElement("#weapon-slot-grid"),
  reloadText: queryText("#reload-text"),
  reloadFill: queryElement("#reload-fill"),
  bannerCard: queryElement("#banner-card"),
  bannerKicker: queryText("#banner-kicker"),
  bannerTitle: queryText("#banner-title"),
  bannerSubtitle: queryText("#banner-subtitle"),
  primaryPlay: queryButton("#primary-play"),
  scoreText: queryText("#score-text"),
  roundText: queryText("#round-text"),
  dummyHealthText: queryText("#dummy-health-text"),
  dummyHealthFill: queryElement("#dummy-health-fill"),
  spawnText: queryText("#spawn-text"),
  eventText: queryText("#event-text"),
  gateText: queryText("#gate-text"),
  weaponSlotText: queryText("#weapon-slot-text"),
  ammoPickupText: queryText("#ammo-pickup-text"),
  healthPickupText: queryText("#health-pickup-text"),
  progressionText: queryText("#progression-text"),
  unlockText: queryText("#unlock-text"),
  stageText: queryText("#stage-text"),
  weatherText: queryText("#weather-text"),
  weatherPill: queryElement("#weather-pill"),
  stageFrame: queryElement("#stage-frame"),
  cooldownText: queryText("#cooldown-text"),
  blastPreview: queryElement("#blast-preview"),
  coverVision: queryElement("#cover-vision")
};
const settingsPanelElements = {
  root: queryElement("#settings-panel-root"),
  close: queryButton("#settings-close"),
  apply: queryButton("#settings-apply"),
  save: queryButton("#settings-save"),
  replayTutorial: queryButton("#settings-replay-tutorial"),
  masterVolume: queryInput("#settings-master-volume"),
  masterVolumeText: queryText("#settings-master-volume-text"),
  sfxVolume: queryInput("#settings-sfx-volume"),
  sfxVolumeText: queryText("#settings-sfx-volume-text"),
  mouseSensitivity: queryInput("#settings-mouse-sensitivity"),
  mouseSensitivityText: queryText("#settings-mouse-sensitivity-text")
};
const tutorialOverlayElements = {
  root: queryElement("#tutorial-overlay-root"),
  skip: queryButton("#tutorial-skip"),
  hide: queryButton("#tutorial-hide"),
  counter: queryText("#tutorial-counter"),
  title: queryText("#tutorial-title"),
  body: queryText("#tutorial-body")
};
const hudRenderCache = new Map<string, string>();
const arcadeHud = new ArcadeHud();

const onHudSnapshot = ((event: Event) => {
  const detail = (event as CustomEvent<HudSnapshot>).detail;

  if (typeof detail !== "object" || detail === null) {
    return;
  }

  const snapshot = normalizeHudSnapshot(detail);
  if (window.__FPS_GAME__ === undefined && mainScene.sys.isActive()) {
    window.__FPS_GAME__ = game;
    hudElements.primaryPlay.disabled = false;
    hudElements.primaryPlay.querySelector("span")!.textContent = "Choose your team";
    queryButton("#open-settings").disabled = false;
  }
  renderHud(snapshot);
}) as EventListener;

window.addEventListener(HUD_SNAPSHOT_EVENT, onHudSnapshot);

function removeHudListener(): void {
  window.removeEventListener(HUD_SNAPSHOT_EVENT, onHudSnapshot);
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  parent: gameContainer,
  backgroundColor: "#09111f",
  scene: [mainScene]
});

let currentSettings = mainScene.getSettingsState();
let settingsPanelState = createSettingsPanelState(currentSettings);
let tutorialState = createDeferredTutorialOverlayState(currentSettings.tutorialDismissed);

const settingsPanelCallbacks = {
  onSave(settings: SettingsState): void {
    currentSettings = mainScene.applySettings(settings);
  },
  onApply(settings: SettingsState): void {
    currentSettings = mainScene.applySettings(settings);
  },
  onReplayTutorial(): void {
    replayTutorial();
  }
};

renderSettingsPanel();
renderTutorialOverlay();

settingsPanelElements.close.addEventListener("click", closeSettings);
queryButton("#open-settings").addEventListener("click", openSettings);
hudElements.weaponSlotGrid.addEventListener("click", onWeaponSlotClick);
settingsPanelElements.apply.addEventListener("click", applySettingsDraft);
settingsPanelElements.save.addEventListener("click", saveSettingsDraft);
settingsPanelElements.replayTutorial.addEventListener("click", replayTutorial);
settingsPanelElements.masterVolume.addEventListener("input", onSettingsSliderInput);
settingsPanelElements.sfxVolume.addEventListener("input", onSettingsSliderInput);
settingsPanelElements.mouseSensitivity.addEventListener("input", onSettingsSliderInput);
hudElements.primaryPlay.addEventListener("click", beginProductExperience);
tutorialOverlayElements.skip.addEventListener("click", skipTutorial);
tutorialOverlayElements.hide.addEventListener("click", hideTutorialPermanently);

window.addEventListener("keydown", onGlobalKeyDown, { capture: true });
window.addEventListener("keyup", blockGameInputWhenSettingsOpen, { capture: true });
window.addEventListener("pointerdown", onGlobalPointerDown, { capture: true });

window.__FPS_UI__ = {
  openSettings,
  closeSettings,
  replayTutorial,
  advanceTutorial: advanceTutorialFromUi
};

game.events.on("destroy", () => {
  removeHudListener();
  removeUiListeners();
});

window.addEventListener("beforeunload", () => {
  removeHudListener();
  removeUiListeners();
  game.destroy(true);
  delete window.__FPS_GAME__;
  delete window.__FPS_UI__;
});

function openSettings(): void {
  if (!mainScene.sys.isActive()) return;
  currentSettings = mainScene.getSettingsState();
  settingsPanelState = openSettingsPanel(settingsPanelState, currentSettings);
  mainScene.setInputOverlayActive(true);
  renderSettingsPanel();
}

function closeSettings(): void {
  settingsPanelState = closeSettingsPanel(settingsPanelState);
  mainScene.setInputOverlayActive(false);
  renderSettingsPanel();
  gameContainer?.focus();
}

function applySettingsDraft(): void {
  currentSettings = applySettingsPanelDraft(settingsPanelState, settingsPanelCallbacks);
  settingsPanelState = createSettingsPanelState(currentSettings, settingsPanelState.isOpen);
  renderSettingsPanel();
}

function saveSettingsDraft(): void {
  currentSettings = saveSettingsPanelDraft(settingsPanelState, settingsPanelCallbacks);
  settingsPanelState = createSettingsPanelState(currentSettings, settingsPanelState.isOpen);
  renderSettingsPanel();
}

function replayTutorial(): void {
  currentSettings = mainScene.applySettings({
    ...currentSettings,
    tutorialDismissed: false
  });
  settingsPanelState = createSettingsPanelState(currentSettings, settingsPanelState.isOpen);
  tutorialState = resetTutorial();
  renderSettingsPanel();
  renderTutorialOverlay();
}

function skipTutorial(): void {
  tutorialState = dismissTutorial(tutorialState);
  renderTutorialOverlay();
}

function hideTutorialPermanently(): void {
  tutorialState = dismissTutorial(tutorialState);
  currentSettings = mainScene.applySettings({
    ...currentSettings,
    tutorialDismissed: true
  });
  settingsPanelState = createSettingsPanelState(currentSettings, settingsPanelState.isOpen);
  renderSettingsPanel();
  renderTutorialOverlay();
}

function advanceTutorialFromUi(signal: TutorialSignal): void {
  const result = advanceTutorial(tutorialState, signal);
  tutorialState = result.state;

  if (tutorialState.dismissed && !currentSettings.tutorialDismissed) {
    currentSettings = mainScene.applySettings({
      ...currentSettings,
      tutorialDismissed: true
    });
    settingsPanelState = createSettingsPanelState(currentSettings, settingsPanelState.isOpen);
    renderSettingsPanel();
  }

  renderTutorialOverlay();
}

function onSettingsSliderInput(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  const field = input.dataset.settingsField;

  if (!isSettingsPanelField(field)) {
    return;
  }

  settingsPanelState = setSettingsPanelSliderValue(settingsPanelState, field, input.value);
  applySettingsDraft();
}

function onGlobalKeyDown(event: KeyboardEvent): void {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const control = target?.closest<HTMLButtonElement | HTMLElement>("button, summary");
  if (control && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) control.click();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (settingsPanelState.isOpen) {
      closeSettings();
      return;
    }

    openSettings();
    return;
  }

  if (settingsPanelState.isOpen) {
    blockGameInputWhenSettingsOpen(event);
    return;
  }

  if (event.key === "Enter" && beginProductExperience()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  const signal = tutorialSignalForKey(event.key);

  if (signal !== null) {
    advanceTutorialFromUi(signal);
  }
}

function beginProductExperience(): boolean {
  if (!mainScene.sys.isActive()) return false;
  const transitioned = mainScene.requestStageEntry();
  if (!transitioned) {
    return false;
  }

  tutorialState = revealTutorial(tutorialState);
  renderTutorialOverlay();
  return true;
}

function blockGameInputWhenSettingsOpen(event: Event): void {
  if (!settingsPanelState.isOpen) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
}

function onGlobalPointerDown(event: PointerEvent): void {
  if (settingsPanelState.isOpen) {
    blockGameInputWhenSettingsOpen(event);
    return;
  }

  if (event.button === 0 && event.target instanceof HTMLCanvasElement && gameContainer?.contains(event.target)) {
    advanceTutorialFromUi("fired");
  }
}

function renderSettingsPanel(): void {
  const renderState = buildSettingsPanelRenderState(settingsPanelState);

  settingsPanelElements.root.className = renderState.overlayClassName;
  settingsPanelElements.root.setAttribute("aria-hidden", renderState.ariaHidden);
  settingsPanelElements.masterVolume.value = String(renderState.masterVolume.value);
  settingsPanelElements.masterVolume.min = String(renderState.masterVolume.min);
  settingsPanelElements.masterVolume.max = String(renderState.masterVolume.max);
  settingsPanelElements.masterVolume.step = String(renderState.masterVolume.step);
  settingsPanelElements.masterVolumeText.textContent = renderState.masterVolume.text;
  settingsPanelElements.sfxVolume.value = String(renderState.sfxVolume.value);
  settingsPanelElements.sfxVolume.min = String(renderState.sfxVolume.min);
  settingsPanelElements.sfxVolume.max = String(renderState.sfxVolume.max);
  settingsPanelElements.sfxVolume.step = String(renderState.sfxVolume.step);
  settingsPanelElements.sfxVolumeText.textContent = renderState.sfxVolume.text;
  settingsPanelElements.mouseSensitivity.value = String(renderState.mouseSensitivity.value);
  settingsPanelElements.mouseSensitivity.min = String(renderState.mouseSensitivity.min);
  settingsPanelElements.mouseSensitivity.max = String(renderState.mouseSensitivity.max);
  settingsPanelElements.mouseSensitivity.step = String(renderState.mouseSensitivity.step);
  settingsPanelElements.mouseSensitivityText.textContent = renderState.mouseSensitivity.text;
}

function renderTutorialOverlay(): void {
  const renderState = buildTutorialOverlayRenderState(tutorialState);

  tutorialOverlayElements.root.className = renderState.overlayClassName;
  tutorialOverlayElements.root.setAttribute("aria-hidden", renderState.ariaHidden);
  tutorialOverlayElements.counter.textContent = renderState.stepCounterText;
  tutorialOverlayElements.title.textContent = renderState.stepTitleText;
  tutorialOverlayElements.body.textContent = renderState.stepBodyText;
}

function tutorialSignalForKey(key: string): TutorialSignal | null {
  const normalized = key.toLowerCase();

  if (normalized === "w" || normalized === "a" || normalized === "s" || normalized === "d" || normalized === " ") {
    return "moved";
  }

  if (normalized === "f") {
    return "fired";
  }

  if (normalized === "q" || ["1", "2", "3", "4", "5", "6"].includes(normalized)) {
    return "swapped-weapon";
  }

  return null;
}

function isSettingsPanelField(value: string | undefined): value is SettingsPanelField {
  return value === "masterVolume" || value === "sfxVolume" || value === "mouseSensitivity";
}

function removeUiListeners(): void {
  queryButton("#open-settings").removeEventListener("click", openSettings);
  hudElements.weaponSlotGrid.removeEventListener("click", onWeaponSlotClick);
  settingsPanelElements.close.removeEventListener("click", closeSettings);
  settingsPanelElements.apply.removeEventListener("click", applySettingsDraft);
  settingsPanelElements.save.removeEventListener("click", saveSettingsDraft);
  settingsPanelElements.replayTutorial.removeEventListener("click", replayTutorial);
  settingsPanelElements.masterVolume.removeEventListener("input", onSettingsSliderInput);
  settingsPanelElements.sfxVolume.removeEventListener("input", onSettingsSliderInput);
  settingsPanelElements.mouseSensitivity.removeEventListener("input", onSettingsSliderInput);
  hudElements.primaryPlay.removeEventListener("click", beginProductExperience);
  tutorialOverlayElements.skip.removeEventListener("click", skipTutorial);
  tutorialOverlayElements.hide.removeEventListener("click", hideTutorialPermanently);
  window.removeEventListener("keydown", onGlobalKeyDown, { capture: true });
  window.removeEventListener("keyup", blockGameInputWhenSettingsOpen, { capture: true });
  window.removeEventListener("pointerdown", onGlobalPointerDown, { capture: true });
}

function renderHud(snapshot: HudSnapshot): void {
  arcadeHud.render(snapshot);
  const coverVision = toCoverVisionState(snapshot);
  const portraits = getOperatorPortraits(snapshot.team);
  const activeWeaponId = snapshot.weaponSlots.find((slot) => slot.isActive)?.id ?? "unknown";
  const weaponAsset = getWeaponHudAsset(activeWeaponId);
  const stageTheme = getStageVisualTheme(snapshot.areaPreview?.stageId ?? "foundry");
  const weatherTheme = getWeatherVisualTheme(snapshot.weather?.type ?? "clear");

  updateImageSource(hudElements.playerPortrait, portraits.playerPath, "player-portrait-src");
  updateAttribute(hudElements.playerPortrait, "alt", portraits.playerLabel, "player-portrait-alt");
  updateText(hudElements.playerOperatorText, portraits.playerLabel, "player-operator-text");
  updateImageSource(hudElements.enemyPortrait, portraits.enemyPath, "enemy-portrait-src");
  updateAttribute(hudElements.enemyPortrait, "alt", portraits.enemyLabel, "enemy-portrait-alt");
  updateText(hudElements.enemyOperatorText, portraits.enemyLabel, "enemy-operator-text");
  updateText(hudElements.teamChip, snapshot.team, "team-chip-text");
  updateClassState(hudElements.teamChip, "team-chip--blue", snapshot.team === "BLUE", "team-chip-blue");
  updateClassState(hudElements.teamChip, "team-chip--red", snapshot.team === "RED", "team-chip-red");
  updateText(hudElements.phaseChip, snapshot.phase, "phase-chip-text");
  updateText(hudElements.playerHealthText, `${snapshot.playerHealth}/${snapshot.playerMaxHealth}`, "player-health-text");
  updateImageSource(
    hudElements.weaponIcon,
    weaponAsset.iconPath,
    "weapon-icon-src"
  );
  updateText(hudElements.weaponName, snapshot.activeWeapon, "weapon-name-text");
  updateText(hudElements.ammoCount, `${snapshot.ammoInMagazine}/${snapshot.reserveAmmo}`, "ammo-count-text");
  renderWeaponSlots(snapshot);
  updateText(hudElements.reloadText, snapshot.isReloading ? "RELOADING" : "READY", "reload-text");
  updateText(hudElements.bannerKicker, snapshot.overlay.visible ? "MATCH FLOW" : "COMBAT LIVE", "banner-kicker-text");
  updateText(hudElements.bannerTitle, snapshot.overlay.title || snapshot.phase, "banner-title-text");
  updateText(hudElements.bannerSubtitle, snapshot.overlay.subtitle || "Stay mobile and keep pressure on the lane.", "banner-subtitle-text");
  updateClassState(hudElements.primaryPlay, "is-hidden", snapshot.phase !== "STAGE ENTRY", "primary-play-hidden");
  updateClassState(hudElements.bannerCard, "is-hidden", !snapshot.overlay.visible, "banner-hidden");
  updateText(hudElements.scoreText, `${snapshot.playerScore} : ${snapshot.dummyScore}`, "score-text");
  updateText(hudElements.roundText, `Round ${snapshot.roundNumber} / First to ${snapshot.scoreToWin}`, "round-text");
  updateText(hudElements.dummyHealthText, `${snapshot.dummyHealth}/${snapshot.dummyMaxHealth}`, "dummy-health-text");
  updateText(hudElements.spawnText, formatSpawnStatus(snapshot), "spawn-text");
  updateText(hudElements.eventText, toActionCallout(snapshot), "event-text");
  updateText(hudElements.gateText, snapshot.gateOpen ? "Gate Open" : "Gate Closed", "gate-text");
  updateText(hudElements.weaponSlotText, String(snapshot.weaponSlot), "weapon-slot-text");
  updateText(hudElements.ammoPickupText, formatPickupStatus(snapshot.ammoPickupLabel, "Ammo ready"), "ammo-pickup-text");
  updateText(hudElements.healthPickupText, formatPickupStatus(snapshot.healthPickupLabel, "Health ready"), "health-pickup-text");
  updateText(hudElements.progressionText, formatProgressionStatus(snapshot), "progression-text");
  updateText(hudElements.unlockText, formatUnlockStatus(snapshot), "unlock-text");
  updateText(hudElements.stageText, formatStageStatus(snapshot), "stage-text");
  updateText(hudElements.weatherText, `${weatherTheme.icon} / ${weatherTheme.label}`, "weather-text");
  updateAttribute(hudElements.stageFrame, "data-stage-id", stageTheme.id, "stage-frame-stage");
  updateAttribute(hudElements.stageFrame, "data-weather", weatherTheme.type, "stage-frame-weather");
  updateAttribute(hudElements.weatherPill, "data-weather", weatherTheme.type, "weather-pill-state");
  updateStyleVar(hudElements.stageFrame, "--stage-accent", stageTheme.accentCss, "stage-frame-accent");
  updateStyleVar(hudElements.stageFrame, "--weather-accent", weatherTheme.accentCss, "stage-frame-weather-accent");
  updateStyleVar(hudElements.weatherPill, "--weather-accent", weatherTheme.accentCss, "weather-pill-accent");
  updateText(hudElements.cooldownText, formatCooldownStatus(snapshot), "cooldown-text");
  renderBlastPreview(snapshot);
  updateClassState(hudElements.coverVision, "is-active", snapshot.coverVisionActive, "cover-vision-active");
  updateStyleVar(hudElements.coverVision, "--vision-x", coverVision.x, "cover-vision-x");
  updateStyleVar(hudElements.coverVision, "--vision-y", coverVision.y, "cover-vision-y");
  updateStyleVar(hudElements.coverVision, "--vision-radius-x", coverVision.radiusX, "cover-vision-radius-x");
  updateStyleVar(hudElements.coverVision, "--vision-radius-y", coverVision.radiusY, "cover-vision-radius-y");

  setMeterWidth(hudElements.playerHealthFill, snapshot.playerHealth, snapshot.playerMaxHealth);
  setMeterWidth(hudElements.dummyHealthFill, snapshot.dummyHealth, snapshot.dummyMaxHealth);
  updateStyle(hudElements.reloadFill, "width", `${Math.round(snapshot.reloadProgress * 100)}%`, "reload-fill-width");
  updateStyle(hudElements.reloadFill, "opacity", snapshot.isReloading ? "1" : "0.24", "reload-fill-opacity");
}

function setMeterWidth(element: HTMLElement, value: number, maxValue: number): void {
  const ratio = maxValue === 0 ? 0 : Math.max(0, Math.min(1, value / maxValue));
  element.style.width = `${Math.round(ratio * 100)}%`;
}

function queryElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);

  if (element === null) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}

function queryText(selector: string): HTMLElement {
  return queryElement(selector);
}

function queryButton(selector: string): HTMLButtonElement {
  const element = document.querySelector<HTMLButtonElement>(selector);

  if (element === null) {
    throw new Error(`Missing required button: ${selector}`);
  }

  return element;
}

function queryInput(selector: string): HTMLInputElement {
  const element = document.querySelector<HTMLInputElement>(selector);

  if (element === null) {
    throw new Error(`Missing required input: ${selector}`);
  }

  return element;
}

function normalizeHudSnapshot(snapshot: HudSnapshot | null | undefined): HudSnapshot {
  return {
    phase: fallbackText(snapshot?.phase, "STAGE ENTRY"),
    team: fallbackText(snapshot?.team, "UNSET"),
    spawn: fallbackText(snapshot?.spawn, "Awaiting deployment"),
    activeWeapon: fallbackText(snapshot?.activeWeapon, "Carbine"),
    weaponSlot: fallbackNumber(snapshot?.weaponSlot, 1),
    weaponSlots: normalizeWeaponSlots(snapshot),
    ammoInMagazine: fallbackNumber(snapshot?.ammoInMagazine, gameBalance.magazineSize),
    reserveAmmo: fallbackNumber(snapshot?.reserveAmmo, gameBalance.reserveAmmo),
    isReloading: Boolean(snapshot?.isReloading),
    reloadProgress: clamp01(snapshot?.reloadProgress),
    cooldownRemainingMs: fallbackNumber(snapshot?.cooldownRemainingMs, 0),
    cooldownDurationMs: fallbackNumber(snapshot?.cooldownDurationMs, 0),
    playerHealth: fallbackNumber(snapshot?.playerHealth, gameBalance.maxHealth),
    playerMaxHealth: maxOrFallback(snapshot?.playerMaxHealth, gameBalance.maxHealth),
    dummyHealth: fallbackNumber(snapshot?.dummyHealth, gameBalance.maxHealth),
    dummyMaxHealth: maxOrFallback(snapshot?.dummyMaxHealth, gameBalance.maxHealth),
    gateOpen: Boolean(snapshot?.gateOpen),
    roundNumber: fallbackNumber(snapshot?.roundNumber, 1),
    playerScore: fallbackNumber(snapshot?.playerScore, 0),
    dummyScore: fallbackNumber(snapshot?.dummyScore, 0),
    scoreToWin: maxOrFallback(snapshot?.scoreToWin, gameBalance.matchScoreToWin),
    lastEvent: fallbackText(snapshot?.lastEvent, "Press Enter to enter the arena."),
    lastSoundCue: fallbackText(snapshot?.lastSoundCue, "NONE"),
    movementMode: fallbackText(snapshot?.movementMode, "Walk"),
    movementBlocked: Boolean(snapshot?.movementBlocked),
    roundStartLabel: fallbackText(snapshot?.roundStartLabel, "LIVE"),
    ammoPickupLabel: fallbackText(snapshot?.ammoPickupLabel, "READY"),
    healthPickupLabel: fallbackText(snapshot?.healthPickupLabel, "READY"),
    coverVisionActive: Boolean(snapshot?.coverVisionActive),
    coverVisionX: fallbackNumber(snapshot?.coverVisionX, 480),
    coverVisionY: fallbackNumber(snapshot?.coverVisionY, 270),
    coverVisionRadius: maxOrFallback(snapshot?.coverVisionRadius, 72),
    progression: snapshot?.progression === undefined
      ? {
          visible: true,
          level: 1,
          xp: 0,
          totalXp: 0,
          xpToNextLevel: Array.isArray(gameBalance.progression.levelCurve) ? gameBalance.progression.levelCurve[0] : null
        }
      : {
          visible: Boolean(snapshot.progression.visible),
          level: fallbackNumber(snapshot.progression.level, 1),
          xp: fallbackNumber(snapshot.progression.xp, 0),
          totalXp: fallbackNumber(snapshot.progression.totalXp, 0),
          xpToNextLevel: snapshot.progression.xpToNextLevel === null ? null : fallbackNumber(snapshot.progression.xpToNextLevel, 0)
        },
    weaponUnlock: snapshot?.weaponUnlock === undefined
      ? {
          visible: true,
          unlockedWeaponIds: ["carbine", "scatter"],
          newlyUnlockedWeaponIds: [],
          nextUnlockWeaponId: "bazooka",
          nextUnlockLevel: 2,
          noticeTitle: "",
          noticeSubtitle: ""
        }
      : {
          visible: Boolean(snapshot.weaponUnlock.visible),
          unlockedWeaponIds: Array.isArray(snapshot.weaponUnlock.unlockedWeaponIds) ? snapshot.weaponUnlock.unlockedWeaponIds : [],
          newlyUnlockedWeaponIds: Array.isArray(snapshot.weaponUnlock.newlyUnlockedWeaponIds) ? snapshot.weaponUnlock.newlyUnlockedWeaponIds : [],
          nextUnlockWeaponId: snapshot.weaponUnlock.nextUnlockWeaponId,
          nextUnlockLevel: snapshot.weaponUnlock.nextUnlockLevel,
          noticeTitle: fallbackText(snapshot.weaponUnlock.noticeTitle, ""),
          noticeSubtitle: fallbackText(snapshot.weaponUnlock.noticeSubtitle, "")
        },
    areaPreview: snapshot?.areaPreview === undefined
      ? {
          visible: true,
          stageId: "foundry",
          stageLabel: "Foundry",
          stageIndex: 1,
          stageCount: Array.isArray(gameBalance.stages) ? gameBalance.stages.length : 1,
          title: "Foundry",
          subtitle: "",
          stages: []
        }
      : {
          visible: Boolean(snapshot.areaPreview.visible),
          stageId: fallbackText(snapshot.areaPreview.stageId, "foundry"),
          stageLabel: fallbackText(snapshot.areaPreview.stageLabel, "Foundry"),
          stageIndex: fallbackNumber(snapshot.areaPreview.stageIndex, 1),
          stageCount: maxOrFallback(snapshot.areaPreview.stageCount, 1),
          title: fallbackText(snapshot.areaPreview.title, snapshot.areaPreview.stageLabel),
          subtitle: fallbackText(snapshot.areaPreview.subtitle, ""),
          stages: Array.isArray(snapshot.areaPreview.stages) ? snapshot.areaPreview.stages : []
        },
    blastPreview: snapshot?.blastPreview === undefined
      ? {
          visible: false,
          x: 480,
          y: 270,
          radius: 0
        }
      : {
          visible: Boolean(snapshot.blastPreview.visible),
          x: fallbackNumber(snapshot.blastPreview.x, 480),
          y: fallbackNumber(snapshot.blastPreview.y, 270),
          radius: fallbackNumber(snapshot.blastPreview.radius, 0)
        },
    weather: snapshot?.weather === undefined
      ? {
          visible: true,
          type: "clear",
          label: "Clear",
          icon: "CLR",
          movementMultiplier: 1,
          visionRange: 300,
          windStrengthMultiplier: 1,
          minesDisabled: false
        }
      : {
          visible: Boolean(snapshot.weather.visible),
          type: snapshot.weather.type,
          label: fallbackText(snapshot.weather.label, "Clear"),
          icon: fallbackText(snapshot.weather.icon, "CLR"),
          movementMultiplier: fallbackNumber(snapshot.weather.movementMultiplier, 1),
          visionRange: fallbackNumber(snapshot.weather.visionRange, 300),
          windStrengthMultiplier: fallbackNumber(snapshot.weather.windStrengthMultiplier, 1),
          minesDisabled: Boolean(snapshot.weather.minesDisabled)
        },
    tactical: snapshot?.tactical === undefined
      ? undefined
      : {
          intent: snapshot.tactical.intent,
          targetCoverIndex: snapshot.tactical.targetCoverIndex,
          targetCoverEffect: snapshot.tactical.targetCoverEffect,
          chosenWeaponId: fallbackText(snapshot.tactical.chosenWeaponId, "carbine"),
          chosenWeaponRole: snapshot.tactical.chosenWeaponRole === null
            ? null
            : fallbackText(snapshot.tactical.chosenWeaponRole, "mid-range")
        },
    overlay: {
      visible: Boolean(snapshot?.overlay?.visible),
      title: fallbackText(snapshot?.overlay?.title, ""),
      subtitle: fallbackText(snapshot?.overlay?.subtitle, "")
    }
  };
}

function normalizeWeaponSlots(snapshot: HudSnapshot | null | undefined): HudSnapshot["weaponSlots"] {
  if (Array.isArray(snapshot?.weaponSlots) && snapshot.weaponSlots.length > 0) {
    return snapshot.weaponSlots.map((slot, index) => ({
      slot: fallbackNumber(slot.slot, index + 1),
      id: fallbackText(slot.id, `slot-${index + 1}`),
      label: fallbackText(slot.label, `Slot ${index + 1}`),
      ammoInMagazine: fallbackNumber(slot.ammoInMagazine, 0),
      reserveAmmo: fallbackNumber(slot.reserveAmmo, 0),
      isActive: Boolean(slot.isActive),
      isReloading: Boolean(slot.isReloading)
    }));
  }

  return [
    { slot: 1, id: "carbine", label: "Carbine", ammoInMagazine: fallbackNumber(snapshot?.ammoInMagazine, gameBalance.magazineSize), reserveAmmo: fallbackNumber(snapshot?.reserveAmmo, gameBalance.reserveAmmo), isActive: true, isReloading: Boolean(snapshot?.isReloading) },
    { slot: 2, id: "scatter", label: "Scatter", ammoInMagazine: 0, reserveAmmo: 0, isActive: false, isReloading: false },
    { slot: 3, id: "bazooka", label: "Bazooka", ammoInMagazine: 0, reserveAmmo: 0, isActive: false, isReloading: false },
    { slot: 4, id: "grenade", label: "Grenade", ammoInMagazine: 0, reserveAmmo: 0, isActive: false, isReloading: false },
    { slot: 5, id: "sniper", label: "Sniper", ammoInMagazine: 0, reserveAmmo: 0, isActive: false, isReloading: false },
    { slot: 6, id: "airStrike", label: "Air Strike", ammoInMagazine: 0, reserveAmmo: 0, isActive: false, isReloading: false }
  ];
}

function renderWeaponSlots(snapshot: HudSnapshot): void {
  const serialized = JSON.stringify([snapshot.weaponSlots, snapshot.weaponUnlock?.unlockedWeaponIds, snapshot.phase, snapshot.playerHealth === 0]);

  if (hudRenderCache.get("weapon-slot-grid") === serialized) {
    return;
  }

  const focusedSlot = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(".weapon-slot-tile")?.dataset.slot;
  const buttons = snapshot.weaponSlots.map((slot) => {
      const locked = snapshot.weaponUnlock !== undefined && !snapshot.weaponUnlock.unlockedWeaponIds.includes(slot.id);
      const element = document.createElement("button");
      element.type = "button";
      element.disabled = locked || snapshot.phase !== "COMBAT LIVE" || snapshot.playerHealth <= 0;
      element.className = `weapon-slot-tile${slot.isActive ? " is-active" : ""}${slot.isReloading ? " is-reloading" : ""}`;
      element.classList.toggle("is-locked", locked);
      element.setAttribute("aria-label", `${slot.slot}: ${slot.label}${locked ? ", locked" : ""}`);
      element.setAttribute("aria-pressed", String(slot.isActive));
      element.dataset.slot = String(slot.slot);
      element.dataset.weaponId = slot.id;
      element.setAttribute("aria-current", slot.isActive ? "true" : "false");

      const slotLabel = document.createElement("span");
      slotLabel.className = "weapon-slot-number";
      slotLabel.textContent = String(slot.slot);

      const name = document.createElement("strong");
      name.textContent = slot.label;

      const icon = document.createElement("img");
      icon.className = "weapon-slot-icon";
      icon.src = getWeaponHudAsset(slot.id).iconPath;
      icon.alt = "";

      const ammo = document.createElement("span");
      ammo.className = "weapon-slot-ammo";
      ammo.textContent = locked ? "LOCKED" : slot.isReloading ? "Reloading" : `${slot.ammoInMagazine}/${slot.reserveAmmo}`;

      element.append(slotLabel, icon, name, ammo);
      return element;
    });
  hudElements.weaponSlotGrid.replaceChildren(...buttons);
  if (focusedSlot !== undefined) buttons.find((button) => button.dataset.slot === focusedSlot)?.focus({ preventScroll: true });
  hudRenderCache.set("weapon-slot-grid", serialized);
}

function onWeaponSlotClick(event: MouseEvent): void {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-slot]");
  if (button === null || button.disabled || settingsPanelState.isOpen) return;
  mainScene.requestWeaponSlot(Number(button.dataset.slot));
  advanceTutorialFromUi("swapped-weapon");
  if (event.detail > 0) gameContainer?.focus({ preventScroll: true });
}

function renderBlastPreview(snapshot: HudSnapshot): void {
  const preview = snapshot.blastPreview;

  if (preview === undefined || !preview.visible || preview.radius <= 0) {
    updateClassState(hudElements.blastPreview, "is-active", false, "blast-preview-active");
    return;
  }

  const centerX = clamp01(preview.x / GAME_VIEWPORT_WIDTH) * 100;
  const centerY = clamp01(preview.y / GAME_VIEWPORT_HEIGHT) * 100;
  const radiusX = clamp01(preview.radius / GAME_VIEWPORT_WIDTH) * 100;
  const radiusY = clamp01(preview.radius / GAME_VIEWPORT_HEIGHT) * 100;

  updateClassState(hudElements.blastPreview, "is-active", true, "blast-preview-active");
  updateStyleVar(hudElements.blastPreview, "--blast-x", `${centerX}%`, "blast-preview-x");
  updateStyleVar(hudElements.blastPreview, "--blast-y", `${centerY}%`, "blast-preview-y");
  updateStyleVar(hudElements.blastPreview, "--blast-radius-x", `${radiusX}%`, "blast-preview-radius-x");
  updateStyleVar(hudElements.blastPreview, "--blast-radius-y", `${radiusY}%`, "blast-preview-radius-y");
}

function toActionCallout(snapshot: HudSnapshot): string {
  const event = snapshot.lastEvent.toUpperCase();

  if (snapshot.overlay.visible && snapshot.overlay.subtitle.length > 0) {
    return snapshot.overlay.subtitle;
  }

  switch (event) {
    case "PRESS ENTER TO ENTER STAGE":
      return "Press Enter to enter the arena.";
    case "SELECT TEAM: 1 BLUE / 2 RED":
      return "Choose a team with 1 or 2, then press Enter to deploy.";
    case "TEAM PREVIEW BLUE":
      return "Blue team selected. Press Enter to deploy.";
    case "TEAM PREVIEW RED":
      return "Red team selected. Press Enter to deploy.";
    case "DEPLOYING BLUE":
    case "DEPLOYING RED":
      return "Deployment in progress. Hold position and get ready to push.";
    case "COMBAT LIVE":
      return "Combat live. Take space, use cover, and watch your reload.";
    case "RELOADING":
      return "Reloading. Break line of sight or give ground for a moment.";
    case "NO RESERVE":
      return "No reserve ammo. Rotate to the blue ammo pickup.";
    case "RELOAD CANCELED":
      return "Reload canceled. Fire or move again when you are ready.";
    case "STUN CANCELED RELOAD":
      return "Reload interrupted by damage. Reset and try again.";
    case "GATE TOO FAR":
      return "Move closer to the gate, then press E to open it.";
    case "GATE OPENED":
      return "Gate opened. Push through while the lane is clear.";
    case "GATE CLOSED":
      return "Gate closed. Use it to block the lane or regroup.";
    case "AMMO FULL":
      return "Ammo is already full. Keep pressure on the enemy.";
    case "HP FULL":
      return "Health is full. Save the med pickup for later.";
    default:
      return sentenceCase(snapshot.lastEvent);
  }
}

function formatPickupStatus(label: string, readyText: string): string {
  if (label === "READY") {
    return readyText;
  }

  if (label === "OFF") {
    return "Unavailable";
  }

  return `${label} ms`;
}

function formatProgressionStatus(snapshot: HudSnapshot): string {
  const progression = snapshot.progression;

  if (progression === undefined || !progression.visible) {
    return "Unavailable";
  }

  const nextXp = progression.xpToNextLevel === null ? "MAX" : progression.xpToNextLevel;
  return `Lv ${progression.level} | ${progression.xp}/${nextXp} XP`;
}

function formatUnlockStatus(snapshot: HudSnapshot): string {
  const unlock = snapshot.weaponUnlock;

  if (unlock === undefined || !unlock.visible) {
    return "Unavailable";
  }

  if (unlock.newlyUnlockedWeaponIds.length > 0) {
    return unlock.noticeSubtitle.length > 0 ? unlock.noticeSubtitle : unlock.noticeTitle;
  }

  if (unlock.nextUnlockWeaponId !== null && unlock.nextUnlockLevel !== null) {
    return `Next: ${sentenceCase(unlock.nextUnlockWeaponId).replace(".", "")} Lv ${unlock.nextUnlockLevel}`;
  }

  return "All weapons unlocked";
}

function formatStageStatus(snapshot: HudSnapshot): string {
  const area = snapshot.areaPreview;

  if (area === undefined || !area.visible) {
    return "Unavailable";
  }

  return `${area.stageLabel} ${area.stageIndex}/${area.stageCount}`;
}

function formatSpawnStatus(snapshot: HudSnapshot): string {
  const tactical = snapshot.tactical;

  if (tactical === undefined || snapshot.phase !== "COMBAT LIVE") {
    return snapshot.spawn;
  }

  const coverLabel = tactical.targetCoverEffect === null
    ? "Open lane"
    : sentenceCase(tactical.targetCoverEffect).replace(".", "");
  const roleLabel = tactical.chosenWeaponRole ?? tactical.chosenWeaponId;

  return `${snapshot.spawn} · Dummy ${tactical.intent} / ${roleLabel} / ${coverLabel}`;
}

function formatCooldownStatus(snapshot: HudSnapshot): string {
  if (snapshot.isReloading) {
    return "Reloading";
  }

  if (snapshot.cooldownRemainingMs <= 0) {
    return "Ready";
  }

  const seconds = Math.max(0.1, snapshot.cooldownRemainingMs / 1000);
  return `${seconds.toFixed(1)}s`;
}

function sentenceCase(value: string): string {
  const compact = value.trim().toLowerCase();

  if (compact.length === 0) {
    return "";
  }

  return `${compact.charAt(0).toUpperCase()}${compact.slice(1)}.`;
}

function fallbackText(value: string | null | undefined, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function fallbackNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function maxOrFallback(value: number | null | undefined, fallback: number): number {
  const safeValue = fallbackNumber(value, fallback);
  return safeValue > 0 ? safeValue : fallback;
}

function clamp01(value: number | null | undefined): number {
  return Math.max(0, Math.min(1, fallbackNumber(value, 0)));
}

function toCoverVisionState(snapshot: HudSnapshot): { x: string; y: string; radiusX: string; radiusY: string } {
  const centerX = clamp01(snapshot.coverVisionX / GAME_VIEWPORT_WIDTH) * 100;
  const centerY = clamp01(snapshot.coverVisionY / GAME_VIEWPORT_HEIGHT) * 100;
  const radiusX = clamp01(snapshot.coverVisionRadius / GAME_VIEWPORT_WIDTH) * 100;
  const radiusY = clamp01(snapshot.coverVisionRadius / GAME_VIEWPORT_HEIGHT) * 100;

  return {
    x: `${centerX}%`,
    y: `${centerY}%`,
    radiusX: `${radiusX}%`,
    radiusY: `${radiusY}%`
  };
}

function updateText(element: HTMLElement, value: string, cacheKey: string): void {
  if (hudRenderCache.get(cacheKey) === value) {
    return;
  }

  element.textContent = value;
  hudRenderCache.set(cacheKey, value);
}

function updateImageSource(element: HTMLElement, value: string, cacheKey: string): void {
  if (hudRenderCache.get(cacheKey) === value) {
    return;
  }

  element.setAttribute("src", value);
  hudRenderCache.set(cacheKey, value);
}

function updateAttribute(element: HTMLElement, attributeName: string, value: string, cacheKey: string): void {
  if (hudRenderCache.get(cacheKey) === value) {
    return;
  }

  element.setAttribute(attributeName, value);
  hudRenderCache.set(cacheKey, value);
}

function renderMapObjectLegendMarkup(): string {
  return MAP_OBJECT_KINDS.map((kind) => {
    const visual = getMapObjectVisual(kind);
    return `<span class="map-object-legend-item" data-object-kind="${kind}" title="${visual.description}"><b>${visual.glyph}</b>${visual.label}</span>`;
  }).join("");
}

function updateClassState(element: HTMLElement, className: string, enabled: boolean, cacheKey: string): void {
  const value = enabled ? "1" : "0";

  if (hudRenderCache.get(cacheKey) === value) {
    return;
  }

  element.classList.toggle(className, enabled);
  hudRenderCache.set(cacheKey, value);
}

function updateStyleVar(element: HTMLElement, propertyName: string, value: string, cacheKey: string): void {
  if (hudRenderCache.get(cacheKey) === value) {
    return;
  }

  element.style.setProperty(propertyName, value);
  hudRenderCache.set(cacheKey, value);
}

function updateStyle(element: HTMLElement, propertyName: string, value: string, cacheKey: string): void {
  if (hudRenderCache.get(cacheKey) === value) {
    return;
  }

  element.style.setProperty(propertyName, value);
  hudRenderCache.set(cacheKey, value);
}
