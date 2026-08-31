import { describe, expect, it } from "vitest";
import { PresentationEventPolicy } from "../src/domain/visual/PresentationEvent";

describe("PresentationEventPolicy", () => {
  it("accepts increasing barrel events once and rejects duplicate or stale sequences", () => {
    const policy = new PresentationEventPolicy();
    const event = { subjectId: "barrel-a", family: "barrel" as const, kind: "damage" as const, sequence: 1, x: 12, y: 34 };
    expect(policy.accept(event)).toEqual({ kind: "damage", x: 12, y: 34 });
    expect(policy.accept(event)).toBeNull();
    expect(policy.accept({ ...event, sequence: 0 })).toBeNull();
    expect(policy.accept({ ...event, sequence: 2, kind: "destroy" })).toEqual({ kind: "destroy", x: 12, y: 34 });
  });
});
