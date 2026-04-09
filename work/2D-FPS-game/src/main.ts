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

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (appRoot === null) {
  throw new Error("Missing #app root element.");
}

appRoot.innerHTML = `
  <div class="app-shell">
    <header class="shell-header">
      <div>
        <p class="eyebrow">VIBECODING FPS PROTOTYPE</p>
        <h1>Arena Strike</h1>
      </div>
      <div class="header-chip">browser build / local arena</div>
    </header>
    <main class="shell-main">
      <section class="stage-panel">
        <div class="hud-strip hud-strip--top">
          <section class="hud-card player-card">
            <p class="hud-label">Operator</p>
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
              <div>
                <p class="micro-label">Weapon</p>
                <strong id="weapon-name">Carbine</strong>
              </div>
              <div>
                <p class="micro-label">Ammo</p>
                <strong id="ammo-count">${gameBalance.magazineSize}/${gameBalance.reserveAmmo}</strong>
              </div>
            </div>
          </section>

          <section class="hud-card enemy-card">
            <p class="hud-label">Engagement</p>
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
          <div class="hud-overlay" aria-live="polite">
            <section id="banner-card" class="banner-card">
              <p id="banner-kicker" class="banner-kicker">MATCH FLOW</p>
              <h2 id="banner-title">ENTER STAGE</h2>
              <p id="banner-subtitle">Press ENTER to open team selection.</p>
            </section>
          </div>
        </div>

        <section class="hud-card support-card">
          <div class="support-grid">
            <div>
              <p class="micro-label">Last Event</p>
              <strong id="event-text">PRESS ENTER TO ENTER STAGE</strong>
            </div>
            <div>
              <p class="micro-label">Movement</p>
              <strong id="movement-text">Walk</strong>
            </div>
            <div>
              <p class="micro-label">Gate</p>
              <strong id="gate-text">Closed</strong>
            </div>
            <div>
              <p class="micro-label">Round Start</p>
              <strong id="round-start-text">LIVE</strong>
            </div>
          </div>
        </section>
      </section>

      <section class="ops-panel">
        <article class="ops-card">
          <p class="panel-kicker">Controls</p>
          <h2>FPS Inputs</h2>
          <p class="ops-copy">WASD move, Shift sprint, mouse or F fire, R reload, Q swap, E gate, Enter deploy.</p>
        </article>
        <article class="ops-card">
          <p class="panel-kicker">Round Ops</p>
          <h2>Live Match Feed</h2>
          <dl class="ops-grid">
            <div>
              <dt>Weapon Slot</dt>
              <dd id="weapon-slot-text">1</dd>
            </div>
            <div>
              <dt>Pickup Timers</dt>
              <dd><span id="ammo-pickup-text">READY</span> / <span id="health-pickup-text">READY</span></dd>
            </div>
            <div>
              <dt>Audio Cue</dt>
              <dd id="cue-text">NONE</dd>
            </div>
            <div>
              <dt>Debug Note</dt>
              <dd id="debug-text">Movement clear</dd>
            </div>
          </dl>
        </article>
        <article class="ops-card">
          <p class="panel-kicker">Arena Reads</p>
          <h2>Zone Guide</h2>
          <dl class="ops-grid ops-grid--guide">
            <div>
              <dt>Cover</dt>
              <dd>Blue cover markers show positions the dummy uses to break line of sight and recover.</dd>
            </div>
            <div>
              <dt>Vent</dt>
              <dd>The purple vent lane deals periodic damage while an actor remains inside it.</dd>
            </div>
            <div>
              <dt>Ammo</dt>
              <dd>Blue pickup refills reserve ammo, then disappears until its respawn timer finishes.</dd>
            </div>
            <div>
              <dt>Med</dt>
              <dd>Green pickup restores health and then enters cooldown before returning.</dd>
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
  weaponName: queryText("#weapon-name"),
  ammoCount: queryText("#ammo-count"),
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
  movementText: queryText("#movement-text"),
  gateText: queryText("#gate-text"),
  roundStartText: queryText("#round-start-text"),
  weaponSlotText: queryText("#weapon-slot-text"),
  ammoPickupText: queryText("#ammo-pickup-text"),
  healthPickupText: queryText("#health-pickup-text"),
  cueText: queryText("#cue-text"),
  debugText: queryText("#debug-text")
};

const onHudSnapshot = ((event: Event) => {
  const snapshot = (event as CustomEvent<HudSnapshot>).detail;
  renderHud(snapshot);
}) as EventListener;

window.addEventListener(HUD_SNAPSHOT_EVENT, onHudSnapshot);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  parent: gameContainer,
  backgroundColor: "#09111f",
  scene: [mainScene]
});

window.__FPS_GAME__ = game;

window.addEventListener("beforeunload", () => {
  window.removeEventListener(HUD_SNAPSHOT_EVENT, onHudSnapshot);
  game.destroy(true);
  delete window.__FPS_GAME__;
});

function renderHud(snapshot: HudSnapshot): void {
  hudElements.teamChip.textContent = snapshot.team;
  hudElements.teamChip.classList.toggle("team-chip--blue", snapshot.team === "BLUE");
  hudElements.teamChip.classList.toggle("team-chip--red", snapshot.team === "RED");
  hudElements.phaseChip.textContent = snapshot.phase;
  hudElements.playerHealthText.textContent = `${snapshot.playerHealth}/${snapshot.playerMaxHealth}`;
  hudElements.weaponName.textContent = snapshot.activeWeapon;
  hudElements.ammoCount.textContent = `${snapshot.ammoInMagazine}/${snapshot.reserveAmmo}`;
  hudElements.bannerKicker.textContent = snapshot.overlay.visible ? "MATCH FLOW" : "COMBAT LIVE";
  hudElements.bannerTitle.textContent = snapshot.overlay.title || snapshot.phase;
  hudElements.bannerSubtitle.textContent = snapshot.overlay.subtitle || "Stay mobile and keep pressure on the lane.";
  hudElements.bannerCard.classList.toggle("is-hidden", !snapshot.overlay.visible);
  hudElements.scoreText.textContent = `${snapshot.playerScore} : ${snapshot.dummyScore}`;
  hudElements.roundText.textContent = `Round ${snapshot.roundNumber} / First to ${snapshot.scoreToWin}`;
  hudElements.dummyHealthText.textContent = `${snapshot.dummyHealth}/${snapshot.dummyMaxHealth}`;
  hudElements.spawnText.textContent = snapshot.spawn;
  hudElements.eventText.textContent = snapshot.lastEvent;
  hudElements.movementText.textContent = snapshot.movementMode;
  hudElements.gateText.textContent = snapshot.gateOpen ? "Open" : "Closed";
  hudElements.roundStartText.textContent = snapshot.roundStartLabel;
  hudElements.weaponSlotText.textContent = String(snapshot.weaponSlot);
  hudElements.ammoPickupText.textContent = snapshot.ammoPickupLabel;
  hudElements.healthPickupText.textContent = snapshot.healthPickupLabel;
  hudElements.cueText.textContent = snapshot.lastSoundCue;
  hudElements.debugText.textContent = snapshot.movementBlocked ? "Spawn or collision check needed" : "Movement clear";

  setMeterWidth(hudElements.playerHealthFill, snapshot.playerHealth, snapshot.playerMaxHealth);
  setMeterWidth(hudElements.dummyHealthFill, snapshot.dummyHealth, snapshot.dummyMaxHealth);
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
