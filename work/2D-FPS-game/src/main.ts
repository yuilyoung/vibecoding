import Phaser from "phaser";
import gameBalance from "../assets/data/game-balance.json";
import { MainScene } from "./scenes/MainScene";
import { HUD_SNAPSHOT_EVENT, type HudSnapshot } from "./ui/hud-events";
import "./styles.css";

declare global {
  interface Window {
    __FPS_GAME__?: Phaser.Game;
  }
}

const GAME_VIEWPORT_WIDTH = 960;
const GAME_VIEWPORT_HEIGHT = 540;

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (appRoot === null) {
  throw new Error("Missing #app root element.");
}

appRoot.innerHTML = `
  <div class="app-shell">
    <header class="shell-header">
      <div>
        <p class="eyebrow">TACTICAL PROTOTYPE</p>
        <h1>Arena Strike</h1>
      </div>
      <div class="header-chip">top-down combat slice</div>
    </header>
    <main class="shell-main">
      <section class="stage-panel">
        <div class="hud-strip hud-strip--top">
          <section class="hud-card player-card">
            <p class="hud-label">Player</p>
            <div class="hud-statline">
              <span id="team-chip" class="team-chip">UNSET</span>
              <span id="phase-chip" class="phase-chip">STAGE ENTRY</span>
            </div>
            <div>
              <div class="meter-copy">
                <span>Health</span>
                <span id="player-health-text">${gameBalance.maxHealth}/${gameBalance.maxHealth}</span>
              </div>
              <div class="meter-track"><div id="player-health-fill" class="meter-fill player-fill"></div></div>
            </div>
              <div class="weapon-strip">
              <img id="weapon-icon" class="weapon-icon" src="/assets/runtime/sprites/weapon-hud-carbine.png" alt="" />
              <div>
                <p class="micro-label">Loadout</p>
                <strong id="weapon-name">Carbine</strong>
              </div>
              <div>
                <p class="micro-label">Ammo</p>
                <strong id="ammo-count">${gameBalance.magazineSize}/${gameBalance.reserveAmmo}</strong>
              </div>
            </div>
            <div class="reload-strip">
              <div class="meter-copy">
                <span>Reload</span>
                <span id="reload-text">READY</span>
              </div>
              <div class="reload-track"><div id="reload-fill" class="reload-fill"></div></div>
            </div>
          </section>

          <section class="hud-card enemy-card">
            <p class="hud-label">Match</p>
            <div class="scoreline">
              <span id="score-text">0 : 0</span>
              <span id="round-text">Round 1</span>
            </div>
            <div>
              <div class="meter-copy">
                <span>Enemy</span>
                <span id="dummy-health-text">${gameBalance.maxHealth}/${gameBalance.maxHealth}</span>
              </div>
              <div class="meter-track"><div id="dummy-health-fill" class="meter-fill enemy-fill"></div></div>
            </div>
            <p id="spawn-text" class="support-text">Awaiting deployment</p>
          </section>
        </div>

        <div class="stage-frame">
          <div id="game-root" class="game-root"></div>
          <div id="cover-vision" class="cover-vision"></div>
          <div class="hud-overlay" aria-live="polite">
            <section id="banner-card" class="banner-card">
              <p id="banner-kicker" class="banner-kicker">MATCH FLOW</p>
              <h2 id="banner-title">ENTER STAGE</h2>
              <p id="banner-subtitle">Press ENTER to open team selection.</p>
            </section>
          </div>
        </div>

        <section class="hud-card support-card">
          <div class="support-headline">
            <p class="micro-label">Current Callout</p>
            <strong id="event-text" class="support-callout">Press Enter to enter the arena.</strong>
          </div>
          <div class="support-rail">
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
          </div>
        </section>
      </section>

      <section class="ops-panel">
        <article class="ops-card">
          <p class="panel-kicker">Controls</p>
          <h2>How To Play</h2>
          <p class="ops-copy">Move with WASD, let the hull settle into your travel direction, aim the turret with the mouse, fire with click or F, reload with R, and use E near the gate.</p>
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
      </section>
    </main>
  </div>
`;

const gameContainer = document.querySelector<HTMLDivElement>("#game-root");

if (gameContainer === null) {
  throw new Error("Missing #game-root element.");
}

const mainScene = new MainScene(gameBalance);
const hudElements = {
  teamChip: queryText("#team-chip"),
  phaseChip: queryText("#phase-chip"),
  playerHealthText: queryText("#player-health-text"),
  playerHealthFill: queryElement("#player-health-fill"),
  weaponIcon: queryElement("#weapon-icon"),
  weaponName: queryText("#weapon-name"),
  ammoCount: queryText("#ammo-count"),
  reloadText: queryText("#reload-text"),
  reloadFill: queryElement("#reload-fill"),
  bannerCard: queryElement("#banner-card"),
  bannerKicker: queryText("#banner-kicker"),
  bannerTitle: queryText("#banner-title"),
  bannerSubtitle: queryText("#banner-subtitle"),
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
  coverVision: queryElement("#cover-vision")
};
const hudRenderCache = new Map<string, string>();

const onHudSnapshot = ((event: Event) => {
  const detail = (event as CustomEvent<HudSnapshot>).detail;

  if (typeof detail !== "object" || detail === null) {
    return;
  }

  const snapshot = normalizeHudSnapshot(detail);
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

window.__FPS_GAME__ = game;

game.events.on("destroy", () => {
  removeHudListener();
});

window.addEventListener("beforeunload", () => {
  removeHudListener();
  game.destroy(true);
  delete window.__FPS_GAME__;
});

function renderHud(snapshot: HudSnapshot): void {
  const coverVision = toCoverVisionState(snapshot);

  updateText(hudElements.teamChip, snapshot.team, "team-chip-text");
  updateClassState(hudElements.teamChip, "team-chip--blue", snapshot.team === "BLUE", "team-chip-blue");
  updateClassState(hudElements.teamChip, "team-chip--red", snapshot.team === "RED", "team-chip-red");
  updateText(hudElements.phaseChip, snapshot.phase, "phase-chip-text");
  updateText(hudElements.playerHealthText, `${snapshot.playerHealth}/${snapshot.playerMaxHealth}`, "player-health-text");
  updateImageSource(
    hudElements.weaponIcon,
    snapshot.weaponSlot === 2 ? "/assets/runtime/sprites/weapon-hud-scatter.png" : "/assets/runtime/sprites/weapon-hud-carbine.png",
    "weapon-icon-src"
  );
  updateText(hudElements.weaponName, snapshot.activeWeapon, "weapon-name-text");
  updateText(hudElements.ammoCount, `${snapshot.ammoInMagazine}/${snapshot.reserveAmmo}`, "ammo-count-text");
  updateText(hudElements.reloadText, snapshot.isReloading ? "RELOADING" : "READY", "reload-text");
  updateText(hudElements.bannerKicker, snapshot.overlay.visible ? "MATCH FLOW" : "COMBAT LIVE", "banner-kicker-text");
  updateText(hudElements.bannerTitle, snapshot.overlay.title || snapshot.phase, "banner-title-text");
  updateText(hudElements.bannerSubtitle, snapshot.overlay.subtitle || "Stay mobile and keep pressure on the lane.", "banner-subtitle-text");
  updateClassState(hudElements.bannerCard, "is-hidden", !snapshot.overlay.visible, "banner-hidden");
  updateText(hudElements.scoreText, `${snapshot.playerScore} : ${snapshot.dummyScore}`, "score-text");
  updateText(hudElements.roundText, `Round ${snapshot.roundNumber} / First to ${snapshot.scoreToWin}`, "round-text");
  updateText(hudElements.dummyHealthText, `${snapshot.dummyHealth}/${snapshot.dummyMaxHealth}`, "dummy-health-text");
  updateText(hudElements.spawnText, snapshot.spawn, "spawn-text");
  updateText(hudElements.eventText, toActionCallout(snapshot), "event-text");
  updateText(hudElements.gateText, snapshot.gateOpen ? "Gate Open" : "Gate Closed", "gate-text");
  updateText(hudElements.weaponSlotText, String(snapshot.weaponSlot), "weapon-slot-text");
  updateText(hudElements.ammoPickupText, formatPickupStatus(snapshot.ammoPickupLabel, "Ammo ready"), "ammo-pickup-text");
  updateText(hudElements.healthPickupText, formatPickupStatus(snapshot.healthPickupLabel, "Health ready"), "health-pickup-text");
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

function normalizeHudSnapshot(snapshot: HudSnapshot | null | undefined): HudSnapshot {
  return {
    phase: fallbackText(snapshot?.phase, "STAGE ENTRY"),
    team: fallbackText(snapshot?.team, "UNSET"),
    spawn: fallbackText(snapshot?.spawn, "Awaiting deployment"),
    activeWeapon: fallbackText(snapshot?.activeWeapon, "Carbine"),
    weaponSlot: fallbackNumber(snapshot?.weaponSlot, 1),
    ammoInMagazine: fallbackNumber(snapshot?.ammoInMagazine, gameBalance.magazineSize),
    reserveAmmo: fallbackNumber(snapshot?.reserveAmmo, gameBalance.reserveAmmo),
    isReloading: Boolean(snapshot?.isReloading),
    reloadProgress: clamp01(snapshot?.reloadProgress),
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
    overlay: {
      visible: Boolean(snapshot?.overlay?.visible),
      title: fallbackText(snapshot?.overlay?.title, ""),
      subtitle: fallbackText(snapshot?.overlay?.subtitle, "")
    }
  };
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
