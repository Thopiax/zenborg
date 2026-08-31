import { describe, expect, it } from "vitest";
import type { Habit, Moment, Routine, RoutineEntry } from "./vault.js";
import {
  boundaryKey,
  conciseRoutine,
  isAdjacentBoundary,
  planMaterialization,
  resolveBoundaries,
  VALID_BOUNDARIES,
  validateRoutine,
} from "./routines.js";

const stubHabit = (id: string, name: string, archived = false): Habit =>
  ({
    id,
    name,
    areaId: "area-1",
    attitude: null,
    phase: null,
    tags: [],
    emoji: null,
    isArchived: archived,
    order: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  }) as Habit;

const stubRoutine = (
  id: string,
  from: Routine["from"],
  to: Routine["to"],
  name = "Test",
): Routine => ({
  id,
  name,
  from,
  to,
  entries: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

describe("routines", () => {
  describe("isAdjacentBoundary", () => {
    it("accepts all four valid boundaries", () => {
      expect(isAdjacentBoundary("NIGHT", "MORNING")).toBe(true);
      expect(isAdjacentBoundary("MORNING", "AFTERNOON")).toBe(true);
      expect(isAdjacentBoundary("AFTERNOON", "EVENING")).toBe(true);
      expect(isAdjacentBoundary("EVENING", "NIGHT")).toBe(true);
    });

    it("rejects non-adjacent pairs", () => {
      expect(isAdjacentBoundary("MORNING", "EVENING")).toBe(false);
      expect(isAdjacentBoundary("MORNING", "NIGHT")).toBe(false);
      expect(isAdjacentBoundary("MORNING", "MORNING")).toBe(false);
    });

    it("rejects reversed adjacent pairs", () => {
      expect(isAdjacentBoundary("MORNING", "NIGHT")).toBe(false);
      expect(isAdjacentBoundary("AFTERNOON", "MORNING")).toBe(false);
    });
  });

  describe("VALID_BOUNDARIES", () => {
    it("lists four boundary keys in day order", () => {
      expect(VALID_BOUNDARIES).toEqual([
        "MORNING->AFTERNOON",
        "AFTERNOON->EVENING",
        "EVENING->NIGHT",
        "NIGHT->MORNING",
      ]);
    });
  });

  describe("validateRoutine", () => {
    const habits: Record<string, Habit> = {
      h1: stubHabit("h1", "Dream journal"),
      h2: stubHabit("h2", "Vipassana"),
      h3: stubHabit("h3", "Archived", true),
    };

    it("accepts a valid routine", () => {
      const entries: RoutineEntry[] = [
        { habitId: "h1", order: 0 },
        { habitId: "h2", order: 1 },
      ];
      const problems = validateRoutine(
        { from: "NIGHT", to: "MORNING", entries },
        habits,
        {},
      );
      expect(problems).toEqual([]);
    });

    it("rejects non-adjacent boundary", () => {
      const problems = validateRoutine(
        { from: "MORNING", to: "EVENING", entries: [] },
        habits,
        {},
      );
      expect(problems[0]).toMatch(/not an adjacent boundary/);
    });

    it("rejects duplicate boundary", () => {
      const existing: Record<string, Routine> = {
        r1: stubRoutine("r1", "NIGHT", "MORNING", "Wakeup"),
      };
      const problems = validateRoutine(
        { from: "NIGHT", to: "MORNING", entries: [] },
        habits,
        existing,
      );
      expect(problems[0]).toMatch(/already has a routine/);
    });

    it("allows same boundary on update (excludeId)", () => {
      const existing: Record<string, Routine> = {
        r1: stubRoutine("r1", "NIGHT", "MORNING", "Wakeup"),
      };
      const problems = validateRoutine(
        { from: "NIGHT", to: "MORNING", entries: [] },
        habits,
        existing,
        "r1",
      );
      expect(problems).toEqual([]);
    });

    it("rejects missing habit", () => {
      const problems = validateRoutine(
        {
          from: "NIGHT",
          to: "MORNING",
          entries: [{ habitId: "nonexistent", order: 0 }],
        },
        habits,
        {},
      );
      expect(problems[0]).toMatch(/Habit not found/);
    });

    it("rejects archived habit", () => {
      const problems = validateRoutine(
        {
          from: "NIGHT",
          to: "MORNING",
          entries: [{ habitId: "h3", order: 0 }],
        },
        habits,
        {},
      );
      expect(problems[0]).toMatch(/archived/);
    });

    it("rejects duplicate order", () => {
      const problems = validateRoutine(
        {
          from: "NIGHT",
          to: "MORNING",
          entries: [
            { habitId: "h1", order: 0 },
            { habitId: "h2", order: 0 },
          ],
        },
        habits,
        {},
      );
      expect(problems).toContainEqual(expect.stringMatching(/Duplicate order/));
    });

    it("reports all problems, not just the first", () => {
      const problems = validateRoutine(
        {
          from: "MORNING",
          to: "EVENING",
          entries: [
            { habitId: "nonexistent", order: 0 },
            { habitId: "h3", order: 0 },
          ],
        },
        habits,
        {},
      );
      expect(problems.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("conciseRoutine", () => {
    it("returns compact representation", () => {
      const r = stubRoutine("r1", "NIGHT", "MORNING", "Wakeup");
      r.entries = [
        { habitId: "h1", order: 0 },
        { habitId: "h2", order: 1 },
      ] as any;
      const c = conciseRoutine(r);
      expect(c).toEqual({
        id: "r1",
        name: "Wakeup",
        boundary: "NIGHT->MORNING",
        entries: 2,
      });
    });
  });

  describe("boundaryKey", () => {
    it("formats from->to", () => {
      expect(boundaryKey({ from: "EVENING", to: "NIGHT" })).toBe(
        "EVENING->NIGHT",
      );
    });
  });

  describe("planMaterialization", () => {
    const habits: Record<string, Habit> = {
      h1: stubHabit("h1", "Dream journal"),
      h2: stubHabit("h2", "Vipassana"),
      h3: stubHabit("h3", "Archived", true),
    };

    const wakeup: Routine = {
      ...stubRoutine("r1", "NIGHT", "MORNING", "Wakeup"),
      entries: [
        { habitId: "h1", order: 0 },
        { habitId: "h2", order: 1 },
      ],
    };

    const stubMoment = (
      habitId: string,
      day: string,
      phase: string,
    ): Moment =>
      ({
        id: `m-${habitId}-${day}`,
        name: habits[habitId]?.name ?? "unknown",
        areaId: "area-1",
        habitId,
        cycleId: null,
        cyclePlanId: null,
        phase,
        day,
        order: 0,
        tags: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      }) as Moment;

    it("plans all entries when none exist", () => {
      const plan = planMaterialization(wakeup, {}, habits, "2026-08-31");
      expect(plan).toEqual([
        { habitId: "h1", phase: "MORNING", order: 0 },
        { habitId: "h2", phase: "MORNING", order: 1 },
      ]);
    });

    it("skips entries already planted on (day, phase)", () => {
      const existing = {
        m1: stubMoment("h1", "2026-08-31", "MORNING"),
      };
      const plan = planMaterialization(wakeup, existing, habits, "2026-08-31");
      expect(plan).toEqual([
        { habitId: "h2", phase: "MORNING", order: 1 },
      ]);
    });

    it("plans nothing when all entries already exist", () => {
      const existing = {
        m1: stubMoment("h1", "2026-08-31", "MORNING"),
        m2: stubMoment("h2", "2026-08-31", "MORNING"),
      };
      const plan = planMaterialization(wakeup, existing, habits, "2026-08-31");
      expect(plan).toEqual([]);
    });

    it("does not match same habit on a different day", () => {
      const existing = {
        m1: stubMoment("h1", "2026-09-01", "MORNING"),
      };
      const plan = planMaterialization(wakeup, existing, habits, "2026-08-31");
      expect(plan).toHaveLength(2);
    });

    it("does not match same habit on a different phase", () => {
      const existing = {
        m1: stubMoment("h1", "2026-08-31", "AFTERNOON"),
      };
      const plan = planMaterialization(wakeup, existing, habits, "2026-08-31");
      expect(plan).toHaveLength(2);
    });

    it("skips archived and missing habits silently", () => {
      const routine: Routine = {
        ...stubRoutine("r2", "NIGHT", "MORNING"),
        entries: [
          { habitId: "h3", order: 0 },
          { habitId: "nonexistent", order: 1 },
          { habitId: "h1", order: 2 },
        ],
      };
      const plan = planMaterialization(routine, {}, habits, "2026-08-31");
      expect(plan).toEqual([
        { habitId: "h1", phase: "MORNING", order: 2 },
      ]);
    });

    it("returns entries sorted by order", () => {
      const routine: Routine = {
        ...stubRoutine("r3", "EVENING", "NIGHT"),
        entries: [
          { habitId: "h2", order: 5 },
          { habitId: "h1", order: 1 },
        ],
      };
      const plan = planMaterialization(routine, {}, habits, "2026-08-31");
      expect(plan[0].habitId).toBe("h1");
      expect(plan[1].habitId).toBe("h2");
      expect(plan[0].phase).toBe("NIGHT");
    });
  });

  describe("resolveBoundaries", () => {
    const defaultConfigs = [
      { phase: "MORNING" as const, startHour: 6, order: 0 },
      { phase: "AFTERNOON" as const, startHour: 12, order: 1 },
      { phase: "EVENING" as const, startHour: 18, order: 2 },
      { phase: "NIGHT" as const, startHour: 22, order: 3 },
    ];

    it("derives four boundaries from default phaseConfigs", () => {
      const b = resolveBoundaries(defaultConfigs);
      expect(b).toEqual([
        { from: "MORNING", to: "AFTERNOON", hour: 12 },
        { from: "AFTERNOON", to: "EVENING", hour: 18 },
        { from: "EVENING", to: "NIGHT", hour: 22 },
        { from: "NIGHT", to: "MORNING", hour: 6 },
      ]);
    });

    it("adjusts wake and onset boundaries with sleep anchors", () => {
      const b = resolveBoundaries(defaultConfigs, {
        wakeAnchor: 7,
        onsetAnchor: 23,
      });
      expect(b[3]).toEqual({ from: "NIGHT", to: "MORNING", hour: 7 });
      expect(b[2]).toEqual({ from: "EVENING", to: "NIGHT", hour: 23 });
      // mid-day boundaries unaffected
      expect(b[0].hour).toBe(12);
      expect(b[1].hour).toBe(18);
    });

    it("handles fractional sleep anchors", () => {
      const b = resolveBoundaries(defaultConfigs, {
        wakeAnchor: 6.5,
        onsetAnchor: 22.75,
      });
      expect(b[3].hour).toBe(6.5);
      expect(b[2].hour).toBe(22.75);
    });

    it("works with custom phase configs (shifted schedule)", () => {
      const shifted = [
        { phase: "MORNING" as const, startHour: 8, order: 0 },
        { phase: "AFTERNOON" as const, startHour: 13, order: 1 },
        { phase: "EVENING" as const, startHour: 19, order: 2 },
        { phase: "NIGHT" as const, startHour: 23, order: 3 },
      ];
      const b = resolveBoundaries(shifted);
      expect(b[0].hour).toBe(13);
      expect(b[1].hour).toBe(19);
      expect(b[2].hour).toBe(23);
      expect(b[3].hour).toBe(8);
    });

    it("sorts by order regardless of input order", () => {
      const shuffled = [
        { phase: "NIGHT" as const, startHour: 22, order: 3 },
        { phase: "MORNING" as const, startHour: 6, order: 0 },
        { phase: "EVENING" as const, startHour: 18, order: 2 },
        { phase: "AFTERNOON" as const, startHour: 12, order: 1 },
      ];
      const b = resolveBoundaries(shuffled);
      expect(b[0]).toEqual({ from: "MORNING", to: "AFTERNOON", hour: 12 });
      expect(b[3]).toEqual({ from: "NIGHT", to: "MORNING", hour: 6 });
    });

    it("without anchors, sleep boundaries use phaseConfig startHours", () => {
      const b = resolveBoundaries(defaultConfigs);
      expect(b[2].hour).toBe(22); // EVENING→NIGHT = NIGHT.startHour
      expect(b[3].hour).toBe(6); // NIGHT→MORNING = MORNING.startHour
    });
  });
});
