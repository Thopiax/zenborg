import { describe, it, expect } from "vitest";
import { HabitHealthService } from "../HabitHealthService";
import { Attitude } from "@/domain/value-objects/Attitude";
import { Phase } from "@/domain/value-objects/Phase";
import type { Habit } from "@/domain/entities/Habit";
import type { CyclePlan } from "@/domain/entities/CyclePlan";
import type { Moment } from "@/domain/entities/Moment";
import type { Rhythm } from "@/domain/value-objects/Rhythm";

const service = new HabitHealthService();

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
  overrides: Partial<Moment> = {}
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

describe("HabitHealthService.resolveRhythm", () => {
  it("returns cyclePlan override when present", () => {
    const habit = baseHabit({
      rhythm: { period: "weekly", count: 3 },
    });
    const plan: CyclePlan = {
      id: "p1",
      cycleId: "c1",
      habitId: habit.id,
      budgetedCount: 0,
      rhythmOverride: { period: "weekly", count: 5 },
      createdAt: ISO(new Date()),
      updatedAt: ISO(new Date()),
    };
    expect(service.resolveRhythm(habit, plan)).toEqual({
      period: "weekly",
      count: 5,
    });
  });

  it("falls back to habit rhythm when no plan override", () => {
    const habit = baseHabit({ rhythm: { period: "monthly", count: 2 } });
    expect(service.resolveRhythm(habit, null)).toEqual({
      period: "monthly",
      count: 2,
    });
  });

  it("returns null when neither source has rhythm", () => {
    expect(service.resolveRhythm(baseHabit(), null)).toBeNull();
  });
});

describe("HabitHealthService.computeHealth — attitude dispatch", () => {
  it("returns 'unstated' for a habit with no attitude", () => {
    const habit = baseHabit();
    expect(service.computeHealth(habit, null, [], new Date())).toBe("unstated");
  });

  it("returns 'evergreen' for BEING regardless of history", () => {
    const habit = baseHabit({ attitude: Attitude.BEING });
    expect(service.computeHealth(habit, null, [], new Date())).toBe("evergreen");
  });
});

describe("HabitHealthService — BEGINNING", () => {
  it("is 'seedling' when allocation count < 5", () => {
    const habit = baseHabit({ attitude: Attitude.BEGINNING });
    const now = new Date("2026-04-20");
    const moments = [
      allocatedMoment(habit.id, new Date("2026-04-18")),
      allocatedMoment(habit.id, new Date("2026-04-19")),
    ];
    expect(service.computeHealth(habit, null, moments, now)).toBe("seedling");
  });

  it("is 'budding' when allocation count >= 5", () => {
    const habit = baseHabit({ attitude: Attitude.BEGINNING });
    const now = new Date("2026-04-20");
    const moments = [0, 1, 2, 3, 4].map((i) =>
      allocatedMoment(habit.id, new Date(`2026-04-1${i}`))
    );
    expect(service.computeHealth(habit, null, moments, now)).toBe("budding");
  });
});

describe("HabitHealthService — KEEPING", () => {
  it("is 'unstated' when KEEPING has no rhythm", () => {
    const habit = baseHabit({ attitude: Attitude.KEEPING });
    const now = new Date("2026-04-20");
    expect(service.computeHealth(habit, null, [], now)).toBe("unstated");
  });

  it("is 'blooming' when last allocation is within silence threshold", () => {
    const rhythm: Rhythm = { period: "monthly", count: 2 }; // threshold = 15 days
    const habit = baseHabit({
      attitude: Attitude.KEEPING,
      rhythm,
    });
    const now = new Date("2026-04-20");
    const last = new Date("2026-04-10"); // 10 days ago
    expect(
      service.computeHealth(habit, null, [allocatedMoment(habit.id, last)], now)
    ).toBe("blooming");
  });

  it("is 'wilting' when last allocation is past silence threshold", () => {
    const rhythm: Rhythm = { period: "monthly", count: 2 }; // threshold = 15 days
    const habit = baseHabit({
      attitude: Attitude.KEEPING,
      rhythm,
    });
    const now = new Date("2026-04-20");
    const last = new Date("2026-04-01"); // 19 days ago
    expect(
      service.computeHealth(habit, null, [allocatedMoment(habit.id, last)], now)
    ).toBe("wilting");
  });

  it("is 'wilting' when no allocations exist and rhythm is set", () => {
    const habit = baseHabit({
      attitude: Attitude.KEEPING,
      rhythm: { period: "quarterly", count: 1 },
    });
    expect(service.computeHealth(habit, null, [], new Date())).toBe("wilting");
  });
});

describe("HabitHealthService — BUILDING", () => {
  it("is 'unstated' when BUILDING has no rhythm", () => {
    const habit = baseHabit({ attitude: Attitude.BUILDING });
    expect(service.computeHealth(habit, null, [], new Date())).toBe("unstated");
  });

  it("is 'budding' when habit was updated less than 3 periods ago", () => {
    const now = new Date("2026-04-20");
    const habit = baseHabit({
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 3 },
      updatedAt: ISO(new Date("2026-04-14")), // less than 21 days (3 weeks)
    });
    expect(service.computeHealth(habit, null, [], now)).toBe("budding");
  });

  it("is 'blooming' when on-pace within the current period", () => {
    const now = new Date("2026-04-20");
    const habit = baseHabit({
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 3 },
      updatedAt: ISO(new Date("2026-01-01")), // well past budding window
    });
    // 2 allocations in last 7 days is on-pace
    const moments = [
      allocatedMoment(habit.id, new Date("2026-04-14")),
      allocatedMoment(habit.id, new Date("2026-04-16")),
    ];
    expect(service.computeHealth(habit, null, moments, now)).toBe("blooming");
  });

  it("is 'wilting' when below pace beyond tolerance", () => {
    const now = new Date("2026-04-27"); // end of week
    const habit = baseHabit({
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 5 },
      updatedAt: ISO(new Date("2026-01-01")),
    });
    // 1 allocation in last 7 days when 5 expected, tolerance max(1, floor(5*0.2))=1
    const moments = [allocatedMoment(habit.id, new Date("2026-04-21"))];
    expect(service.computeHealth(habit, null, moments, now)).toBe("wilting");
  });
});

describe("HabitHealthService — PUSHING", () => {
  it("reuses BUILDING pace logic (wilt on underpace)", () => {
    const now = new Date("2026-04-27");
    const habit = baseHabit({
      attitude: Attitude.PUSHING,
      rhythm: { period: "weekly", count: 3 },
      updatedAt: ISO(new Date("2026-01-01")),
    });
    // 0 allocations in last 7 days, expect wilting
    expect(service.computeHealth(habit, null, [], now)).toBe("wilting");
  });
});
