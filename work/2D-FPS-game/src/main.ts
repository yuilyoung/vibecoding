import Phaser from "phaser";
import gameBalance from "../assets/data/game-balance.json";
import { MainScene } from "./scenes/MainScene";
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
    <header class="top-bar">
      <div>
        <p class="eyebrow">MATCH FLOW ONLINE</p>
        <h1>2D FPS Arena</h1>
      </div>
      <div class="status-chip">ctx: local / status: playable</div>
    </header>
    <main class="layout">
      <section class="stage-panel">
        <div id="game-root" class="game-root"></div>
      </section>
      <aside class="hud-panel">
        <h2>Session Brief</h2>
        <dl class="meta-list">
          <div>
            <dt>Match Flow</dt>
            <dd>Stage -> Team -> Deploy</dd>
          </div>
          <div>
            <dt>Weapon Set</dt>
            <dd>Carbine / Scatter</dd>
          </div>
          <div>
            <dt>Win Condition</dt>
            <dd>First to ${gameBalance.matchScoreToWin}</dd>
          </div>
          <div>
            <dt>Max Health</dt>
            <dd>${gameBalance.maxHealth}</dd>
          </div>
        </dl>
        <p class="hint">
          Press Enter to enter the arena, choose a team with 1 or 2, then deploy into a
          random spawn. Use WASD to move, mouse or F to fire, R to reload, and E to toggle the gate.
        </p>
      </aside>
    </main>
  </div>
`;

const gameContainer = document.querySelector<HTMLDivElement>("#game-root");

if (gameContainer === null) {
  throw new Error("Missing #game-root element.");
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  parent: gameContainer,
  backgroundColor: "#09111f",
  scene: [new MainScene(gameBalance)]
});

window.__FPS_GAME__ = game;

window.addEventListener("beforeunload", () => {
  game.destroy(true);
  delete window.__FPS_GAME__;
});
