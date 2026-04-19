import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cycle } from "@/domain/entities/Cycle";
import {
  calculateDefaultEndDate,
  doDateRangesOverlap,
  generateCycleName,
} from "../CycleDateService";

const makeCycle = (
  id: string,
  startDate: string,
  endDate: string | null = null
): Cycle => ({
  id,
  name: `Cycle ${id}`,
  startDate,
  endDate,
  intention: null,
  reflection: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("generateCycleName", () => {
  it("should generate week name with ISO week number", () => {
    // 2026-03-02 is in ISO week 10
    const date = new Date(2026, 2, 2);
    expect(generateCycleName("week", date)).toBe("Week 10");
  });

  it("should generate 2-week name with week range", () => {
    // 2026-03-02 (week 10) to 2026-03-15 (week 11)
    const date = new Date(2026, 2, 2);
    const result = generateCycleName("2-week", date);
    expect(result).toMatch(/^Weeks 10\u201311$/);
  });

  it("should generate month name with full month and year", () => {
    const date = new Date(2026, 2, 1); // March 1, 2026
    expect(generateCycleName("month", date)).toBe("March 2026");
  });

  it("should generate quarter name", () => {
    // Q1
    expect(generateCycleName("quarter", new Date(2026, 0, 1))).toBe("Q1 2026");
    // Q2
    expect(generateCycleName("quarter", new Date(2026, 3, 1))).toBe("Q2 2026");
    // Q3
    expect(generateCycleName("quarter", new Date(2026, 6, 1))).toBe("Q3 2026");
    // Q4
    expect(generateCycleName("quarter", new Date(2026, 9, 1))).toBe("Q4 2026");
  });

  it("should handle week at year boundary", () => {
    // Dec 29, 2025 is in ISO week 1 of 2026
    const date = new Date(2025, 11, 29);
    const result = generateCycleName("week", date);
    expect(result).toBe("Week 1");
  });
});

describe("doDateRangesOverlap", () => {
  it("touching endpoints (A ends day X, B starts day X) do NOT overlap", () => {
    expect(
      doDateRangesOverlap("2026-03-12", "2026-03-31", "2026-03-31", "2026-04-19")
    ).toBe(false);
  });

  it("touching endpoints reversed (B ends day X, A starts day X) do NOT overlap", () => {
    expect(
      doDateRangesOverlap("2026-03-31", "2026-04-19", "2026-03-12", "2026-03-31")
    ).toBe(false);
  });

  it("interior overlap returns true", () => {
    expect(
      doDateRangesOverlap("2026-03-01", "2026-03-15", "2026-03-10", "2026-03-20")
    ).toBe(true);
  });

  it("fully-contained range returns true", () => {
    expect(
      doDateRangesOverlap("2026-03-01", "2026-03-31", "2026-03-10", "2026-03-20")
    ).toBe(true);
  });

  it("fully-separate ranges return false", () => {
    expect(
      doDateRangesOverlap("2026-01-01", "2026-01-31", "2026-03-01", "2026-03-15")
    ).toBe(false);
  });

  it("finite range preceding ongoing cycle does not overlap", () => {
    expect(
      doDateRangesOverlap("2026-01-01", "2026-01-31", "2026-03-31", null)
    ).toBe(false);
  });

  it("two ongoing ranges with same start date overlap", () => {
    expect(doDateRangesOverlap("2026-03-31", null, "2026-03-31", null)).toBe(
      true
    );
  });

  it("two ongoing ranges with different start dates do not overlap", () => {
    expect(doDateRangesOverlap("2026-03-31", null, "2026-04-16", null)).toBe(
      false
    );
  });
});

describe("calculateDefaultEndDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today when no next cycle exists", () => {
    const cycle = makeCycle("a", "2026-03-31");
    expect(calculateDefaultEndDate(cycle, [cycle])).toBe("2026-04-19");
  });

  it("returns day before next cycle start when next cycle is in the future", () => {
    const cycle = makeCycle("a", "2026-03-31");
    const nextCycle = makeCycle("b", "2026-05-01", "2026-05-15");
    expect(calculateDefaultEndDate(cycle, [cycle, nextCycle])).toBe(
      "2026-04-19"
    );
  });

  it("caps at dayBefore(next.startDate) when next cycle already started", () => {
    const cycle = makeCycle("a", "2026-03-31");
    const nextCycle = makeCycle("b", "2026-04-11", "2026-04-16");
    expect(calculateDefaultEndDate(cycle, [cycle, nextCycle])).toBe(
      "2026-04-10"
    );
  });

  it("picks the earliest of multiple future cycles", () => {
    const cycle = makeCycle("a", "2026-03-31");
    const next1 = makeCycle("b", "2026-04-11", "2026-04-16");
    const next2 = makeCycle("c", "2026-05-01", "2026-05-15");
    expect(calculateDefaultEndDate(cycle, [cycle, next1, next2])).toBe(
      "2026-04-10"
    );
  });

  it("ignores cycles that started before the one being ended", () => {
    const cycle = makeCycle("a", "2026-03-31");
    const earlier = makeCycle("z", "2026-03-12", "2026-03-31");
    expect(calculateDefaultEndDate(cycle, [cycle, earlier])).toBe("2026-04-19");
  });
});
