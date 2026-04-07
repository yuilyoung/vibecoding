import Phaser from "phaser";
import gameBalance from "../assets/data/game-balance.json";
import { MainScene } from "./scenes/MainScene";
import "./styles.css";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (appRoot === null) {
  throw new Error("Missing #app root element.");
}

appRoot.innerHTML = `
  <div class="app-shell">
    <header class="top-bar">
      <div>
        <p class="eyebrow">HARNESS READY</p>
        <h1>2D FPS Prototype</h1>
      </div>
      <div class="status-chip">ctx: local / status: runnable</div>
    </header>
    <main class="layout">
      <section class="stage-panel">
        <div id="game-root" class="game-root"></div>
      </section>
      <aside class="hud-panel">
        <h2>Current Context</h2>
        <dl class="meta-list">
          <div>
            <dt>Renderer</dt>
            <dd>Phaser + Vite</dd>
          </div>
          <div>
            <dt>Movement Speed</dt>
            <dd>${gameBalance.movementSpeed}</dd>
          </div>
          <div>
            <dt>Bullet Speed</dt>
            <dd>${gameBalance.bulletSpeed}</dd>
          </div>
          <div>
            <dt>Max Health</dt>
            <dd>${gameBalance.maxHealth}</dd>
          </div>
        </dl>
        <p class="hint">
          WASD to move. Space to sprint. This harness proves build, type-check, and
          test wiring before gameplay implementation.
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

window.addEventListener("beforeunload", () => {
  game.destroy(true);
});
