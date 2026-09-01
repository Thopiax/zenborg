import { describe, expect, it } from "vitest";
import type { IntegrationBinding } from "../../domain/integration/IntegrationBinding.ts";
import type { SleepNight } from "../../infrastructure/integrations/garmin/SleepPhaseService.ts";
import { plantSleep } from "../use-cases/plantSleep.ts";

const binding: IntegrationBinding = {
  source: "garmin.sleep",
  areaId: "area-rest",
  habitId: "habit-sleep",
};

const TZ = "Europe/Paris";

const night1: SleepNight = {
  sleep_start: 1787802559000,
  sleep_end: 1787827819000,
  sleep_score: 85,
};

const night2: SleepNight = {
  sleep_start: 1787716159000,
  sleep_end: 1787741359000,
  sleep_score: 72,
};

describe("plantSleep", () => {
  it("converts nights into moment seeds", () => {
    const result = plantSleep({
      nights: [night1],
      binding,
      plantedDays: new Set(),
      timeZone: TZ,
    });
    expect(result.seeds).toHaveLength(1);
    expect(result.skipped).toBe(0);
    expect(result.seeds[0].name).toBe("sleep");
    expect(result.seeds[0].areaId).toBe("area-rest");
    expect(result.seeds[0].habitId).toBe("habit-sleep");
  });

  it("skips nights already planted", () => {
    const day = "2026-08-27";
    const result = plantSleep({
      nights: [night1],
      binding,
      plantedDays: new Set([day]),
      timeZone: TZ,
    });
    expect(result.seeds).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it("skips nights with no data", () => {
    const result = plantSleep({
      nights: [{}],
      binding,
      plantedDays: new Set(),
      timeZone: TZ,
    });
    expect(result.seeds).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it("handles a batch with mixed outcomes", () => {
    const result = plantSleep({
      nights: [night1, night2, {}],
      binding,
      plantedDays: new Set(),
      timeZone: TZ,
    });
    expect(result.seeds).toHaveLength(2);
    expect(result.skipped).toBe(1);
  });

  it("deduplicates within the same batch", () => {
    const result = plantSleep({
      nights: [night1, night1],
      binding,
      plantedDays: new Set(),
      timeZone: TZ,
    });
    expect(result.seeds).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("seeds carry all fields needed to create a moment", () => {
    const result = plantSleep({
      nights: [night1],
      binding,
      plantedDays: new Set(),
      timeZone: TZ,
    });
    const seed = result.seeds[0];
    expect(seed.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(seed.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(seed.durationMin).toBeGreaterThan(0);
    expect(seed.durationMin % 15).toBe(0);
    expect(seed.phase).toBe("NIGHT");
    expect(seed.tags).toContain("score:85");
  });
});
