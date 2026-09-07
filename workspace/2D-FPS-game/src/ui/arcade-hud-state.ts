import type { HudSnapshot } from "./hud-events";

export interface CombatNotice {
  readonly kind: "damage" | "hit" | "heal" | "score" | "defeat" | "weapon";
  readonly text: string;
  readonly expiresAt: number;
}

export interface ArcadeHudState {
  readonly notice: CombatNotice | null;
  readonly damageUntil: number;
  readonly previous: HudSnapshot | null;
}

export const createArcadeHudState = (): ArcadeHudState => ({ notice: null, damageUntil: 0, previous: null });

export function advanceArcadeHud(state: ArcadeHudState, snapshot: HudSnapshot, now: number): ArcadeHudState {
  const previous = state.previous;
  const scored = previous !== null && snapshot.playerScore > previous.playerScore;
  const lost = previous !== null && snapshot.dummyScore > previous.dummyScore;
  const reset = previous === null || snapshot.team !== previous.team ||
    previous.phase === "STAGE ENTRY" || previous.phase === "TEAM SELECT" ||
    ((snapshot.phase === "ROUND START" || snapshot.phase === "DEPLOYING") && !scored && !lost) ||
    snapshot.phase === "STAGE ENTRY" || snapshot.phase === "TEAM SELECT" ||
    snapshot.playerScore < previous.playerScore || snapshot.dummyScore < previous.dummyScore ||
    (snapshot.roundNumber !== previous.roundNumber && !scored && !lost) ||
    (previous.playerHealth <= 0 && snapshot.playerHealth > 0);
  if (reset) return { previous: snapshot, notice: null, damageUntil: 0 };

  let notice = state.notice !== null && now < state.notice.expiresAt ? state.notice : null;
  let damageUntil = state.damageUntil;
  const damage = previous.playerHealth - snapshot.playerHealth;
  const enemyDamage = previous.dummyHealth - snapshot.dummyHealth;
  if (damage > 0) damageUntil = now + 360;
  const emit = (kind: CombatNotice["kind"], text: string, duration = 1400): CombatNotice => ({ kind, text, expiresAt: now + duration });
  if (scored) notice = emit("score", "+1 · ROUND WON!", 1800);
  else if (lost) notice = emit("defeat", "ROUND LOST · GET READY", 1800);
  else if (damage > 0) notice = emit("damage", snapshot.playerHealth <= 0 ? "KNOCKED OUT" : `−${damage} HP · YOU WERE HIT`, 1000);
  else if (snapshot.playerHealth > previous.playerHealth) notice = emit("heal", `+${snapshot.playerHealth - previous.playerHealth} HP · RECOVERED`);
  else if (snapshot.weaponSlot !== previous.weaponSlot) notice = emit("weapon", `${snapshot.activeWeapon.toUpperCase()} EQUIPPED`, 1000);
  else if (enemyDamage > 0 && (notice === null || notice.kind === "hit")) notice = emit("hit", `HIT! −${enemyDamage}`, 650);
  return { previous: snapshot, notice, damageUntil };
}

export function getWeaponReadiness(snapshot: HudSnapshot): { label: string; kind: string; progress: number } {
  if (snapshot.isReloading) return { label: "RELOADING", kind: "reload", progress: snapshot.reloadProgress };
  if (snapshot.ammoInMagazine <= 0) return { label: snapshot.reserveAmmo > 0 ? "EMPTY · R TO RELOAD" : "NO AMMO · FIND PICKUP", kind: "empty", progress: 0 };
  if (snapshot.cooldownRemainingMs > 0) return {
    label: `READY IN ${(snapshot.cooldownRemainingMs / 1000).toFixed(1)}s`,
    kind: "cooldown",
    progress: snapshot.cooldownDurationMs > 0 ? Math.max(0, Math.min(1, 1 - snapshot.cooldownRemainingMs / snapshot.cooldownDurationMs)) : 0
  };
  return { label: "READY", kind: "ready", progress: 1 };
}
