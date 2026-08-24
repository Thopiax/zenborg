import { describe, expect, it } from "vitest";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import { Attitude } from "@/domain/value-objects/Attitude";
import { Phase } from "@/domain/value-objects/Phase";
import { HabitHealthService } from "../HabitHealthService";

const service = new HabitHealthService();
const ISO = (d: Date) => d.toISOString();
const DAY = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number, now: Date) =>
  new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

const keepingHabit: Habit = {
  id: "habit-1",
  name: "test habit",
  areaId: "area-1",
  attitude: Attitude.KEEPING,
  rhythm: { period: "weekly", count: 1 },
  phase: null,
  tags: [],
  emoji: null,
  isArchived: false,
  order: 0,
  createdAt: ISO(new Date("2026-01-01")),
  updatedAt: ISO(new Date("2026-01-01")),
};

const allocatedMoment = (
  day: Date,
  overrides: Partial<Moment> = {},
): Moment => ({
  id: `moment-${day.toISOString()}`,
  name: "m",
  areaId: "area-1",
  habitId: "habit-1",
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

describe("tentative moments and health (spec D5)", () => {
  const now = new Date("2026-08-21T12:00:00");

  it("a tentative moment does not rescue a wilting KEEPING habit", () => {
    const moments = [
      allocatedMoment(daysAgo(30, now)),
      allocatedMoment(daysAgo(0, now), { status: "tentative" }),
    ];
    expect(service.computeHealth(keepingHabit, null, moments, now)).toBe(
      "wilting",
    );
  });

  it("latestAllocationDate ignores tentative moments", () => {
    const moments = [
      allocatedMoment(daysAgo(10, now)),
      allocatedMoment(daysAgo(1, now), { status: "tentative" }),
    ];
    expect(service.latestAllocationDate(moments, now)).toEqual(
      service.latestAllocationDate([allocatedMoment(daysAgo(10, now))], now),
    );
  });

  it("an accepted moment with identical timing does move the number (control)", () => {
    const moments = [
      allocatedMoment(daysAgo(30, now)),
      allocatedMoment(daysAgo(0, now), { status: "accepted" }),
    ];
    expect(service.computeHealth(keepingHabit, null, moments, now)).toBe(
      "blooming",
    );
  });
});
