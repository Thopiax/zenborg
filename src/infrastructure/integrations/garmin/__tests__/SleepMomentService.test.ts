import { describe, expect, it } from "vitest";
import type { IntegrationBinding } from "../../../../domain/integration/IntegrationBinding.ts";
import {
  isSleepAlreadyPlanted,
  sleepToMomentFields,
} from "../SleepMomentService.ts";
import type { SleepNight } from "../SleepPhaseService.ts";

const binding: IntegrationBinding = {
  source: "garmin.sleep",
  habitId: "habit-sleep-1",
  areaId: "area-rest-1",
};

// 2026-08-27 sleep: start 05:49 Paris, end 12:50 Paris (UTC 03:49 - 10:50)
const night: SleepNight = {
  sleep_start: 1787802559000,
  sleep_end: 1787827819000,
  sleep_score: 85,
  sleep_hours: 6.97,
};

const TZ = "Europe/Paris";

describe("sleepToMomentFields", () => {
  it("converts a sleep night into moment fields", () => {
    const result = sleepToMomentFields(night, binding, TZ);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("sleep");
    expect(result!.areaId).toBe("area-rest-1");
    expect(result!.habitId).toBe("habit-sleep-1");
  });

  it("places the moment on the calendar date of sleep_start", () => {
    const result = sleepToMomentFields(night, binding, TZ);
    expect(result!.day).toBe("2026-08-27");
  });

  it("derives startTime from sleep_start local hour", () => {
    const result = sleepToMomentFields(night, binding, TZ);
    expect(result!.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(result!.startTime).toBe("05:45");
  });

  it("derives durationMin from the sleep window, snapped to grid", () => {
    const result = sleepToMomentFields(night, binding, TZ);
    expect(result!.durationMin).toBe(420);
    expect(result!.durationMin! % 15).toBe(0);
  });

  it("sets phase to NIGHT", () => {
    const result = sleepToMomentFields(night, binding, TZ);
    expect(result!.phase).toBe("NIGHT");
  });

  it("returns null for a night with no data", () => {
    expect(sleepToMomentFields({}, binding, TZ)).toBeNull();
  });

  it("returns null when sleep_start is missing", () => {
    expect(
      sleepToMomentFields({ sleep_end: 1787827819000 }, binding, TZ),
    ).toBeNull();
  });

  it("returns null when sleep_end is missing", () => {
    expect(
      sleepToMomentFields({ sleep_start: 1787802559000 }, binding, TZ),
    ).toBeNull();
  });

  it("carries the sleep score in tags", () => {
    const result = sleepToMomentFields(night, binding, TZ);
    expect(result!.tags).toContain("score:85");
  });

  it("omits score tag when sleep_score is absent", () => {
    const noScore: SleepNight = {
      sleep_start: 1787802559000,
      sleep_end: 1787827819000,
    };
    const result = sleepToMomentFields(noScore, binding, TZ);
    expect(result!.tags?.some((t) => t.startsWith("score:"))).toBeFalsy();
  });

  it("uses host timezone when none specified", () => {
    const result = sleepToMomentFields(night, binding);
    expect(result).not.toBeNull();
    expect(result!.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isSleepAlreadyPlanted", () => {
  const planted = new Set(["2026-08-25", "2026-08-26"]);

  it("returns true when the day is already planted", () => {
    expect(isSleepAlreadyPlanted("2026-08-25", planted)).toBe(true);
  });

  it("returns false when the day is not planted", () => {
    expect(isSleepAlreadyPlanted("2026-08-27", planted)).toBe(false);
  });

  it("returns false on an empty set", () => {
    expect(isSleepAlreadyPlanted("2026-08-25", new Set())).toBe(false);
  });
});
