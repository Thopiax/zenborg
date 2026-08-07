import { describe, expect, it } from "vitest";
import {
  countMomentsInPhase,
  DAY_VIEW_PHASE_CAPACITY,
  deriveRhythmFromSchedule,
  hasDayViewCapacity,
  normalizeSchedule,
  phaseForStartTime,
  schedulePhaseError,
  scheduleRhythmError,
  timingFromSchedule,
  validateMomentTiming,
} from "./validation.js";
import type { Moment, PhaseConfig, Schedule } from "./vault.js";

/**
 * Phase bands as configured in the live vault (`phaseConfigs.json`):
 * MORNING 07–13, AFTERNOON 13–19, EVENING 19–01, NIGHT 01–07.
 */
function vaultPhaseConfigs(): PhaseConfig[] {
  const now = "2026-08-07T00:00:00.000Z";
  const bands: Array<[PhaseConfig["phase"], number, number, number]> = [
    ["MORNING", 7, 13, 0],
    ["AFTERNOON", 13, 19, 1],
    ["EVENING", 19, 1, 2],
    ["NIGHT", 1, 7, 3],
  ];
  return bands.map(([phase, startHour, endHour, order]) => ({
    id: `cfg-${phase}`,
    phase,
    label: phase,
    emoji: "•",
    color: "#000000",
    startHour,
    endHour,
    isVisible: phase !== "NIGHT",
    order,
    createdAt: now,
    updatedAt: now,
  }));
}

function moment(overrides: Partial<Moment>): Moment {
  const now = "2026-08-07T00:00:00.000Z";
  return {
    id: "m-1",
    name: "singing",
    areaId: "a-1",
    habitId: null,
    cycleId: null,
    cyclePlanId: null,
    phase: null,
    day: null,
    order: 0,
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("normalizeSchedule", () => {
  it("sorts and de-duplicates weekdays", () => {
    const result = normalizeSchedule({
      weekdays: ["SUN", "MON", "MON"],
      startTime: "14:00",
      durationMin: 60,
    });

    expect(result).toEqual({
      weekdays: ["MON", "SUN"],
      startTime: "14:00",
      durationMin: 60,
    });
  });

  it("rejects an empty weekday list", () => {
    expect(
      normalizeSchedule({ weekdays: [], startTime: "14:00", durationMin: 60 }),
    ).toEqual({ error: "Schedule must have at least one weekday" });
  });

  it("rejects a malformed start time", () => {
    expect(
      normalizeSchedule({
        weekdays: ["MON"],
        startTime: "2pm",
        durationMin: 60,
      }),
    ).toEqual({ error: "Schedule startTime must be HH:MM (24h), got: 2pm" });
  });

  it("rejects a non-positive duration", () => {
    expect(
      normalizeSchedule({
        weekdays: ["MON"],
        startTime: "14:00",
        durationMin: 0,
      }),
    ).toEqual({
      error: "Schedule durationMin must be a positive whole number of minutes",
    });
  });
});

describe("deriveRhythmFromSchedule", () => {
  it("counts one occurrence per scheduled weekday", () => {
    const schedule: Schedule = {
      weekdays: ["MON", "THU"],
      startTime: "14:00",
      durationMin: 60,
    };

    expect(deriveRhythmFromSchedule(schedule)).toEqual({
      period: "weekly",
      count: 2,
    });
  });
});

describe("scheduleRhythmError", () => {
  const schedule: Schedule = {
    weekdays: ["MON"],
    startTime: "14:00",
    durationMin: 60,
  };

  it("passes a matching weekly rhythm", () => {
    expect(
      scheduleRhythmError(schedule, { period: "weekly", count: 1 }),
    ).toBeNull();
  });

  it("fails a mismatched weekly rhythm", () => {
    expect(scheduleRhythmError(schedule, { period: "weekly", count: 3 })).toBe(
      "Weekly rhythm count (3) must equal the number of scheduled weekdays (1)",
    );
  });

  it("leaves longer periods alone", () => {
    expect(
      scheduleRhythmError(schedule, { period: "monthly", count: 2 }),
    ).toBeNull();
  });
});

describe("phaseForStartTime", () => {
  const configs = vaultPhaseConfigs();

  it("maps clock times onto the configured bands", () => {
    expect(phaseForStartTime("09:30", configs)).toBe("MORNING");
    expect(phaseForStartTime("14:00", configs)).toBe("AFTERNOON");
    expect(phaseForStartTime("20:00", configs)).toBe("EVENING");
  });

  it("handles the band that wraps midnight", () => {
    expect(phaseForStartTime("00:30", configs)).toBe("EVENING");
  });

  it("maps a late-night time to the hidden NIGHT band", () => {
    expect(phaseForStartTime("03:00", configs)).toBe("NIGHT");
  });

  it("returns null when no band covers the hour", () => {
    expect(phaseForStartTime("22:00", [configs[0]])).toBeNull();
  });
});

describe("schedulePhaseError", () => {
  const configs = vaultPhaseConfigs();
  const schedule: Schedule = {
    weekdays: ["MON"],
    startTime: "14:00",
    durationMin: 60,
  };

  it("passes a matching phase", () => {
    expect(schedulePhaseError(schedule, "AFTERNOON", configs)).toBeNull();
  });

  it("fails a contradicting phase", () => {
    expect(schedulePhaseError(schedule, "MORNING", configs)).toBe(
      "Phase MORNING contradicts startTime 14:00, which falls in AFTERNOON",
    );
  });

  it("passes when no phase is declared", () => {
    expect(schedulePhaseError(schedule, null, configs)).toBeNull();
  });
});

describe("timingFromSchedule", () => {
  it("hands the habit timing down to a spawned moment", () => {
    expect(
      timingFromSchedule({
        weekdays: ["SUN"],
        startTime: "12:00",
        durationMin: 90,
      }),
    ).toEqual({ startTime: "12:00", durationMin: 90 });
  });
});

describe("validateMomentTiming", () => {
  it("passes absent timing", () => {
    expect(validateMomentTiming(undefined, undefined)).toBeNull();
  });

  it("rejects a malformed start time", () => {
    expect(validateMomentTiming("24:00", undefined)).toBe(
      "Moment startTime must be HH:MM (24h), got: 24:00",
    );
  });

  it("rejects a non-positive duration", () => {
    expect(validateMomentTiming(undefined, 0)).toBe(
      "Moment durationMin must be a positive whole number of minutes",
    );
  });
});

describe("day-view phase capacity", () => {
  const day = "2026-08-10";
  const filled = [
    moment({ id: "m-1", day, phase: "MORNING" }),
    moment({ id: "m-2", day, phase: "MORNING" }),
    moment({ id: "m-3", day, phase: "MORNING" }),
  ];

  it("is three", () => {
    expect(DAY_VIEW_PHASE_CAPACITY).toBe(3);
  });

  it("counts the moments in a slot", () => {
    expect(countMomentsInPhase(filled, day, "MORNING")).toBe(3);
  });

  it("excludes the moment being moved", () => {
    expect(countMomentsInPhase(filled, day, "MORNING", "m-2")).toBe(2);
  });

  it("reports the slot as beyond day-view capacity", () => {
    expect(hasDayViewCapacity(filled, day, "MORNING")).toBe(false);
    expect(hasDayViewCapacity(filled.slice(0, 2), day, "MORNING")).toBe(true);
  });
});
