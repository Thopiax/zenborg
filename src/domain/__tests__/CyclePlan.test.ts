import { describe, it, expect } from "vitest";
import {
  createCyclePlan,
  isCyclePlanError,
} from "@/domain/entities/CyclePlan";
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
