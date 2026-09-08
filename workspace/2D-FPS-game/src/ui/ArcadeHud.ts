import { advanceArcadeHud, createArcadeHudState, getWeaponReadiness } from "./arcade-hud-state";
import type { HudSnapshot } from "./hud-events";

const element = (id: string): HTMLElement => {
  const result = document.getElementById(id);
  if (result === null) throw new Error(`Missing arcade HUD element: ${id}`);
  return result;
};

/** Passive page-lifetime view. All values come from the scene's HUD snapshot. */
export class ArcadeHud {
  private state = createArcadeHudState();
  private readonly notice = element("combat-feedback");
  private readonly flash = element("damage-flash");
  private readonly energy = element("energy-panel");
  private readonly meter = element("energy-meter");
  private readonly energyStatus = element("energy-status");
  private readonly readiness = element("weapon-readiness");
  private readonly scoreboard = document.querySelector<HTMLElement>(".match-scoreboard")!;
  private readonly playerBadge = document.querySelector<HTMLElement>(".player-card .operator-badge, .player-card .cozy-mascot")!;
  private readonly enemyBadge = document.querySelector<HTMLElement>(".enemy-card .operator-badge, .enemy-card .cozy-mascot")!;

  public render(snapshot: HudSnapshot, now = performance.now()): void {
    this.state = advanceArcadeHud(this.state, snapshot, now);
    const notice = this.state.notice;
    const text = notice?.text ?? "";
    if (this.notice.textContent !== text) this.notice.textContent = text;
    this.notice.dataset.kind = notice?.kind ?? "none";
    this.flash.classList.toggle("is-active", this.state.damageUntil > now);
    this.scoreboard.classList.toggle("did-score", notice?.kind === "score");
    const low = snapshot.playerHealth > 0 && snapshot.playerHealth / snapshot.playerMaxHealth <= 0.3;
    this.energy.dataset.state = snapshot.playerHealth <= 0 ? "dead" : low ? "low" : "healthy";
    this.meter.setAttribute("aria-valuemax", String(snapshot.playerMaxHealth));
    this.meter.setAttribute("aria-valuenow", String(Math.max(0, Math.min(snapshot.playerMaxHealth, snapshot.playerHealth))));
    this.energyStatus.textContent = snapshot.playerHealth <= 0 ? "KNOCKED OUT" : low ? "LOW ENERGY · FIND MED" : "BATTLE READY";
    const readiness = getWeaponReadiness(snapshot);
    this.readiness.textContent = readiness.label;
    this.readiness.dataset.state = readiness.kind;
    this.readiness.style.setProperty("--ready-progress", `${Math.round(readiness.progress * 100)}%`);
    // Badge color follows the chosen team; typography also identifies YOU/RIVAL.
    if (this.playerBadge.classList.contains("cozy-mascot")) {
      this.playerBadge.classList.toggle("cozy-mascot--rival", snapshot.team === "RED");
      this.enemyBadge.classList.toggle("cozy-mascot--rival", snapshot.team !== "RED");
      this.playerBadge.setAttribute("aria-label", `${snapshot.team === "RED" ? "Red" : "Blue"} arcade friend`);
      this.enemyBadge.setAttribute("aria-label", `${snapshot.team === "RED" ? "Blue" : "Red"} arcade friend`);
      return;
    }
    this.playerBadge.classList.toggle("operator-badge--red", snapshot.team === "RED");
    this.playerBadge.classList.toggle("operator-badge--blue", snapshot.team !== "RED");
    this.enemyBadge.classList.toggle("operator-badge--red", snapshot.team !== "RED");
    this.enemyBadge.classList.toggle("operator-badge--blue", snapshot.team === "RED");
    this.playerBadge.setAttribute("aria-label", `${snapshot.team === "RED" ? "Red" : "Blue"} Vanguard`);
    this.enemyBadge.setAttribute("aria-label", `${snapshot.team === "RED" ? "Blue" : "Red"} Vanguard`);
  }
}
