import {
  InputSequenceGuard,
  MAX_ONLINE_ACTORS,
  MAX_ONLINE_ROOM_ID_LENGTH,
  parseOnlineClientMessage,
  parseOnlineServerMessage
} from "../src/domain/network/OnlineBattleProtocol";
import { createActorId } from "../src/domain/round/BattleRosterLogic";

describe("OnlineBattleProtocol", () => {
  it.each([
    { v: 1, type: "join", requestId: "request-1", roomId: "room-1", preferredTeam: "RED" },
    {
      v: 1,
      type: "input",
      actorId: "actor-1",
      sequence: 7,
      clientTick: 120,
      command: { sequence: 7, moveX: 1, moveY: -1, aimRadians: Math.PI, fire: true, reload: false, weaponSlot: 2 }
    },
    { v: 1, type: "leave", requestId: "request-2" }
  ])("accepts valid client message $type", (message) => {
    expect(parseOnlineClientMessage(message).ok).toBe(true);
  });

  it.each([
    { v: 1, type: "joined", requestId: "request-1", actorId: "actor-1", team: "BLUE", serverTick: 10 },
    {
      v: 1,
      type: "snapshot",
      sequence: 4,
      serverTick: 20,
      actors: [{ id: "actor-1", team: "BLUE", x: 10, y: 20, aimRadians: 0, health: 90, maxHealth: 100, weaponId: "carbine", ammo: 5, alive: true }]
    },
    { v: 1, type: "event", sequence: 5, event: { type: "damage", sourceId: "actor-1", targetId: "enemy-1", amount: 10, healthAfter: 90 } },
    { v: 1, type: "rejected", requestId: "request-3", code: "INVALID_MESSAGE" }
  ])("accepts valid server message $type", (message) => {
    expect(parseOnlineServerMessage(message).ok).toBe(true);
  });

  it("rejects unknown versions and message types without throwing", () => {
    expect(parseOnlineClientMessage({ v: 2, type: "join", requestId: "r", roomId: "room" })).toEqual({ ok: false, code: "UNSUPPORTED_VERSION" });
    expect(parseOnlineClientMessage({ v: 1, type: "teleport" })).toEqual({ ok: false, code: "UNKNOWN_TYPE" });
    expect(parseOnlineServerMessage({ v: 99, type: "snapshot" })).toEqual({ ok: false, code: "UNSUPPORTED_VERSION" });
  });

  it("rejects invalid numeric command and snapshot fields", () => {
    const invalidInput = {
      v: 1,
      type: "input",
      actorId: "actor-1",
      sequence: 1,
      clientTick: 1,
      command: { sequence: 1, moveX: 1.01, moveY: 0, aimRadians: Number.POSITIVE_INFINITY, fire: true, reload: false, weaponSlot: 7 }
    };
    const invalidSnapshot = {
      v: 1,
      type: "snapshot",
      sequence: 1,
      serverTick: 1,
      actors: [{ id: "actor-1", team: "BLUE", x: Number.NaN, y: 0, aimRadians: 0, health: 10, maxHealth: 100, weaponId: "carbine", ammo: 1, alive: true }]
    };

    expect(parseOnlineClientMessage(invalidInput)).toEqual({ ok: false, code: "INVALID_COMMAND" });
    expect(parseOnlineServerMessage(invalidSnapshot)).toEqual({ ok: false, code: "INVALID_SNAPSHOT" });
  });

  it("enforces bounded identifiers and snapshot collections", () => {
    const longRoomId = "r".repeat(MAX_ONLINE_ROOM_ID_LENGTH + 1);
    const actors = Array.from({ length: MAX_ONLINE_ACTORS + 1 }, (_, index) => ({
      id: `actor-${index}`,
      team: index % 2 === 0 ? "BLUE" : "RED",
      x: index,
      y: index,
      aimRadians: 0,
      health: 100,
      maxHealth: 100,
      weaponId: "carbine",
      ammo: 1,
      alive: true
    }));

    expect(parseOnlineClientMessage({ v: 1, type: "join", requestId: "request", roomId: longRoomId })).toEqual({ ok: false, code: "INVALID_ID" });
    expect(parseOnlineServerMessage({ v: 1, type: "snapshot", sequence: 1, serverTick: 1, actors })).toEqual({ ok: false, code: "TOO_MANY_ACTORS" });
  });

  it("rejects mismatched command sequences and an unexpected actor identity", () => {
    const message = {
      v: 1,
      type: "input",
      actorId: "actor-1",
      sequence: 2,
      clientTick: 1,
      command: { sequence: 1, moveX: 0, moveY: 0, aimRadians: 0, fire: false, reload: false, weaponSlot: null }
    };

    expect(parseOnlineClientMessage(message)).toEqual({ ok: false, code: "SEQUENCE_MISMATCH" });
    expect(parseOnlineClientMessage({ ...message, command: { ...message.command, sequence: 2 } }, { expectedActorId: createActorId("actor-2") }))
      .toEqual({ ok: false, code: "ACTOR_MISMATCH" });
  });

  it("accepts only increasing input sequences per actor and resets idempotently", () => {
    const guard = new InputSequenceGuard();
    const actorOne = createActorId("actor-1");
    const actorTwo = createActorId("actor-2");

    expect(guard.accept(actorOne, 4)).toBe(true);
    expect(guard.accept(actorOne, 4)).toBe(false);
    expect(guard.accept(actorOne, 3)).toBe(false);
    expect(guard.accept(actorOne, 5)).toBe(true);
    expect(guard.accept(actorTwo, 1)).toBe(true);
    guard.reset(actorOne);
    guard.reset(actorOne);
    expect(guard.accept(actorOne, 1)).toBe(true);
    expect(guard.accept(actorTwo, 1)).toBe(false);
    guard.reset();
    guard.reset();
    expect(guard.accept(actorTwo, 0)).toBe(true);
  });
});
