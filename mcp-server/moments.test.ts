import { describe, expect, it } from "vitest";
import {
  type AddMomentContext,
  type AddMomentInput,
  resolveAddMoment,
} from "./moments.js";
import type { Area, Cycle, CyclePlan, Habit, PhaseConfig } from "./vault.js";

const NOW = new Date("2026-08-29T10:00:00Z");

function makeArea(overrides: Partial<Area> = {}): Area {
  return {
    id: "area-1",
    name: "Work",
    color: "#aabbcc",
    emoji: "💼",
    isDefault: false,
    order: 0,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "habit-1",
    name: "deep work",
    areaId: "area-1",
    attitude: "KEEPING",
    phase: "MORNING",
    tags: ["focus"],
    emoji: "🧠",
    isArchived: false,
    order: 0,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function makeCycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    id: "cycle-1",
    name: "Sprint 1",
    startDate: "2026-08-25",
    endDate: "2026-09-01",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function makePlan(overrides: Partial<CyclePlan> = {}): CyclePlan {
  return {
    id: "plan-1",
    cycleId: "cycle-1",
    habitId: "habit-1",
    budgetedCount: 5,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function makePhaseConfig(
  phase: "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT",
  startHour: number,
  endHour: number,
  order: number,
): PhaseConfig {
  return {
    id: `pc-${phase}`,
    phase,
    label: phase,
    emoji: "",
    color: "#000000",
    startHour,
    endHour,
    isVisible: true,
    order,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

const DEFAULT_PHASE_CONFIGS: Record<string, PhaseConfig> = {
  "pc-MORNING": makePhaseConfig("MORNING", 6, 12, 0),
  "pc-AFTERNOON": makePhaseConfig("AFTERNOON", 12, 17, 1),
  "pc-EVENING": makePhaseConfig("EVENING", 17, 21, 2),
  "pc-NIGHT": makePhaseConfig("NIGHT", 21, 6, 3),
};

function baseCtx(overrides: Partial<AddMomentContext> = {}): AddMomentContext {
  return {
    areas: { "area-1": makeArea() },
    habits: { "habit-1": makeHabit() },
    cycles: {},
    cyclePlans: {},
    moments: {},
    phaseConfigs: DEFAULT_PHASE_CONFIGS,
    now: NOW,
    ...overrides,
  };
}

describe("resolveAddMoment", () => {
  describe("identity gate", () => {
    it("fails when neither habitId nor name+areaId provided", () => {
      const result = resolveAddMoment({}, baseCtx());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("pass habitId");
    });

    it("fails when only name provided (no areaId)", () => {
      const result = resolveAddMoment({ name: "test" }, baseCtx());
      expect(result.ok).toBe(false);
    });

    it("fails when only areaId provided (no name)", () => {
      const result = resolveAddMoment({ areaId: "area-1" }, baseCtx());
      expect(result.ok).toBe(false);
    });

    it("succeeds with habitId alone (drawing board)", () => {
      const result = resolveAddMoment({ habitId: "habit-1" }, baseCtx());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.moment.name).toBe("deep work");
        expect(result.moment.areaId).toBe("area-1");
        expect(result.moment.habitId).toBe("habit-1");
      }
    });

    it("succeeds with name+areaId (standalone)", () => {
      const result = resolveAddMoment(
        { name: "call sasa", areaId: "area-1", phase: "EVENING" },
        baseCtx(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.moment.name).toBe("call sasa");
        expect(result.moment.habitId).toBeNull();
      }
    });
  });

  describe("habit inheritance", () => {
    it("inherits name from habit when not overridden", () => {
      const result = resolveAddMoment({ habitId: "habit-1" }, baseCtx());
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.name).toBe("deep work");
    });

    it("overrides name while keeping habitId", () => {
      const result = resolveAddMoment(
        { habitId: "habit-1", name: "themia data" },
        baseCtx(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.moment.name).toBe("themia data");
        expect(result.moment.habitId).toBe("habit-1");
      }
    });

    it("inherits emoji and tags from habit", () => {
      const result = resolveAddMoment({ habitId: "habit-1" }, baseCtx());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.moment.emoji).toBe("🧠");
        expect(result.moment.tags).toEqual(["focus"]);
      }
    });

    it("overrides emoji when explicitly set", () => {
      const result = resolveAddMoment(
        { habitId: "habit-1", emoji: "🔥" },
        baseCtx(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.emoji).toBe("🔥");
    });

    it("inherits schedule timing from habit", () => {
      const habit = makeHabit({
        schedule: { weekdays: ["MON"], startTime: "09:00", durationMin: 90 },
      });
      const ctx = baseCtx({ habits: { "habit-1": habit } });
      const result = resolveAddMoment(
        { habitId: "habit-1", day: "2026-08-29" },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.moment.startTime).toBe("09:00");
        expect(result.moment.durationMin).toBe(90);
        expect(result.moment.phase).toBe("MORNING");
      }
    });

    it("fails when habit is archived", () => {
      const habit = makeHabit({ isArchived: true });
      const ctx = baseCtx({ habits: { "habit-1": habit } });
      const result = resolveAddMoment({ habitId: "habit-1" }, ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("archived");
    });

    it("fails when habit not found", () => {
      const result = resolveAddMoment(
        { habitId: "nonexistent" },
        baseCtx({ habits: {} }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("not found");
    });
  });

  describe("name/area validation", () => {
    it("fails on 4-word name", () => {
      const result = resolveAddMoment(
        { name: "one two three four", areaId: "area-1" },
        baseCtx(),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("3 words");
    });

    it("fails when area not found", () => {
      const result = resolveAddMoment(
        { name: "test", areaId: "nonexistent" },
        baseCtx(),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("not found");
    });

});

  describe("phase derivation", () => {
    it("uses explicit phase", () => {
      const result = resolveAddMoment(
        { name: "test", areaId: "area-1", day: "2026-08-29", phase: "EVENING" },
        baseCtx(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.phase).toBe("EVENING");
    });

    it("derives phase from startTime", () => {
      const result = resolveAddMoment(
        {
          name: "test",
          areaId: "area-1",
          day: "2026-08-29",
          startTime: "14:30",
        },
        baseCtx(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.phase).toBe("AFTERNOON");
    });

    it("startTime-derived phase overrides explicit phase", () => {
      const result = resolveAddMoment(
        {
          name: "test",
          areaId: "area-1",
          day: "2026-08-29",
          phase: "MORNING",
          startTime: "14:30",
        },
        baseCtx(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.phase).toBe("AFTERNOON");
    });

    it("fails when day given but no phase derivable", () => {
      const result = resolveAddMoment(
        { name: "test", areaId: "area-1", day: "2026-08-29" },
        baseCtx(),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("phase is required");
    });

    it("drawing board moment can carry a phase preference", () => {
      const result = resolveAddMoment(
        { name: "test", areaId: "area-1", phase: "MORNING" },
        baseCtx(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.moment.phase).toBe("MORNING");
        expect(result.moment.day).toBeNull();
      }
    });
  });

  describe("cycle inheritance", () => {
    it("inherits cycleId when day falls within a cycle", () => {
      const ctx = baseCtx({ cycles: { "cycle-1": makeCycle() } });
      const result = resolveAddMoment(
        { name: "test", areaId: "area-1", day: "2026-08-29", phase: "MORNING" },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.cycleId).toBe("cycle-1");
    });

    it("picks latest-starting cycle when multiple cover the day", () => {
      const ctx = baseCtx({
        cycles: {
          "cycle-1": makeCycle({
            startDate: "2026-08-01",
            endDate: "2026-09-30",
          }),
          "cycle-2": makeCycle({
            id: "cycle-2",
            startDate: "2026-08-20",
            endDate: "2026-09-05",
          }),
        },
      });
      const result = resolveAddMoment(
        { name: "test", areaId: "area-1", day: "2026-08-29", phase: "MORNING" },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.cycleId).toBe("cycle-2");
    });

    it("cycleId is null when no cycle covers the day", () => {
      const ctx = baseCtx({
        cycles: {
          "cycle-1": makeCycle({
            startDate: "2026-07-01",
            endDate: "2026-07-31",
          }),
        },
      });
      const result = resolveAddMoment(
        { name: "test", areaId: "area-1", day: "2026-08-29", phase: "MORNING" },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.cycleId).toBeNull();
    });

    it("drawing board has null cycleId", () => {
      const result = resolveAddMoment(
        { name: "test", areaId: "area-1" },
        baseCtx({ cycles: { "cycle-1": makeCycle() } }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.cycleId).toBeNull();
    });
  });

  describe("plan linkage (fromPlan)", () => {
    it("links to plan on success", () => {
      const ctx = baseCtx({
        cycles: { "cycle-1": makeCycle() },
        cyclePlans: { "plan-1": makePlan() },
      });
      const result = resolveAddMoment(
        {
          habitId: "habit-1",
          day: "2026-08-29",
          phase: "MORNING",
          fromPlan: true,
        },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.cyclePlanId).toBe("plan-1");
    });

    it("fails when fromPlan but no habitId", () => {
      const result = resolveAddMoment(
        {
          name: "test",
          areaId: "area-1",
          day: "2026-08-29",
          phase: "MORNING",
          fromPlan: true,
        },
        baseCtx(),
      );
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error).toContain("fromPlan requires habitId");
    });

    it("fails when fromPlan but no day", () => {
      const result = resolveAddMoment(
        { habitId: "habit-1", fromPlan: true },
        baseCtx(),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("fromPlan requires day");
    });

    it("fails when no cycle covers the day", () => {
      const result = resolveAddMoment(
        {
          habitId: "habit-1",
          day: "2026-08-29",
          phase: "MORNING",
          fromPlan: true,
        },
        baseCtx(),
      );
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error).toContain("no cycle covers 2026-08-29");
    });

    it("fails when no plan exists for habit in cycle", () => {
      const ctx = baseCtx({ cycles: { "cycle-1": makeCycle() } });
      const result = resolveAddMoment(
        {
          habitId: "habit-1",
          day: "2026-08-29",
          phase: "MORNING",
          fromPlan: true,
        },
        ctx,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("no budget");
    });

    it("fails when budget exhausted, suggests spontaneous", () => {
      const plan = makePlan({ budgetedCount: 1 });
      const existingMoment = {
        id: "m-existing",
        name: "deep work",
        areaId: "area-1",
        habitId: "habit-1",
        cycleId: "cycle-1",
        cyclePlanId: "plan-1",
        phase: "MORNING" as const,
        day: "2026-08-27",
        order: 0,
        emoji: null,
        tags: [],
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      };
      const ctx = baseCtx({
        cycles: { "cycle-1": makeCycle() },
        cyclePlans: { "plan-1": plan },
        moments: { "m-existing": existingMoment },
      });
      const result = resolveAddMoment(
        {
          habitId: "habit-1",
          day: "2026-08-29",
          phase: "MORNING",
          fromPlan: true,
        },
        ctx,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("over budget");
        expect(result.error).toContain("spontaneous");
      }
    });

    it("fails when day is outside cycle range", () => {
      const ctx = baseCtx({
        cycles: {
          "cycle-1": makeCycle({
            startDate: "2026-08-25",
            endDate: "2026-08-28",
          }),
        },
        cyclePlans: { "plan-1": makePlan() },
      });
      const result = resolveAddMoment(
        {
          habitId: "habit-1",
          day: "2026-08-29",
          phase: "MORNING",
          fromPlan: true,
        },
        ctx,
      );
      expect(result.ok).toBe(false);
    });

    it("spontaneous by default (fromPlan omitted)", () => {
      const ctx = baseCtx({ cycles: { "cycle-1": makeCycle() } });
      const result = resolveAddMoment(
        { habitId: "habit-1", day: "2026-08-29", phase: "MORNING" },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.cyclePlanId).toBeNull();
    });
  });

  describe("allocation and dayViewOverflow", () => {
    it("defaults order to slot count", () => {
      const existingMoment = {
        id: "m-1",
        name: "existing",
        areaId: "area-1",
        habitId: null,
        cycleId: null,
        cyclePlanId: null,
        phase: "MORNING" as const,
        day: "2026-08-29",
        order: 0,
        emoji: null,
        tags: [],
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      };
      const ctx = baseCtx({ moments: { "m-1": existingMoment } });
      const result = resolveAddMoment(
        { name: "test", areaId: "area-1", day: "2026-08-29", phase: "MORNING" },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.order).toBe(1);
    });

    it("no dayViewOverflow at 3 or fewer", () => {
      const result = resolveAddMoment(
        { name: "test", areaId: "area-1", day: "2026-08-29", phase: "MORNING" },
        baseCtx(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.dayViewOverflow).toBeUndefined();
    });

    it("reports dayViewOverflow at 4th moment", () => {
      const makeMomentInSlot = (id: string, order: number) => ({
        id,
        name: "x",
        areaId: "area-1",
        habitId: null,
        cycleId: null,
        cyclePlanId: null,
        phase: "MORNING" as const,
        day: "2026-08-29",
        order,
        emoji: null,
        tags: [] as string[],
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      });
      const ctx = baseCtx({
        moments: {
          "m-1": makeMomentInSlot("m-1", 0),
          "m-2": makeMomentInSlot("m-2", 1),
          "m-3": makeMomentInSlot("m-3", 2),
        },
      });
      const result = resolveAddMoment(
        {
          name: "fourth",
          areaId: "area-1",
          day: "2026-08-29",
          phase: "MORNING",
        },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.dayViewOverflow).toBe(4);
    });
  });

  describe("drawing board", () => {
    it("no day → null day, null phase (when no phase given), null cyclePlanId", () => {
      const result = resolveAddMoment(
        { name: "think", areaId: "area-1" },
        baseCtx(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.moment.day).toBeNull();
        expect(result.moment.phase).toBeNull();
        expect(result.moment.cyclePlanId).toBeNull();
        expect(result.moment.cycleId).toBeNull();
      }
    });
  });

  describe("payload fields", () => {
    it("passes personIds through", () => {
      const result = resolveAddMoment(
        { name: "lunch", areaId: "area-1", personIds: ["alice", "bob"] },
        baseCtx(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.personIds).toEqual(["alice", "bob"]);
    });

    it("slugifies placeIds", () => {
      const result = resolveAddMoment(
        { name: "lunch", areaId: "area-1", placeIds: ["Café Noir"] },
        baseCtx(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.placeIds).toEqual(["cafe-noir"]);
    });

    it("normalizes refs", () => {
      const result = resolveAddMoment(
        {
          name: "code",
          areaId: "area-1",
          refs: ["https://github.com/foo/bar"],
        },
        baseCtx(),
      );
      expect(result.ok).toBe(true);
      if (result.ok)
        expect(result.moment.refs).toEqual(["https://github.com/foo/bar"]);
    });

    it("validates invalid refs", () => {
      const result = resolveAddMoment(
        { name: "code", areaId: "area-1", refs: ["not-a-url"] },
        baseCtx(),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("not a parseable URL");
    });

    it("passes status through", () => {
      const result = resolveAddMoment(
        { name: "maybe", areaId: "area-1", status: "tentative" },
        baseCtx(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.moment.status).toBe("tentative");
    });
  });
});
