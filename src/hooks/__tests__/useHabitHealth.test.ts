// @vitest-environment happy-dom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Habit } from "@zenborg/core/domain/entities/Habit";
import type { Moment } from "@zenborg/core/domain/entities/Moment";
import { Attitude } from "@zenborg/core/domain/value-objects/Attitude";
import { Phase } from "@zenborg/core/domain/value-objects/Phase";
import type { Rhythm } from "@zenborg/core/domain/value-objects/Rhythm";
import {
  activeCycleId$,
  cyclePlans$,
  habits$,
  moments$,
  storeHydrated$,
} from "@/infrastructure/state/store";
import { useHabitHealth } from "../useHabitHealth";

/**
 * The hook reads the wall clock (`new Date()`), so days are expressed relative
 * to the real today rather than a frozen instant.
 */
function isoDay(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The day `n` local calendar days before today. Shifts the calendar date
 * rather than subtracting milliseconds, so a DST boundary cannot slide it.
 */
function daysAgo(n: number): string {
  const shifted = new Date();
  shifted.setDate(shifted.getDate() - n);
  return isoDay(shifted);
}

const WEEKLY: Rhythm = { period: "weekly", count: 1 }; // 7-day threshold

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: "h-1",
  name: "test habit",
  areaId: "area-1",
  attitude: Attitude.KEEPING,
  phase: null,
  tags: [],
  emoji: null,
  isArchived: false,
  order: 0,
  rhythm: WEEKLY,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const moment = (over: Partial<Moment> = {}): Moment => ({
  id: "m-1",
  name: "dinner",
  areaId: "area-1",
  habitId: null,
  cycleId: null,
  cyclePlanId: null,
  phase: Phase.EVENING,
  day: daysAgo(2),
  order: 0,
  tags: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("useHabitHealth — daysSinceLast and health read the same moments", () => {
  beforeEach(() => {
    habits$.set({});
    moments$.set({});
    cyclePlans$.set({});
    activeCycleId$.set(null);
    storeHydrated$.set(false);
  });

  it("counts a moment that names the habit only in personIds", () => {
    // `habitId: null` and the id only in `personIds` — the `||` cannot
    // short-circuit on a habitId match, so this exercises the widened clause.
    habits$["p-yaya"].set(habit({ id: "p-yaya", name: "Yaya" }));
    moments$["m-group-dinner"].set(
      moment({ id: "m-group-dinner", personIds: ["p-abuelo", "p-yaya"] }),
    );

    const { result } = renderHook(() => useHabitHealth("p-yaya"));

    expect(result.current.daysSinceLast).toBe(2);
    expect(result.current.health).toBe("blooming");
  });

  it("no longer emits a stale pre-migration day count beside a blooming", () => {
    // The reported defect: a person seen at a group dinner two days ago, whose
    // last moment planted directly against them is 400 days old. Health read
    // the dinner, daysSinceLast did not — VirtualDeckCard rendered "·400d" on
    // someone you had dinner with last week.
    habits$["p-yaya"].set(habit({ id: "p-yaya", name: "Yaya" }));
    moments$["m-stale"].set(
      moment({ id: "m-stale", habitId: "p-yaya", day: daysAgo(400) }),
    );
    moments$["m-group-dinner"].set(
      moment({ id: "m-group-dinner", personIds: ["p-yaya"] }),
    );

    const { result } = renderHook(() => useHabitHealth("p-yaya"));

    expect(result.current.health).toBe("blooming");
    expect(result.current.daysSinceLast).toBe(2);
  });

  it("leaves an ordinary habit's daysSinceLast untouched", () => {
    // No-regression pin: `personIds` can never hold an ordinary habit's own id,
    // so the widened predicate is inert for every non-person record.
    habits$["h-meditation"].set(
      habit({ id: "h-meditation", name: "meditation" }),
    );
    moments$["m-own"].set(moment({ id: "m-own", habitId: "h-meditation" }));
    moments$["m-other"].set(
      moment({
        id: "m-other",
        day: daysAgo(1),
        personIds: ["p-yaya", "p-abuelo"],
      }),
    );

    const { result } = renderHook(() => useHabitHealth("h-meditation"));

    expect(result.current.daysSinceLast).toBe(2);
    expect(result.current.health).toBe("blooming");
  });

  it("stays null for a habit whose only moments name other people", () => {
    habits$["h-meditation"].set(
      habit({ id: "h-meditation", name: "meditation" }),
    );
    moments$["m-other"].set(
      moment({ id: "m-other", personIds: ["p-yaya", "p-abuelo"] }),
    );

    const { result } = renderHook(() => useHabitHealth("h-meditation"));

    expect(result.current.daysSinceLast).toBeNull();
    expect(result.current.health).toBe("wilting");
  });
});
