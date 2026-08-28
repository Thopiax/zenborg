import { describe, expect, it } from "vitest";
import {
  sleepToMomentFields,
  type SleepMomentConfig,
} from "../SleepMomentService.ts";
import type { SleepNight } from "../SleepPhaseService.ts";

const config: SleepMomentConfig = {
  habitId: "habit-sleep-1",
  areaId: "area-rest-1",
};

// 2026-08-27 sleep: start 05:49 Paris, end 12:50 Paris (UTC 03:49 - 10:50)
// These are the real values from Garmin for that night.
const night: SleepNight = {
  sleep_start: 1787802559000,
  sleep_end: 1787827819000,
  sleep_score: 85,
  sleep_hours: 6.97,
};

const TZ = "Europe/Paris";

describe("sleepToMomentFields", () => {
  it("converts a sleep night into moment fields", () => {
    const result = sleepToMomentFields(night, config, TZ);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("sleep");
    expect(result!.areaId).toBe("area-rest-1");
    expect(result!.habitId).toBe("habit-sleep-1");
  });

  it("places the moment on the calendar date of sleep_start", () => {
    const result = sleepToMomentFields(night, config, TZ);
    expect(result!.day).toBe("2026-08-27");
  });

  it("derives startTime from sleep_start local hour", () => {
    const result = sleepToMomentFields(night, config, TZ);
    // 1787802559000 in Europe/Paris = 05:49
    // Snapped to 15-min grid: 05:45
    expect(result!.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(result!.startTime).toBe("05:45");
  });

  it("derives durationMin from the sleep window, snapped to grid", () => {
    const result = sleepToMomentFields(night, config, TZ);
    // ~7h01m = 421 min, snapped to 15-min grid = 420
    expect(result!.durationMin).toBe(420);
    expect(result!.durationMin! % 15).toBe(0);
  });

  it("sets phase to NIGHT", () => {
    const result = sleepToMomentFields(night, config, TZ);
    expect(result!.phase).toBe("NIGHT");
  });

  it("returns null for a night with no data", () => {
    expect(sleepToMomentFields({}, config, TZ)).toBeNull();
  });

  it("returns null when sleep_start is missing", () => {
    expect(
      sleepToMomentFields({ sleep_end: 1787827819000 }, config, TZ),
    ).toBeNull();
  });

  it("returns null when sleep_end is missing", () => {
    expect(
      sleepToMomentFields({ sleep_start: 1787802559000 }, config, TZ),
    ).toBeNull();
  });

  it("carries the sleep score in tags", () => {
    const result = sleepToMomentFields(night, config, TZ);
    expect(result!.tags).toContain("score:85");
  });

  it("omits score tag when sleep_score is absent", () => {
    const noScore: SleepNight = {
      sleep_start: 1787802559000,
      sleep_end: 1787827819000,
    };
    const result = sleepToMomentFields(noScore, config, TZ);
    expect(result!.tags?.some((t) => t.startsWith("score:"))).toBeFalsy();
  });

  it("uses host timezone when none specified", () => {
    const result = sleepToMomentFields(night, config);
    expect(result).not.toBeNull();
    expect(result!.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
