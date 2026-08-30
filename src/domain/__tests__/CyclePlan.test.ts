import { describe, expect, it } from "vitest";
import { createCyclePlan, isCyclePlanError } from "@/domain/entities/CyclePlan";
import type { Rhythm } from "@/domain/value-objects/Rhythm";

describe("CyclePlan rhythmOverride", () => {
  it("createCyclePlan accepts an optional rhythmOverride", () => {
    const rhythmOverride: Rhythm = { period: "weekly", count: 4 };
    const result = createCyclePlan({
      cycleId: "cycle-1",
      habitId: "habit-1",
      budgetedCount: 12,
      rhythmOverride,
    });
    if (isCyclePlanError(result)) throw new Error(result.error);
    expect(result.rhythmOverride).toEqual(rhythmOverride);
  });

  it("createCyclePlan defaults rhythmOverride to undefined", () => {
    const result = createCyclePlan({
      cycleId: "cycle-1",
      habitId: "habit-1",
      budgetedCount: 6,
    });
    if (isCyclePlanError(result)) throw new Error(result.error);
    expect(result.rhythmOverride).toBeUndefined();
  });
});

describe("CyclePlan cultivarRotation", () => {
  it("createCyclePlan accepts cultivar rotation", () => {
    const result = createCyclePlan({
      cycleId: "cycle-1",
      habitId: "habit-1",
      budgetedCount: 6,
      cultivarRotation: ["recovery", "long", "speed"],
    });
    if (isCyclePlanError(result)) throw new Error(result.error);
    expect(result.cultivarRotation).toEqual(["recovery", "long", "speed"]);
  });

  it("createCyclePlan omits cultivarRotation when empty", () => {
    const result = createCyclePlan({
      cycleId: "cycle-1",
      habitId: "habit-1",
      budgetedCount: 6,
      cultivarRotation: [],
    });
    if (isCyclePlanError(result)) throw new Error(result.error);
    expect("cultivarRotation" in result).toBe(false);
  });
});
