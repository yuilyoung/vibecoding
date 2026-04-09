export type WeaponCueId = "carbine" | "scatter" | "generic";
export type PickupCueId = "ammo" | "health";
export type GateCueId = "open" | "close";
export type MatchConfirmCueId = "ready" | "accept";
export type DeflectCueId = "ricochet" | "shield";
export type ReloadCueId = "start" | "complete" | "empty";
export type WeaponStateCueId = "swap";

export type SoundCueKey =
  | `fire.${WeaponCueId}`
  | "hit.player"
  | "hit.dummy"
  | `deflect.${DeflectCueId}`
  | `pickup.${PickupCueId}`
  | `gate.${GateCueId}`
  | "hazard.tick"
  | `reload.${ReloadCueId}`
  | `weapon.${WeaponStateCueId}`
  | `match.confirm.${MatchConfirmCueId}`
  | "match.start";

export type SoundCueEvent =
  | {
      readonly kind: "fire";
      readonly weaponId: WeaponCueId;
    }
  | {
      readonly kind: "hit";
      readonly target: "player" | "dummy";
    }
  | {
      readonly kind: "deflect";
      readonly mode: DeflectCueId;
    }
  | {
      readonly kind: "pickup";
      readonly pickupId: PickupCueId;
    }
  | {
      readonly kind: "gate";
      readonly action: GateCueId;
    }
  | {
      readonly kind: "hazard";
      readonly source: "vent";
    }
  | {
      readonly kind: "reload";
      readonly action: ReloadCueId;
    }
  | {
      readonly kind: "weapon";
      readonly action: WeaponStateCueId;
    }
  | {
      readonly kind: "weapon-state";
      readonly action: WeaponStateCueId;
    }
  | {
      readonly kind: "match-confirm";
      readonly action: MatchConfirmCueId;
    }
  | {
      readonly kind: "match-start";
    };

export class SoundCueLogic {
  public resolveCue(event: SoundCueEvent): SoundCueKey {
    switch (event.kind) {
      case "fire":
        return `fire.${event.weaponId}`;
      case "hit":
        return event.target === "player" ? "hit.player" : "hit.dummy";
      case "deflect":
        return `deflect.${event.mode}`;
      case "pickup":
        return `pickup.${event.pickupId}`;
      case "gate":
        return `gate.${event.action}`;
      case "hazard":
        return "hazard.tick";
      case "reload":
        return `reload.${event.action}`;
      case "weapon":
      case "weapon-state":
        return `weapon.${event.action}`;
      case "match-confirm":
        return `match.confirm.${event.action}`;
      case "match-start":
        return "match.start";
    }
  }

  public resolveCues(events: readonly SoundCueEvent[]): SoundCueKey[] {
    return events.map((event) => this.resolveCue(event));
  }
}
