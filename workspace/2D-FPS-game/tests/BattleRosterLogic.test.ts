import { BattleRosterLogic, createActorId } from "../src/domain/round/BattleRosterLogic";

describe("BattleRosterLogic", () => {
  it("rejects duplicate actor identities across teams", () => {
    const roster = new BattleRosterLogic();
    const actorId = createActorId("actor-1");

    expect(roster.add({ id: actorId, team: "BLUE", controller: "human" })).toBe(true);
    expect(roster.add({ id: actorId, team: "RED", controller: "cpu" })).toBe(false);
    expect(roster.all()).toHaveLength(1);
  });

  it("tracks living actors and opponents for both teams", () => {
    const roster = createRoster();

    expect(roster.living("BLUE").map((actor) => actor.id)).toEqual(["player"]);
    expect(roster.living("RED").map((actor) => actor.id)).toEqual(["enemy-1", "enemy-2"]);
    expect(roster.opponentIds("BLUE")).toEqual(["enemy-1", "enemy-2"]);
    expect(roster.opponentIds("RED")).toEqual(["player"]);
  });

  it("returns frozen copied snapshots instead of mutable roster entries", () => {
    const roster = createRoster();
    const first = roster.all();
    const second = roster.all();

    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
    expect(first[0]).not.toBe(second[0]);
  });

  it("keeps a team alive when only one of several actors dies", () => {
    const roster = createRoster();

    expect(roster.setAlive(createActorId("enemy-1"), false)).toBe(true);
    expect(roster.hasLivingTeamMember("RED")).toBe(true);
    expect(roster.getEliminatedTeam()).toBeNull();
    expect(roster.opponentIds("BLUE")).toEqual(["enemy-2"]);
  });

  it("reports the team only after all of its actors die", () => {
    const roster = createRoster();

    roster.setAlive(createActorId("enemy-1"), false);
    roster.setAlive(createActorId("enemy-2"), false);

    expect(roster.hasLivingTeamMember("RED")).toBe(false);
    expect(roster.getEliminatedTeam()).toBe("RED");
  });

  it("removes an actor without affecting other members", () => {
    const roster = createRoster();

    expect(roster.remove(createActorId("enemy-1"))).toBe(true);
    expect(roster.remove(createActorId("missing"))).toBe(false);
    expect(roster.all().map((actor) => actor.id)).toEqual(["player", "enemy-2"]);
  });

  it("updates an actor team without replacing its stable identity", () => {
    const roster = createRoster();
    const actorId = createActorId("enemy-1");

    expect(roster.setTeam(actorId, "BLUE")).toBe(true);
    expect(roster.all().find((actor) => actor.id === actorId)).toMatchObject({
      id: actorId,
      team: "BLUE",
      controller: "cpu",
      alive: true
    });
    expect(roster.setTeam(createActorId("missing"), "RED")).toBe(false);
  });

  it("restores every registered actor to alive on reset", () => {
    const roster = createRoster();
    roster.setAlive(createActorId("player"), false);
    roster.setAlive(createActorId("enemy-1"), false);
    roster.setAlive(createActorId("enemy-2"), false);

    roster.reset();

    expect(roster.living().map((actor) => actor.id)).toEqual(["player", "enemy-1", "enemy-2"]);
    expect(roster.getEliminatedTeam()).toBeNull();
  });
});

function createRoster(): BattleRosterLogic {
  const roster = new BattleRosterLogic();
  roster.add({ id: createActorId("player"), team: "BLUE", controller: "human" });
  roster.add({ id: createActorId("enemy-1"), team: "RED", controller: "cpu" });
  roster.add({ id: createActorId("enemy-2"), team: "RED", controller: "cpu" });
  return roster;
}
