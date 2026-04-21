import { describe, expect, it } from "vitest";
import {
  PERIOD_DAYS,
  type Rhythm,
  rhythmPerWeek,
  rhythmSilenceThresholdDays,
  rhythmToCycleBudget,
} from "../Rhythm";

describe("Rhythm helpers", () => {
  it("rhythmPerWeek normalizes a weekly rhythm", () => {
    const r: Rhythm = { period: "weekly", count: 3 };
    expect(rhythmPerWeek(r)).toBe(3);
  });

  it("rhythmPerWeek normalizes a monthly rhythm", () => {
    const r: Rhythm = { period: "monthly", count: 2 };
    // 2 per month ≈ 2 × 7 / 30
    expect(rhythmPerWeek(r)).toBeCloseTo((2 * 7) / 30);
  });

  it("rhythmToCycleBudget rounds to integer count", () => {
    // weekly × 3 over 28 days = 12
    expect(rhythmToCycleBudget({ period: "weekly", count: 3 }, 28)).toBe(12);
    // monthly × 1 over 90 days = 3
    expect(rhythmToCycleBudget({ period: "monthly", count: 1 }, 90)).toBe(3);
  });

  it("rhythmSilenceThresholdDays is period / count", () => {
    expect(rhythmSilenceThresholdDays({ period: "quarterly", count: 1 })).toBe(
      90,
    );
    expect(rhythmSilenceThresholdDays({ period: "monthly", count: 2 })).toBe(
      15,
    );
  });

  it("PERIOD_DAYS covers all RhythmPeriod values", () => {
    expect(PERIOD_DAYS.weekly).toBe(7);
    expect(PERIOD_DAYS.biweekly).toBe(14);
    expect(PERIOD_DAYS.monthly).toBe(30);
    expect(PERIOD_DAYS.quarterly).toBe(90);
    expect(PERIOD_DAYS.annually).toBe(365);
  });
});
