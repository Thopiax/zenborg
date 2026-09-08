import { describe, expect, it } from "vitest";
import type { CyclePlan } from "@/domain/entities/CyclePlan";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import { Attitude } from "@/domain/value-objects/Attitude";
import { Phase } from "@/domain/value-objects/Phase";
import { computeThirst, rankByThirst } from "../ThirstService";

const ISO = (d: Date) => d.toISOString();
const DAY = (d: Date) => d.toISOString().slice(0, 10);

const baseHabit = (overrides: Partial<Habit> = {}): Habit => ({
  id: overrides.id ?? "habit-1",
  name: "test habit",
  areaId: "area-1",
  attitude: null,
  phase: null,
  tags: [],
  emoji: null,
  isArchived: false,
  order: 0,
  createdAt: ISO(new Date("2026-01-01")),
  updatedAt: ISO(new Date("2026-01-01")),
  ...overrides,
});

const allocatedMoment = (
  habitId: string,
  day: Date,
  overrides: Partial<Moment> = {},
): Moment => ({
  id: `moment-${day.toISOString()}`,
  name: "m",
  areaId: "area-1",
  habitId,
  cycleId: null,
  cyclePlanId: null,
  phase: Phase.MORNING,
  day: DAY(day),
  order: 0,
  tags: null,
  createdAt: ISO(day),
  updatedAt: ISO(day),
  ...overrides,
});

describe("computeThirst", () => {
  const now = new Date("2026-09-08");

  it("returns 0 score for habits with no rhythm", () => {
    const habit = baseHabit();
    const result = computeThirst({ habit, cyclePlan: null, moments: [], now });
    expect(result.score).toBe(0);
    expect(result.daysSinceLast).toBeNull();
  });

  it("computes base thirst from days since last / effective interval", () => {
    // 3×/week, BEGINNING (1.0× multiplier)
    // optimalInterval = 7/3 = 2.33 days, effectiveInterval = 2.33 × 1.0 = 2.33
    // last allocation 4 days ago → thirst = 4 / 2.33 ≈ 1.71
    const habit = baseHabit({
      attitude: Attitude.BEGINNING,
      rhythm: { period: "weekly", count: 3 },
    });
    const lastDay = new Date("2026-09-04"); // 4 days ago
    const moments = [allocatedMoment(habit.id, lastDay)];
    const result = computeThirst({ habit, cyclePlan: null, moments, now });

    expect(result.daysSinceLast).toBeCloseTo(4, 0);
    expect(result.score).toBeCloseTo(4 / (7 / 3), 1);
    expect(result.score).toBeGreaterThan(1.0); // wilting
  });

  it("BEING habits have 2.5× multiplier — resilient to gaps", () => {
    // 3×/week, BEING → effectiveInterval = (7/3) × 2.5 = 5.83
    // 4 days ago → thirst = 4 / 5.83 ≈ 0.69
    const habit = baseHabit({
      attitude: Attitude.BEING,
      rhythm: { period: "weekly", count: 3 },
    });
    const moments = [allocatedMoment(habit.id, new Date("2026-09-04"))];
    const result = computeThirst({ habit, cyclePlan: null, moments, now });

    expect(result.score).toBeCloseTo(4 / ((7 / 3) * 2.5), 1);
    expect(result.score).toBeLessThan(1.0); // not yet wilting
  });

  it("KEEPING at 1.8× tolerates longer gaps than RETURNING at 1.2×", () => {
    const rhythm = { period: "weekly" as const, count: 3 };
    const lastDay = new Date("2026-09-05"); // 3 days ago
    const keeping = baseHabit({ id: "k", attitude: Attitude.KEEPING, rhythm });
    const returning = baseHabit({ id: "r", attitude: Attitude.RETURNING, rhythm });

    const kResult = computeThirst({
      habit: keeping, cyclePlan: null,
      moments: [allocatedMoment("k", lastDay)], now,
    });
    const rResult = computeThirst({
      habit: returning, cyclePlan: null,
      moments: [allocatedMoment("r", lastDay)], now,
    });

    expect(kResult.score).toBeLessThan(rResult.score);
  });

  it("no allocations at all yields thirst = 2.0 (high default)", () => {
    const habit = baseHabit({
      attitude: Attitude.BEGINNING,
      rhythm: { period: "weekly", count: 3 },
    });
    const result = computeThirst({ habit, cyclePlan: null, moments: [], now });
    expect(result.score).toBe(2.0);
    expect(result.daysSinceLast).toBeNull();
  });

  it("adds plan deficit when cycle budget is behind", () => {
    const habit = baseHabit({
      id: "h",
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 3 },
    });
    const plan: CyclePlan = {
      id: "p", cycleId: "c", habitId: "h",
      budgetedCount: 10,
      createdAt: ISO(now), updatedAt: ISO(now),
    };
    // Half the cycle elapsed, 0 budgeted moments done → deficit = 0.5
    const result = computeThirst({
      habit, cyclePlan: plan, moments: [],
      now, cycleDaysElapsed: 45, cycleDaysTotal: 90,
    });
    expect(result.planDeficit).toBeCloseTo(0.5);
    expect(result.score).toBeGreaterThan(2.0); // base 2.0 + 0.5 deficit
  });

  it("plan deficit is 0 when on track", () => {
    const habit = baseHabit({
      id: "h",
      attitude: Attitude.KEEPING,
      rhythm: { period: "weekly", count: 2 },
    });
    const plan: CyclePlan = {
      id: "p", cycleId: "c", habitId: "h",
      budgetedCount: 4,
      createdAt: ISO(now), updatedAt: ISO(now),
    };
    // Quarter of cycle, 1 budgeted moment done = on track for 4
    const moments = [
      allocatedMoment("h", new Date("2026-09-06"), { cyclePlanId: "p" }),
    ];
    const result = computeThirst({
      habit, cyclePlan: plan, moments,
      now, cycleDaysElapsed: 22, cycleDaysTotal: 90,
    });
    expect(result.planDeficit).toBeCloseTo(0, 1);
  });

  it("uses cyclePlan rhythmOverride when present", () => {
    const habit = baseHabit({
      attitude: Attitude.KEEPING,
      rhythm: { period: "weekly", count: 1 },
    });
    const plan: CyclePlan = {
      id: "p", cycleId: "c", habitId: habit.id,
      budgetedCount: 0,
      rhythmOverride: { period: "weekly", count: 5 },
      createdAt: ISO(now), updatedAt: ISO(now),
    };
    // 5×/week is much more demanding than 1×/week
    const lastDay = new Date("2026-09-06");
    const moments = [allocatedMoment(habit.id, lastDay)];
    const withPlan = computeThirst({ habit, cyclePlan: plan, moments, now });
    const withoutPlan = computeThirst({ habit, cyclePlan: null, moments, now });

    expect(withPlan.score).toBeGreaterThan(withoutPlan.score);
  });
});

describe("rankByThirst", () => {
  it("sorts thirstiest first", () => {
    const scores = [
      { habitId: "low", score: 0.3, daysSinceLast: 1, planDeficit: 0 },
      { habitId: "high", score: 2.5, daysSinceLast: 7, planDeficit: 0.5 },
      { habitId: "mid", score: 1.1, daysSinceLast: 3, planDeficit: 0 },
    ];
    const ranked = rankByThirst(scores);
    expect(ranked.map((r) => r.habitId)).toEqual(["high", "mid", "low"]);
  });
});
