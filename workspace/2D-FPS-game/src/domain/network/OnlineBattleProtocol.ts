import type { ActorId } from "../round/BattleRosterLogic";
import type { TeamId } from "../round/MatchFlowLogic";

export const MAX_ONLINE_ROOM_ID_LENGTH = 64;
export const MAX_ONLINE_REQUEST_ID_LENGTH = 64;
export const MAX_ONLINE_ACTOR_ID_LENGTH = 64;
export const MAX_ONLINE_WEAPON_ID_LENGTH = 32;
export const MAX_ONLINE_ACTORS = 16;

export interface ActorCommand {
  readonly sequence: number;
  readonly moveX: number;
  readonly moveY: number;
  readonly aimRadians: number;
  readonly fire: boolean;
  readonly reload: boolean;
  readonly weaponSlot: number | null;
}

export interface ActorSnapshot {
  readonly id: ActorId;
  readonly team: TeamId;
  readonly x: number;
  readonly y: number;
  readonly aimRadians: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly weaponId: string;
  readonly ammo: number;
  readonly alive: boolean;
}

export type AuthoritativeBattleEvent =
  | { readonly type: "damage"; readonly sourceId: ActorId; readonly targetId: ActorId; readonly amount: number; readonly healthAfter: number }
  | { readonly type: "eliminated"; readonly actorId: ActorId }
  | { readonly type: "round-ended"; readonly winnerTeam: TeamId };

export type OnlineClientMessage =
  | { readonly v: 1; readonly type: "join"; readonly requestId: string; readonly roomId: string; readonly preferredTeam?: TeamId }
  | { readonly v: 1; readonly type: "input"; readonly actorId: ActorId; readonly sequence: number; readonly clientTick: number; readonly command: ActorCommand }
  | { readonly v: 1; readonly type: "leave"; readonly requestId: string };

export type OnlineServerMessage =
  | { readonly v: 1; readonly type: "joined"; readonly requestId: string; readonly actorId: ActorId; readonly team: TeamId; readonly serverTick: number }
  | { readonly v: 1; readonly type: "snapshot"; readonly sequence: number; readonly serverTick: number; readonly actors: readonly ActorSnapshot[] }
  | { readonly v: 1; readonly type: "event"; readonly sequence: number; readonly event: AuthoritativeBattleEvent }
  | { readonly v: 1; readonly type: "rejected"; readonly requestId?: string; readonly code: OnlineErrorCode };

export type OnlineErrorCode =
  | "INVALID_MESSAGE"
  | "UNSUPPORTED_VERSION"
  | "UNKNOWN_TYPE"
  | "INVALID_ID"
  | "INVALID_COMMAND"
  | "INVALID_SNAPSHOT"
  | "INVALID_EVENT"
  | "SEQUENCE_MISMATCH"
  | "ACTOR_MISMATCH"
  | "TOO_MANY_ACTORS"
  | "ROOM_FULL"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "DISCONNECTED";

export type ProtocolValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: OnlineErrorCode };

export interface ClientMessageValidationContext {
  readonly expectedActorId?: ActorId;
}

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const ERROR_CODES: readonly OnlineErrorCode[] = [
  "INVALID_MESSAGE", "UNSUPPORTED_VERSION", "UNKNOWN_TYPE", "INVALID_ID", "INVALID_COMMAND",
  "INVALID_SNAPSHOT", "INVALID_EVENT", "SEQUENCE_MISMATCH", "ACTOR_MISMATCH", "TOO_MANY_ACTORS",
  "ROOM_FULL", "UNAUTHORIZED", "RATE_LIMITED", "DISCONNECTED"
];

export function parseOnlineClientMessage(
  input: unknown,
  context: ClientMessageValidationContext = {}
): ProtocolValidationResult<OnlineClientMessage> {
  if (!isRecord(input)) return invalid("INVALID_MESSAGE");
  if (input.v !== 1) return invalid("UNSUPPORTED_VERSION");
  if (typeof input.type !== "string") return invalid("UNKNOWN_TYPE");

  if (input.type === "join") {
    if (!isIdentifier(input.requestId, MAX_ONLINE_REQUEST_ID_LENGTH) || !isIdentifier(input.roomId, MAX_ONLINE_ROOM_ID_LENGTH)) {
      return invalid("INVALID_ID");
    }
    if (input.preferredTeam !== undefined && !isTeamId(input.preferredTeam)) return invalid("INVALID_MESSAGE");
    return valid({
      v: 1,
      type: "join",
      requestId: input.requestId,
      roomId: input.roomId,
      ...(input.preferredTeam === undefined ? {} : { preferredTeam: input.preferredTeam })
    });
  }

  if (input.type === "leave") {
    return isIdentifier(input.requestId, MAX_ONLINE_REQUEST_ID_LENGTH)
      ? valid({ v: 1, type: "leave", requestId: input.requestId })
      : invalid("INVALID_ID");
  }

  if (input.type === "input") {
    if (!isIdentifier(input.actorId, MAX_ONLINE_ACTOR_ID_LENGTH)) return invalid("INVALID_ID");
    if (context.expectedActorId !== undefined && input.actorId !== context.expectedActorId) return invalid("ACTOR_MISMATCH");
    if (!isSequence(input.sequence) || !isSequence(input.clientTick) || !isActorCommand(input.command)) return invalid("INVALID_COMMAND");
    if (input.command.sequence !== input.sequence) return invalid("SEQUENCE_MISMATCH");
    return valid({
      v: 1,
      type: "input",
      actorId: input.actorId as ActorId,
      sequence: input.sequence,
      clientTick: input.clientTick,
      command: { ...input.command }
    });
  }

  return invalid("UNKNOWN_TYPE");
}

export function parseOnlineServerMessage(input: unknown): ProtocolValidationResult<OnlineServerMessage> {
  if (!isRecord(input)) return invalid("INVALID_MESSAGE");
  if (input.v !== 1) return invalid("UNSUPPORTED_VERSION");
  if (typeof input.type !== "string") return invalid("UNKNOWN_TYPE");

  if (input.type === "joined") {
    if (!isIdentifier(input.requestId, MAX_ONLINE_REQUEST_ID_LENGTH) || !isIdentifier(input.actorId, MAX_ONLINE_ACTOR_ID_LENGTH)) {
      return invalid("INVALID_ID");
    }
    if (!isTeamId(input.team) || !isSequence(input.serverTick)) return invalid("INVALID_MESSAGE");
    return valid({ v: 1, type: "joined", requestId: input.requestId, actorId: input.actorId as ActorId, team: input.team, serverTick: input.serverTick });
  }

  if (input.type === "snapshot") {
    if (!isSequence(input.sequence) || !isSequence(input.serverTick) || !Array.isArray(input.actors)) return invalid("INVALID_SNAPSHOT");
    if (input.actors.length > MAX_ONLINE_ACTORS) return invalid("TOO_MANY_ACTORS");
    if (!input.actors.every(isActorSnapshot)) return invalid("INVALID_SNAPSHOT");
    return valid({ v: 1, type: "snapshot", sequence: input.sequence, serverTick: input.serverTick, actors: input.actors.map((actor) => ({ ...actor })) });
  }

  if (input.type === "event") {
    if (!isSequence(input.sequence) || !isBattleEvent(input.event)) return invalid("INVALID_EVENT");
    return valid({ v: 1, type: "event", sequence: input.sequence, event: { ...input.event } as AuthoritativeBattleEvent });
  }

  if (input.type === "rejected") {
    if (input.requestId !== undefined && !isIdentifier(input.requestId, MAX_ONLINE_REQUEST_ID_LENGTH)) return invalid("INVALID_ID");
    if (typeof input.code !== "string" || !ERROR_CODES.includes(input.code as OnlineErrorCode)) return invalid("INVALID_MESSAGE");
    return valid({ v: 1, type: "rejected", ...(input.requestId === undefined ? {} : { requestId: input.requestId }), code: input.code as OnlineErrorCode });
  }

  return invalid("UNKNOWN_TYPE");
}

export class InputSequenceGuard {
  private readonly lastSequences = new Map<ActorId, number>();

  public accept(actorId: ActorId, sequence: number): boolean {
    if (!isSequence(sequence)) return false;
    const previous = this.lastSequences.get(actorId);
    if (previous !== undefined && sequence <= previous) return false;
    this.lastSequences.set(actorId, sequence);
    return true;
  }

  public reset(actorId?: ActorId): void {
    if (actorId === undefined) this.lastSequences.clear();
    else this.lastSequences.delete(actorId);
  }
}

function isActorCommand(input: unknown): input is ActorCommand {
  return isRecord(input) &&
    isSequence(input.sequence) &&
    isFiniteNumberInRange(input.moveX, -1, 1) &&
    isFiniteNumberInRange(input.moveY, -1, 1) &&
    isFiniteNumberInRange(input.aimRadians, -Math.PI, Math.PI) &&
    typeof input.fire === "boolean" &&
    typeof input.reload === "boolean" &&
    (input.weaponSlot === null || (Number.isInteger(input.weaponSlot) && (input.weaponSlot as number) >= 1 && (input.weaponSlot as number) <= 6));
}

function isActorSnapshot(input: unknown): input is ActorSnapshot {
  return isRecord(input) &&
    isIdentifier(input.id, MAX_ONLINE_ACTOR_ID_LENGTH) &&
    isTeamId(input.team) &&
    isFiniteNumber(input.x) && isFiniteNumber(input.y) &&
    isFiniteNumberInRange(input.aimRadians, -Math.PI, Math.PI) &&
    isFiniteNumberInRange(input.health, 0, Number.MAX_SAFE_INTEGER) &&
    isFiniteNumberInRange(input.maxHealth, 1, Number.MAX_SAFE_INTEGER) &&
    (input.health as number) <= (input.maxHealth as number) &&
    isIdentifier(input.weaponId, MAX_ONLINE_WEAPON_ID_LENGTH) &&
    Number.isInteger(input.ammo) && (input.ammo as number) >= 0 &&
    typeof input.alive === "boolean";
}

function isBattleEvent(input: unknown): input is AuthoritativeBattleEvent {
  if (!isRecord(input) || typeof input.type !== "string") return false;
  if (input.type === "damage") {
    return isIdentifier(input.sourceId, MAX_ONLINE_ACTOR_ID_LENGTH) &&
      isIdentifier(input.targetId, MAX_ONLINE_ACTOR_ID_LENGTH) &&
      isFiniteNumberInRange(input.amount, 0, Number.MAX_SAFE_INTEGER) &&
      isFiniteNumberInRange(input.healthAfter, 0, Number.MAX_SAFE_INTEGER);
  }
  if (input.type === "eliminated") return isIdentifier(input.actorId, MAX_ONLINE_ACTOR_ID_LENGTH);
  if (input.type === "round-ended") return isTeamId(input.winnerTeam);
  return false;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isIdentifier(input: unknown, maxLength: number): input is string {
  return typeof input === "string" && input.length > 0 && input.length <= maxLength && ID_PATTERN.test(input);
}

function isTeamId(input: unknown): input is TeamId {
  return input === "BLUE" || input === "RED";
}

function isSequence(input: unknown): input is number {
  return Number.isSafeInteger(input) && (input as number) >= 0;
}

function isFiniteNumber(input: unknown): input is number {
  return typeof input === "number" && Number.isFinite(input);
}

function isFiniteNumberInRange(input: unknown, min: number, max: number): input is number {
  return isFiniteNumber(input) && input >= min && input <= max;
}

function valid<T>(value: T): ProtocolValidationResult<T> {
  return { ok: true, value };
}

function invalid<T>(code: OnlineErrorCode): ProtocolValidationResult<T> {
  return { ok: false, code };
}
