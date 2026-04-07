export type WeaponCueId = "carbine" | "scatter" | "generic";
export type PickupCueId = "ammo" | "health";
export type GateCueId = "open" | "close";
export type MatchConfirmCueId = "ready" | "accept";

export type SoundCueKey =
  | `fire.${WeaponCueId}`
  | "hit.player"
  | "hit.dummy"
  | `pickup.${PickupCueId}`
  | `gate.${GateCueId}`
  | "hazard.tick"
  | `match.confirm.${MatchConfirmCueId}`;

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
      readonly kind: "match-confirm";
      readonly action: MatchConfirmCueId;
    };

export class SoundCueLogic {
  public resolveCue(event: SoundCueEvent): SoundCueKey {
    switch (event.kind) {
      case "fire":
        return `fire.${event.weaponId}`;
      case "hit":
        return event.target === "player" ? "hit.player" : "hit.dummy";
      case "pickup":
        return `pickup.${event.pickupId}`;
      case "gate":
        return `gate.${event.action}`;
      case "hazard":
        return "hazard.tick";
      case "match-confirm":
        return `match.confirm.${event.action}`;
    }
  }

  public resolveCues(events: readonly SoundCueEvent[]): SoundCueKey[] {
    return events.map((event) => this.resolveCue(event));
  }
}
