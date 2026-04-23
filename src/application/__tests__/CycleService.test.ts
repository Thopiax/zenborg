// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Attitude } from "@/domain/value-objects/Attitude";
import type { Phase } from "@/domain/value-objects/Phase";
import { rhythmToCycleBudget, type Rhythm } from "@/domain/value-objects/Rhythm";
import {
  activeCycleId$,
  cyclePlans$,
  cycles$,
  habits$,
  moments$,
  storeHydrated$,
} from "@/infrastructure/state/store";
import { CycleService } from "../services/CycleService";

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
  intention: null,
  reflection: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe("CycleService.budgetHabitToCycle (incremental materialize)", () => {
  let service: CycleService;

  beforeEach(() => {
    moments$.set({});
    cyclePlans$.set({});
    cycles$.set({});
    activeCycleId$.set(null);
    storeHydrated$.set(false);
    habits$.set({});

    cycles$["cycle-1"].set(makeCycle("cycle-1"));
    activeCycleId$.set("cycle-1");
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
    moments$[firstMoment.id].phase.set("morning" as Phase);

    // Decrement to 1
    service.budgetHabitToCycle("cycle-1", "habit-1", 1);

    // The allocated moment should survive
    expect(moments$[firstMoment.id].get()).toBeTruthy();
    expect(moments$[firstMoment.id].day.get()).toBe("2026-02-01");

    // Total moments for this plan should be 1 (the allocated one)
    const remaining = Object.values(moments$.get()).filter(
      (m) => m.habitId === "habit-1",
    );
    expect(remaining).toHaveLength(1);
  });

  it("should remove only unallocated moments when setting to 0", () => {
    service.budgetHabitToCycle("cycle-1", "habit-1", 3);

    // Allocate one moment
    const allMoments = Object.values(moments$.get());
    const allocatedMoment = allMoments[0];
    moments$[allocatedMoment.id].day.set("2026-02-01");
    moments$[allocatedMoment.id].phase.set("morning" as Phase);

    // Set to 0
    service.budgetHabitToCycle("cycle-1", "habit-1", 0);

    // Allocated moment survives (orphaned from budget but on timeline)
    expect(moments$[allocatedMoment.id].get()).toBeTruthy();

    // Unallocated moments are gone
    const unallocated = Object.values(moments$.get()).filter(
      (m) => m.day === null && m.habitId === "habit-1",
    );
    expect(unallocated).toHaveLength(0);
  });
});

describe("CycleService.endCycle", () => {
  let service: CycleService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"));

    moments$.set({});
    cyclePlans$.set({});
    cycles$.set({});
    activeCycleId$.set(null);
    storeHydrated$.set(false);
    habits$.set({});

    service = new CycleService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeOngoingCycle = (id: string, startDate: string) => ({
    id,
    name: `Cycle ${id}`,
    startDate,
    endDate: null,
    intention: null,
    reflection: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const makeFiniteCycle = (id: string, startDate: string, endDate: string) => ({
    id,
    name: `Cycle ${id}`,
    startDate,
    endDate,
    intention: null,
    reflection: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  it("returns an error when the cycle does not exist", () => {
    const result = service.endCycle("nonexistent");
    expect("error" in result).toBe(true);
  });

  it("defaults endDate to today when no next cycle exists", () => {
    cycles$["c1"].set(makeOngoingCycle("c1", "2026-03-31"));

    const result = service.endCycle("c1");

    expect("error" in result).toBe(false);
    expect(cycles$["c1"].endDate.get()).toBe("2026-04-19");
  });

  it("defaults endDate to day before next cycle when next cycle is inside today", () => {
    cycles$["vipassana"].set(makeOngoingCycle("vipassana", "2026-03-31"));
    cycles$["paris"].set(
      makeFiniteCycle("paris", "2026-04-11", "2026-04-16")
    );

    const result = service.endCycle("vipassana");

    expect("error" in result).toBe(false);
    expect(cycles$["vipassana"].endDate.get()).toBe("2026-04-10");
  });

  it("uses an explicit endDate when provided", () => {
    cycles$["c1"].set(makeOngoingCycle("c1", "2026-03-31"));

    const result = service.endCycle("c1", "2026-04-05");

    expect("error" in result).toBe(false);
    expect(cycles$["c1"].endDate.get()).toBe("2026-04-05");
  });

  it("surfaces a descriptive error when the chosen endDate overlaps", () => {
    cycles$["vipassana"].set(makeOngoingCycle("vipassana", "2026-03-31"));
    cycles$["paris"].set(
      makeFiniteCycle("paris", "2026-04-11", "2026-04-16")
    );

    const result = service.endCycle("vipassana", "2026-04-19");

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/Paris/i);
      expect(result.error).toMatch(/Apr/);
    }
  });

  it("allows ending exactly at the next cycle's start date (touching endpoint)", () => {
    cycles$["a"].set(makeOngoingCycle("a", "2026-03-31"));
    cycles$["b"].set(makeFiniteCycle("b", "2026-04-11", "2026-04-16"));

    const result = service.endCycle("a", "2026-04-11");

    expect("error" in result).toBe(false);
    expect(cycles$["a"].endDate.get()).toBe("2026-04-11");
  });
});

describe("CycleService.budgetHabitToCycleWithOptions — rhythm derivation", () => {
  let service: CycleService;

  beforeEach(() => {
    moments$.set({});
    cyclePlans$.set({});
    cycles$.set({});
    activeCycleId$.set(null);
    storeHydrated$.set(false);
    habits$.set({});
    // 28-day cycle: 2026-02-01 .. 2026-02-28 inclusive
    cycles$["cycle-1"].set({
      ...makeCycle("cycle-1"),
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
    activeCycleId$.set("cycle-1");
    service = new CycleService();
  });

  it("derives count from habit rhythm when count omitted", () => {
    const rhythm: Rhythm = { period: "weekly", count: 3 };
    habits$["habit-1"].set({ ...makeHabit("habit-1"), rhythm });

    const result = service.budgetHabitToCycleWithOptions(
      "cycle-1",
      "habit-1",
      {}
    );

    expect("error" in result).toBe(false);
    // rhythmToCycleBudget({weekly, 3}, 28) = round(3 * 28 / 7) = 12
    expect(rhythmToCycleBudget(rhythm, 28)).toBe(12);
    const allMoments = Object.values(moments$.get()).filter(
      (m) => m.cyclePlanId !== null
    );
    expect(allMoments).toHaveLength(12);
  });

  it("uses explicit count when both rhythm and count given", () => {
    habits$["habit-1"].set({
      ...makeHabit("habit-1"),
      rhythm: { period: "weekly", count: 3 },
    });

    service.budgetHabitToCycleWithOptions("cycle-1", "habit-1", { count: 5 });

    const planMoments = Object.values(moments$.get()).filter(
      (m) => m.cyclePlanId !== null
    );
    expect(planMoments).toHaveLength(5);
  });

  it("stores rhythmOverride on the CyclePlan", () => {
    habits$["habit-1"].set(makeHabit("habit-1"));
    const override: Rhythm = { period: "monthly", count: 2 };

    const result = service.budgetHabitToCycleWithOptions(
      "cycle-1",
      "habit-1",
      { rhythmOverride: override }
    );

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.rhythmOverride).toEqual(override);
  });

  it("errors when neither count, rhythm, nor override are supplied", () => {
    habits$["habit-1"].set(makeHabit("habit-1"));
    const result = service.budgetHabitToCycleWithOptions(
      "cycle-1",
      "habit-1",
      {}
    );
    expect("error" in result).toBe(true);
  });
});

describe("CycleService.getCyclePlanningProposals", () => {
  let service: CycleService;

  beforeEach(() => {
    moments$.set({});
    cyclePlans$.set({});
    cycles$.set({});
    habits$.set({});
    activeCycleId$.set(null);
    storeHydrated$.set(false);
    // 28-day cycle
    cycles$["cycle-1"].set({
      ...makeCycle("cycle-1"),
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
    activeCycleId$.set("cycle-1");
    service = new CycleService();
  });

  it("includes KEEPING habits with rhythm (wilting or on-rhythm)", () => {
    habits$["h-keep"].set({
      ...makeHabit("h-keep"),
      attitude: Attitude.KEEPING,
      rhythm: { period: "monthly", count: 1 },
    });
    const proposals = service.getCyclePlanningProposals("cycle-1");
    const row = proposals.find((p) => p.habitId === "h-keep");
    expect(row).toBeDefined();
    expect(row?.reason === "wilting" || row?.reason === "on-rhythm").toBe(true);
  });

  it("includes BUILDING habits with rhythm", () => {
    habits$["h-build"].set({
      ...makeHabit("h-build"),
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 3 },
    });
    const proposals = service.getCyclePlanningProposals("cycle-1");
    expect(proposals.find((p) => p.habitId === "h-build")).toBeDefined();
  });

  it("excludes BEING habits", () => {
    habits$["h-being"].set({
      ...makeHabit("h-being"),
      attitude: Attitude.BEING,
    });
    const proposals = service.getCyclePlanningProposals("cycle-1");
    expect(proposals.find((p) => p.habitId === "h-being")).toBeUndefined();
  });

  it("excludes habits without an attitude", () => {
    habits$["h-none"].set(makeHabit("h-none")); // attitude=null
    const proposals = service.getCyclePlanningProposals("cycle-1");
    expect(proposals.find((p) => p.habitId === "h-none")).toBeUndefined();
  });

  it("suggestedCount equals rhythmToCycleBudget for 28-day cycle", () => {
    habits$["h-build"].set({
      ...makeHabit("h-build"),
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 3 },
    });
    const proposals = service.getCyclePlanningProposals("cycle-1");
    const row = proposals.find((p) => p.habitId === "h-build")!;
    // weekly × 3 over 28 days = 12
    expect(row.suggestedCount).toBe(12);
  });
});

describe("CycleService.getCycleReview", () => {
  let service: CycleService;

  const makeBaseMoment = (id: string) => ({
    id,
    name: `moment-${id}`,
    areaId: "area-1",
    habitId: null as string | null,
    cycleId: "cycle-1" as string | null,
    cyclePlanId: null as string | null,
    phase: "MORNING" as Phase,
    day: null as string | null,
    order: 0,
    emoji: null,
    tags: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const makeMoment = (
    id: string,
    overrides: Partial<ReturnType<typeof makeBaseMoment>> = {}
  ) => ({
    ...makeBaseMoment(id),
    ...overrides,
  });

  beforeEach(() => {
    moments$.set({});
    cyclePlans$.set({});
    cycles$.set({});
    habits$.set({});
    activeCycleId$.set(null);
    storeHydrated$.set(false);
    cycles$["cycle-1"].set({
      ...makeCycle("cycle-1"),
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
    activeCycleId$.set("cycle-1");
    habits$["habit-1"].set(makeHabit("habit-1"));
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "cycle-1",
      habitId: "habit-1",
      budgetedCount: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    service = new CycleService();
  });

  it("returns per-habit actualCount equal to allocated moments", () => {
    moments$["m1"].set(
      makeMoment("m1", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-05",
      })
    );
    moments$["m2"].set(
      makeMoment("m2", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-10",
      })
    );
    moments$["m3"].set(
      makeMoment("m3", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-20",
      })
    );

    const review = service.getCycleReview("cycle-1");
    expect(review).not.toBeNull();
    expect(review!.habits[0].actualCount).toBe(3);
  });

  it("returns unplannedMoments for moments without cyclePlanId", () => {
    moments$["m1"].set(
      makeMoment("m1", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-05",
      })
    );
    moments$["m2"].set(
      makeMoment("m2", {
        habitId: "habit-1",
        cyclePlanId: null,
        day: "2026-02-10",
      })
    );

    const review = service.getCycleReview("cycle-1");
    expect(review!.unplannedMoments).toHaveLength(1);
    expect(review!.unplannedMoments[0].id).toBe("m2");
  });

  it("includes firstAllocation and lastAllocation", () => {
    moments$["m1"].set(
      makeMoment("m1", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-05",
      })
    );
    moments$["m2"].set(
      makeMoment("m2", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-25",
      })
    );

    const review = service.getCycleReview("cycle-1");
    expect(review!.habits[0].firstAllocation).toBe("2026-02-05");
    expect(review!.habits[0].lastAllocation).toBe("2026-02-25");
  });

  it("includes longestGapDays", () => {
    moments$["m1"].set(
      makeMoment("m1", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-01",
      })
    );
    moments$["m2"].set(
      makeMoment("m2", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-05",
      })
    );
    moments$["m3"].set(
      makeMoment("m3", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-20",
      })
    );

    const review = service.getCycleReview("cycle-1");
    expect(review!.habits[0].longestGapDays).toBe(15);
  });
});

describe("CycleService.countAllocatedForPlan", () => {
  beforeEach(() => {
    moments$.set({});
    cyclePlans$.set({});
    cycles$.set({});
    activeCycleId$.set(null);
    storeHydrated$.set(false);
    habits$.set({});
  });

  it("returns 0 when no moments link to plan", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(service.countAllocatedForPlan("plan-1")).toBe(0);
  });

  it("counts only allocated moments (day + phase set)", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    moments$["m-1"].set({
      id: "m-1",
      name: "fiction",
      areaId: "a-1",
      habitId: "h-1",
      cycleId: "c-1",
      cyclePlanId: "plan-1",
      day: "2026-04-24",
      phase: "MORNING",
      order: 0,
      tags: [],
      emoji: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    moments$["m-2"].set({
      id: "m-2",
      name: "fiction",
      areaId: "a-1",
      habitId: "h-1",
      cycleId: "c-1",
      cyclePlanId: "plan-1",
      day: null,
      phase: null,
      order: 0,
      tags: [],
      emoji: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(service.countAllocatedForPlan("plan-1")).toBe(1);
  });
});

describe("CycleService.allocateFromPlan", () => {
  const cycle = {
    id: "c-1",
    name: "Cycle",
    startDate: "2026-04-23",
    endDate: "2026-05-06",
    intention: null,
    reflection: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const habit = {
    id: "h-1",
    name: "fiction",
    areaId: "a-1",
    attitude: null,
    phase: null,
    tags: [],
    emoji: "📖",
    isArchived: false,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    moments$.set({});
    cyclePlans$.set({});
    cycles$.set({});
    activeCycleId$.set(null);
    storeHydrated$.set(false);
    habits$.set({});

    cycles$[cycle.id].set(cycle);
    habits$[habit.id].set(habit);
  });

  it("errors when no plan exists", () => {
    const service = new CycleService();
    const result = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-04-24",
      phase: "MORNING",
    });
    expect(result).toEqual({
      error: expect.stringContaining("No budget"),
    });
  });

  it("creates an allocated moment and increases plan's allocated count", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-04-24",
      phase: "MORNING",
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.name).toBe("fiction");
    expect(result.day).toBe("2026-04-24");
    expect(result.phase).toBe("MORNING");
    expect(result.cyclePlanId).toBe("plan-1");
    expect(service.countAllocatedForPlan("plan-1")).toBe(1);
  });

  it("errors when already over budget", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const first = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-04-24",
      phase: "MORNING",
    });
    expect("error" in first).toBe(false);
    const second = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-04-25",
      phase: "MORNING",
    });
    expect(second).toEqual({
      error: expect.stringContaining("Over budget"),
    });
  });

  it("errors when slot already has 3 moments", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    for (let i = 0; i < 3; i++) {
      moments$[`m-${i}`].set({
        id: `m-${i}`,
        name: "other",
        areaId: "a-1",
        habitId: null,
        cycleId: "c-1",
        cyclePlanId: null,
        day: "2026-04-24",
        phase: "MORNING",
        order: i,
        tags: [],
        emoji: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    const result = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-04-24",
      phase: "MORNING",
    });
    expect(result).toEqual({ error: expect.stringContaining("Slot") });
  });

  it("errors when day outside cycle range (endDate set)", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-06-01",
      phase: "MORNING",
    });
    expect(result).toEqual({ error: expect.stringContaining("outside") });
  });

  it("errors when habit archived", () => {
    const service = new CycleService();
    habits$[habit.id].set({ ...habit, isArchived: true });
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-04-24",
      phase: "MORNING",
    });
    expect(result).toEqual({
      error: expect.stringContaining("archived"),
    });
  });
});
