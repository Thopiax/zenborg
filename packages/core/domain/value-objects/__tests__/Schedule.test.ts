import { describe, expect, it } from "vitest";
import { Phase, type PhaseConfig } from "../Phase";
import type { Rhythm } from "../Rhythm";
import {
  createSchedule,
  deriveRhythmFromSchedule,
  isScheduleError,
  isValidStartTime,
  phaseForStartTime,
  schedulePhaseError,
  scheduleRhythmError,
  startTimeHour,
  WEEKDAY_ORDER,
  Weekday,
} from "../Schedule";

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

describe("Schedule", () => {
  describe("isValidStartTime", () => {
    it("accepts zero-padded 24h times", () => {
      expect(isValidStartTime("00:00")).toBe(true);
      expect(isValidStartTime("09:05")).toBe(true);
      expect(isValidStartTime("14:00")).toBe(true);
      expect(isValidStartTime("23:59")).toBe(true);
    });

    it("rejects unpadded hours", () => {
      expect(isValidStartTime("9:05")).toBe(false);
    });

    it("rejects hours past 23", () => {
      expect(isValidStartTime("24:00")).toBe(false);
    });

    it("rejects minutes past 59", () => {
      expect(isValidStartTime("12:60")).toBe(false);
    });

    it("rejects non-time strings", () => {
      expect(isValidStartTime("afternoon")).toBe(false);
      expect(isValidStartTime("")).toBe(false);
      expect(isValidStartTime("12:5")).toBe(false);
    });
  });

  describe("startTimeHour", () => {
    it("extracts the hour", () => {
      expect(startTimeHour("14:30")).toBe(14);
      expect(startTimeHour("00:15")).toBe(0);
    });
  });

  describe("createSchedule", () => {
    it("builds a schedule from weekdays, start time, and duration", () => {
      const result = createSchedule({
        weekdays: [Weekday.MON],
        startTime: "14:00",
        durationMin: 60,
      });

      expect(isScheduleError(result)).toBe(false);
      expect(result).toEqual({
        weekdays: [Weekday.MON],
        startTime: "14:00",
        durationMin: 60,
      });
    });

    it("sorts weekdays into MON..SUN order", () => {
      const result = createSchedule({
        weekdays: [Weekday.SUN, Weekday.WED, Weekday.MON],
        startTime: "12:00",
        durationMin: 90,
      });

      expect(isScheduleError(result)).toBe(false);
      if (isScheduleError(result)) return;
      expect(result.weekdays).toEqual([Weekday.MON, Weekday.WED, Weekday.SUN]);
    });

    it("de-duplicates weekdays", () => {
      const result = createSchedule({
        weekdays: [Weekday.MON, Weekday.MON],
        startTime: "12:00",
        durationMin: 30,
      });

      expect(isScheduleError(result)).toBe(false);
      if (isScheduleError(result)) return;
      expect(result.weekdays).toEqual([Weekday.MON]);
    });

    it("rejects an empty weekday list", () => {
      const result = createSchedule({
        weekdays: [],
        startTime: "12:00",
        durationMin: 30,
      });

      expect(result).toEqual({
        error: "Schedule must have at least one weekday",
      });
    });

    it("rejects an invalid start time", () => {
      const result = createSchedule({
        weekdays: [Weekday.MON],
        startTime: "2pm",
        durationMin: 30,
      });

      expect(result).toEqual({
        error: "Schedule startTime must be HH:MM (24h), got: 2pm",
      });
    });

    it("rejects a non-positive duration", () => {
      const result = createSchedule({
        weekdays: [Weekday.MON],
        startTime: "12:00",
        durationMin: 0,
      });

      expect(result).toEqual({
        error:
          "Schedule durationMin must be a positive whole number of minutes",
      });
    });

    it("rejects a fractional duration", () => {
      const result = createSchedule({
        weekdays: [Weekday.MON],
        startTime: "12:00",
        durationMin: 30.5,
      });

      expect(result).toEqual({
        error:
          "Schedule durationMin must be a positive whole number of minutes",
      });
    });
  });

  describe("WEEKDAY_ORDER", () => {
    it("runs Monday through Sunday", () => {
      expect(WEEKDAY_ORDER).toEqual([
        Weekday.MON,
        Weekday.TUE,
        Weekday.WED,
        Weekday.THU,
        Weekday.FRI,
        Weekday.SAT,
        Weekday.SUN,
      ]);
    });
  });

  describe("deriveRhythmFromSchedule", () => {
    it("reads the weekly count off the weekday list", () => {
      const schedule = createSchedule({
        weekdays: [Weekday.MON, Weekday.THU],
        startTime: "14:00",
        durationMin: 60,
      });
      if (isScheduleError(schedule)) throw new Error("setup failed");

      expect(deriveRhythmFromSchedule(schedule)).toEqual({
        period: "weekly",
        count: 2,
      });
    });
  });

  describe("scheduleRhythmError", () => {
    const schedule = {
      weekdays: [Weekday.MON],
      startTime: "14:00",
      durationMin: 60,
    };

    it("passes when a weekly rhythm matches the weekday count", () => {
      const rhythm: Rhythm = { period: "weekly", count: 1 };
      expect(scheduleRhythmError(schedule, rhythm)).toBeNull();
    });

    it("fails when a weekly rhythm disagrees with the weekday count", () => {
      const rhythm: Rhythm = { period: "weekly", count: 3 };
      expect(scheduleRhythmError(schedule, rhythm)).toBe(
        "Weekly rhythm count (3) must equal the number of scheduled weekdays (1)",
      );
    });

    it("leaves non-weekly rhythms alone — weekdays are candidate days, not a cadence", () => {
      const rhythm: Rhythm = { period: "biweekly", count: 1 };
      expect(scheduleRhythmError(schedule, rhythm)).toBeNull();
    });
  });

  describe("phaseForStartTime", () => {
    const configs = vaultPhaseConfigs();

    it("maps a morning time to MORNING", () => {
      expect(phaseForStartTime("09:30", configs)).toBe(Phase.MORNING);
    });

    it("maps an afternoon time to AFTERNOON", () => {
      expect(phaseForStartTime("14:00", configs)).toBe(Phase.AFTERNOON);
    });

    it("maps an evening time to EVENING", () => {
      expect(phaseForStartTime("20:00", configs)).toBe(Phase.EVENING);
    });

    it("handles the band that wraps midnight", () => {
      expect(phaseForStartTime("00:30", configs)).toBe(Phase.EVENING);
    });

    it("maps a late-night time to NIGHT even though NIGHT is hidden", () => {
      expect(phaseForStartTime("03:00", configs)).toBe(Phase.NIGHT);
    });

    it("returns null when no band covers the hour", () => {
      const partial = configs.filter((c) => c.phase === Phase.MORNING);
      expect(phaseForStartTime("22:00", partial)).toBeNull();
    });
  });

  describe("schedulePhaseError", () => {
    const configs = vaultPhaseConfigs();
    const schedule = {
      weekdays: [Weekday.MON],
      startTime: "14:00",
      durationMin: 60,
    };

    it("passes when the phase matches the band the start time falls in", () => {
      expect(schedulePhaseError(schedule, Phase.AFTERNOON, configs)).toBeNull();
    });

    it("fails when the phase contradicts the start time", () => {
      expect(schedulePhaseError(schedule, Phase.MORNING, configs)).toBe(
        "Phase MORNING contradicts startTime 14:00, which falls in AFTERNOON",
      );
    });

    it("passes when no phase is declared", () => {
      expect(schedulePhaseError(schedule, null, configs)).toBeNull();
    });

    it("passes when no band covers the start time — nothing to contradict", () => {
      const partial = configs.filter((c) => c.phase === Phase.MORNING);
      expect(schedulePhaseError(schedule, Phase.EVENING, partial)).toBeNull();
    });
  });
});
