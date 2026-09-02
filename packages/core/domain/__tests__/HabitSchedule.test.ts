import { describe, expect, it } from "vitest";
import { createHabit, isHabitError, updateHabit } from "../entities/Habit";
import { Phase, type PhaseConfig } from "../value-objects/Phase";
import { Weekday } from "../value-objects/Schedule";

/**
 * Phase bands as configured in the live vault (`phaseConfigs.json`):
 * MORNING 07–13, AFTERNOON 13–19, EVENING 19–01, NIGHT 01–07.
 */
function vaultPhaseConfigs(): PhaseConfig[] {
  const now = "2026-08-07T00:00:00.000Z";
  const bands: Array<[Phase, number, number, number]> = [
    [Phase.MORNING, 7, 13, 0],
    [Phase.AFTERNOON, 13, 19, 1],
    [Phase.EVENING, 19, 1, 2],
    [Phase.NIGHT, 1, 7, 3],
  ];
  return bands.map(([phase, startHour, endHour, order]) => ({
    id: `cfg-${phase}`,
    phase,
    label: phase,
    emoji: "•",
    startHour,
    endHour,
    isVisible: phase !== Phase.NIGHT,
    order,
    createdAt: now,
    updatedAt: now,
  }));
}

const singing = {
  name: "singing",
  areaId: "area-1",
  order: 0,
};

describe("Habit schedule", () => {
  describe("createHabit", () => {
    it("stores a schedule when one is declared", () => {
      const habit = createHabit({
        ...singing,
        schedule: {
          weekdays: [Weekday.MON],
          startTime: "14:00",
          durationMin: 60,
        },
      });

      if (isHabitError(habit)) throw new Error(habit.error);
      expect(habit.schedule).toEqual({
        weekdays: [Weekday.MON],
        startTime: "14:00",
        durationMin: 60,
      });
    });

    it("leaves ambient habits untouched — no schedule key at all", () => {
      const habit = createHabit(singing);

      if (isHabitError(habit)) throw new Error(habit.error);
      expect("schedule" in habit).toBe(false);
    });

    it("normalizes weekday order", () => {
      const habit = createHabit({
        ...singing,
        schedule: {
          weekdays: [Weekday.SUN, Weekday.MON],
          startTime: "12:00",
          durationMin: 90,
        },
      });

      if (isHabitError(habit)) throw new Error(habit.error);
      expect(habit.schedule?.weekdays).toEqual([Weekday.MON, Weekday.SUN]);
    });

    it("rejects a malformed start time", () => {
      const habit = createHabit({
        ...singing,
        schedule: {
          weekdays: [Weekday.MON],
          startTime: "2pm",
          durationMin: 60,
        },
      });

      expect(habit).toEqual({
        error: "Schedule startTime must be HH:MM (24h), got: 2pm",
      });
    });

    it("derives a weekly rhythm from the weekdays when none is declared", () => {
      const habit = createHabit({
        ...singing,
        schedule: {
          weekdays: [Weekday.MON, Weekday.THU],
          startTime: "14:00",
          durationMin: 60,
        },
      });

      if (isHabitError(habit)) throw new Error(habit.error);
      expect(habit.rhythm).toEqual({ period: "weekly", count: 2 });
    });

    it("rejects a weekly rhythm that disagrees with the weekdays", () => {
      const habit = createHabit({
        ...singing,
        rhythm: { period: "weekly", count: 3 },
        schedule: {
          weekdays: [Weekday.MON],
          startTime: "14:00",
          durationMin: 60,
        },
      });

      expect(habit).toEqual({
        error:
          "Weekly rhythm count (3) must equal the number of scheduled weekdays (1)",
      });
    });

    it("keeps a longer-period rhythm alongside a schedule", () => {
      const habit = createHabit({
        ...singing,
        rhythm: { period: "biweekly", count: 1 },
        schedule: {
          weekdays: [Weekday.MON],
          startTime: "14:00",
          durationMin: 60,
        },
      });

      if (isHabitError(habit)) throw new Error(habit.error);
      expect(habit.rhythm).toEqual({ period: "biweekly", count: 1 });
    });

    it("derives phase from the start time when phase configs are supplied", () => {
      const habit = createHabit({
        ...singing,
        phaseConfigs: vaultPhaseConfigs(),
        schedule: {
          weekdays: [Weekday.MON],
          startTime: "14:00",
          durationMin: 60,
        },
      });

      if (isHabitError(habit)) throw new Error(habit.error);
      expect(habit.phase).toBe(Phase.AFTERNOON);
    });

    it("rejects a phase that contradicts the start time", () => {
      const habit = createHabit({
        ...singing,
        phase: Phase.MORNING,
        phaseConfigs: vaultPhaseConfigs(),
        schedule: {
          weekdays: [Weekday.MON],
          startTime: "14:00",
          durationMin: 60,
        },
      });

      expect(habit).toEqual({
        error:
          "Phase MORNING contradicts startTime 14:00, which falls in AFTERNOON",
      });
    });

    it("leaves phase alone when no phase configs are supplied", () => {
      const habit = createHabit({
        ...singing,
        phase: Phase.MORNING,
        schedule: {
          weekdays: [Weekday.MON],
          startTime: "14:00",
          durationMin: 60,
        },
      });

      if (isHabitError(habit)) throw new Error(habit.error);
      expect(habit.phase).toBe(Phase.MORNING);
    });
  });

  describe("updateHabit", () => {
    it("attaches a schedule to an existing ambient habit", () => {
      const created = createHabit(singing);
      if (isHabitError(created)) throw new Error(created.error);

      const updated = updateHabit(created, {
        schedule: {
          weekdays: [Weekday.WED],
          startTime: "16:00",
          durationMin: 120,
        },
      });

      if (isHabitError(updated)) throw new Error(updated.error);
      expect(updated.schedule).toEqual({
        weekdays: [Weekday.WED],
        startTime: "16:00",
        durationMin: 120,
      });
      expect(updated.rhythm).toEqual({ period: "weekly", count: 1 });
    });

    it("clears a schedule with undefined", () => {
      const created = createHabit({
        ...singing,
        schedule: {
          weekdays: [Weekday.MON],
          startTime: "14:00",
          durationMin: 60,
        },
      });
      if (isHabitError(created)) throw new Error(created.error);

      const updated = updateHabit(created, { schedule: undefined });

      if (isHabitError(updated)) throw new Error(updated.error);
      expect(updated.schedule).toBeUndefined();
    });

    it("rejects a malformed start time on update", () => {
      const created = createHabit(singing);
      if (isHabitError(created)) throw new Error(created.error);

      const updated = updateHabit(created, {
        schedule: {
          weekdays: [Weekday.MON],
          startTime: "25:00",
          durationMin: 60,
        },
      });

      expect(updated).toEqual({
        error: "Schedule startTime must be HH:MM (24h), got: 25:00",
      });
    });

    it("rejects a phase change that contradicts the standing schedule", () => {
      const created = createHabit({
        ...singing,
        phaseConfigs: vaultPhaseConfigs(),
        schedule: {
          weekdays: [Weekday.MON],
          startTime: "14:00",
          durationMin: 60,
        },
      });
      if (isHabitError(created)) throw new Error(created.error);

      const updated = updateHabit(
        created,
        { phase: Phase.EVENING },
        vaultPhaseConfigs(),
      );

      expect(updated).toEqual({
        error:
          "Phase EVENING contradicts startTime 14:00, which falls in AFTERNOON",
      });
    });

    it("rejects a weekly rhythm that disagrees with the standing schedule", () => {
      const created = createHabit({
        ...singing,
        schedule: {
          weekdays: [Weekday.MON],
          startTime: "14:00",
          durationMin: 60,
        },
      });
      if (isHabitError(created)) throw new Error(created.error);

      const updated = updateHabit(created, {
        rhythm: { period: "weekly", count: 4 },
      });

      expect(updated).toEqual({
        error:
          "Weekly rhythm count (4) must equal the number of scheduled weekdays (1)",
      });
    });
  });
});
