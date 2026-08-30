import { describe, expect, it } from "vitest";
import type { Habit, Routine, RoutineEntry } from "./vault.js";
import {
  boundaryKey,
  conciseRoutine,
  isAdjacentBoundary,
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
});
