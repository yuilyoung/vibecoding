import { describe, expect, it } from "vitest";
import { PresentationEventPolicy } from "../src/domain/visual/PresentationEvent";

describe("PresentationEventPolicy", () => {
  it("accepts increasing barrel events once and rejects duplicate or stale sequences", () => {
    const policy = new PresentationEventPolicy();
    const event = { subjectId: "barrel-a", family: "barrel" as const, kind: "damage" as const, sequence: 1, x: 12, y: 34, occurredAt: 1, state: "active" };
    expect(policy.accept(event)).toEqual({ kind: "damage", family: "barrel", x: 12, y: 34, state: "active" });
    expect(policy.accept(event)).toBeNull();
    expect(policy.accept({ ...event, sequence: 0 })).toBeNull();
    expect(policy.accept({ ...event, sequence: 2, kind: "destroy", state: "destroyed" })).toEqual({ kind: "destroy", family: "barrel", x: 12, y: 34, state: "destroyed" });
  });

  it("uses snapshots and release boundaries to prevent stale events crossing a stage restart", () => {
    const policy = new PresentationEventPolicy();
    expect(policy.syncSnapshot({ subjectId: "shared-id", state: "active", sequence: 4 })).toBe(true);
    expect(policy.accept({ subjectId: "shared-id", family: "mine", kind: "arm", sequence: 4, x: 1, y: 2, occurredAt: 10, state: "armed" })).toBeNull();
    policy.releaseSubject("shared-id");
    expect(policy.accept({ subjectId: "shared-id", family: "mine", kind: "arm", sequence: 1, x: 1, y: 2, occurredAt: 11, state: "armed" })).toMatchObject({ kind: "arm", family: "mine" });
  });

  it("rejects incomplete events without advancing a subject sequence", () => {
    const policy = new PresentationEventPolicy();
    expect(policy.accept({ subjectId: "actor", family: "actor", kind: "hit", sequence: 1, x: 0, y: 0, occurredAt: Number.NaN, state: "hit" })).toBeNull();
    expect(policy.accept({ subjectId: "actor", family: "actor", kind: "hit", sequence: 1, x: 0, y: 0, occurredAt: 0, state: "hit" })).toMatchObject({ kind: "hit" });
  });
});
