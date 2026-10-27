import type { TeamId } from "./MatchFlowLogic";

declare const actorIdBrand: unique symbol;

export type ActorId = string & { readonly [actorIdBrand]: true };
export type ControllerKind = "human" | "cpu" | "remote";

export interface BattleActorDescriptor {
  readonly id: ActorId;
  readonly team: TeamId;
  readonly controller: ControllerKind;
}

export interface BattleActorSnapshot extends BattleActorDescriptor {
  readonly alive: boolean;
}

interface BattleActorEntry {
  readonly id: ActorId;
  team: TeamId;
  readonly controller: ControllerKind;
  alive: boolean;
}

const MAX_ACTOR_ID_LENGTH = 64;
const ACTOR_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

export function createActorId(value: string): ActorId {
  if (value.length === 0 || value.length > MAX_ACTOR_ID_LENGTH || !ACTOR_ID_PATTERN.test(value)) {
    throw new Error("Actor IDs must be 1-64 URL-safe characters.");
  }
  return value as ActorId;
}

export class BattleRosterLogic {
  private readonly entries = new Map<ActorId, BattleActorEntry>();

  public add(descriptor: BattleActorDescriptor): boolean {
    if (this.entries.has(descriptor.id)) return false;
    this.entries.set(descriptor.id, { ...descriptor, alive: true });
    return true;
  }

  public remove(actorId: ActorId): boolean {
    return this.entries.delete(actorId);
  }

  public all(): readonly BattleActorSnapshot[] {
    return Object.freeze(Array.from(this.entries.values(), freezeSnapshot));
  }

  public living(team?: TeamId): readonly BattleActorSnapshot[] {
    return Object.freeze(Array.from(this.entries.values())
      .filter((entry) => entry.alive && (team === undefined || entry.team === team))
      .map(freezeSnapshot));
  }

  public opponentIds(team: TeamId): readonly ActorId[] {
    return Object.freeze(Array.from(this.entries.values())
      .filter((entry) => entry.alive && entry.team !== team)
      .map((entry) => entry.id));
  }

  public setAlive(actorId: ActorId, alive: boolean): boolean {
    const entry = this.entries.get(actorId);
    if (entry === undefined) return false;
    entry.alive = alive;
    return true;
  }

  public setTeam(actorId: ActorId, team: TeamId): boolean {
    const entry = this.entries.get(actorId);
    if (entry === undefined) return false;
    entry.team = team;
    return true;
  }

  public hasLivingTeamMember(team: TeamId): boolean {
    return Array.from(this.entries.values()).some((entry) => entry.team === team && entry.alive);
  }

  public getEliminatedTeam(): TeamId | null {
    const blueEntries = Array.from(this.entries.values()).filter((entry) => entry.team === "BLUE");
    const redEntries = Array.from(this.entries.values()).filter((entry) => entry.team === "RED");
    const blueEliminated = blueEntries.length > 0 && blueEntries.every((entry) => !entry.alive);
    const redEliminated = redEntries.length > 0 && redEntries.every((entry) => !entry.alive);

    if (blueEliminated === redEliminated) return null;
    return blueEliminated ? "BLUE" : "RED";
  }

  public reset(): void {
    for (const entry of this.entries.values()) entry.alive = true;
  }
}

function freezeSnapshot(entry: BattleActorEntry): BattleActorSnapshot {
  return Object.freeze({
    id: entry.id,
    team: entry.team,
    controller: entry.controller,
    alive: entry.alive
  });
}
