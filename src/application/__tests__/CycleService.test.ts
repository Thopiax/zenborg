// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { CycleService } from "../services/CycleService";
import {
  cycles$,
  cyclePlans$,
  habits$,
  moments$,
} from "@/infrastructure/state/store";

const makeHabit = (id: string, areaId = "area-1") => ({
  id,
  name: `Habit ${id}`,
  areaId,
  attitude: null,
  phase: null,
  tags: [],
  emoji: null,
  isArchived: false,
  order: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const makeCycle = (id: string) => ({
  id,
  name: `Cycle ${id}`,
  startDate: "2026-01-01",
  endDate: "2026-03-31",
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe("CycleService.budgetHabitToCycle (incremental materialize)", () => {
  let service: CycleService;

  beforeEach(() => {
    moments$.set({});
    cyclePlans$.set({});
    cycles$.set({});
    habits$.set({});

    cycles$["cycle-1"].set(makeCycle("cycle-1"));
    habits$["habit-1"].set(makeHabit("habit-1"));

    service = new CycleService();
  });

  it("should create N moments when budgeting a new habit", () => {
    service.budgetHabitToCycle("cycle-1", "habit-1", 3);

    const allMoments = Object.values(moments$.get());
    const planMoments = allMoments.filter((m) => m.cyclePlanId !== null);
    expect(planMoments).toHaveLength(3);
  });

  it("should add only delta moments when incrementing", () => {
    service.budgetHabitToCycle("cycle-1", "habit-1", 2);
    const momentsBefore = Object.values(moments$.get());
    const idsBefore = new Set(momentsBefore.map((m) => m.id));

    service.budgetHabitToCycle("cycle-1", "habit-1", 3);
    const momentsAfter = Object.values(moments$.get());

    // All original moments should still exist
    for (const id of idsBefore) {
      expect(moments$[id].get()).toBeTruthy();
    }
    // Exactly 1 new moment added
    expect(momentsAfter).toHaveLength(3);
  });

  it("should remove unallocated moments first when decrementing", () => {
    service.budgetHabitToCycle("cycle-1", "habit-1", 3);

    // Simulate: allocate one moment to the timeline
    const allMoments = Object.values(moments$.get());
    const firstMoment = allMoments[0];
    moments$[firstMoment.id].day.set("2026-02-01");
    moments$[firstMoment.id].phase.set("morning");

    // Decrement to 1
    service.budgetHabitToCycle("cycle-1", "habit-1", 1);

    // The allocated moment should survive
    expect(moments$[firstMoment.id].get()).toBeTruthy();
    expect(moments$[firstMoment.id].day.get()).toBe("2026-02-01");

    // Total moments for this plan should be 1 (the allocated one)
    const remaining = Object.values(moments$.get()).filter(
      (m) => m.habitId === "habit-1"
    );
    expect(remaining).toHaveLength(1);
  });

  it("should remove only unallocated moments when setting to 0", () => {
    service.budgetHabitToCycle("cycle-1", "habit-1", 3);

    // Allocate one moment
    const allMoments = Object.values(moments$.get());
    const allocatedMoment = allMoments[0];
    moments$[allocatedMoment.id].day.set("2026-02-01");
    moments$[allocatedMoment.id].phase.set("morning");

    // Set to 0
    service.budgetHabitToCycle("cycle-1", "habit-1", 0);

    // Allocated moment survives (orphaned from budget but on timeline)
    expect(moments$[allocatedMoment.id].get()).toBeTruthy();

    // Unallocated moments are gone
    const unallocated = Object.values(moments$.get()).filter(
      (m) => m.day === null && m.habitId === "habit-1"
    );
    expect(unallocated).toHaveLength(0);
  });
});
