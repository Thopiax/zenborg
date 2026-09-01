import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "../../../../domain/attention/ActivityEvent";
import type { GarminHabitMap } from "../GarminHabitMap";
import { nightsOf, workoutsOf } from "../BodyLog";

function garminEvent(
  kind: string,
  ts: number,
  payload: Record<string, unknown>,
  durationMs?: number,
): ActivityEvent {
  return {
    id: `g-${ts}`,
    surface: "garmin",
    kind,
    ts,
    sessionId: "",
    payload,
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}

describe("nightsOf", () => {
  it("extracts sleep records sorted by date", () => {
    const events = [
      garminEvent("sleep_recorded", 200, { calendarDate: "2026-09-02", sleepScore: 82, deepS: 3600, remS: 5400, avgHrBpm: 52 }, 28800000),
      garminEvent("sleep_recorded", 100, { calendarDate: "2026-09-01", sleepScore: 75 }, 25200000),
      garminEvent("workout_completed", 300, { activityType: "running" }, 1800000),
    ];
    const nights = nightsOf(events);
    expect(nights).toHaveLength(2);
    expect(nights[0].calendarDate).toBe("2026-09-01");
    expect(nights[0].asleepMs).toBe(25200000);
    expect(nights[0].score).toBe(75);
    expect(nights[1].deepS).toBe(3600);
    expect(nights[1].avgHrBpm).toBe(52);
  });

  it("skips events missing calendarDate", () => {
    const events = [
      garminEvent("sleep_recorded", 100, {}, 25200000),
    ];
    expect(nightsOf(events)).toHaveLength(0);
  });
});

describe("workoutsOf", () => {
  it("extracts workout records with habit mapping", () => {
    const map: GarminHabitMap = {
      version: 1,
      mappings: { running: { habitId: "h1", habitName: "Run" } },
      pending: {},
    };
    const events = [
      garminEvent("workout_completed", 100, { activityType: "running", movingDurationS: 1700, calories: 350, avgHrBpm: 145 }, 1800000),
      garminEvent("workout_completed", 200, { activityType: "yoga", calories: 120 }, 3600000),
    ];
    const workouts = workoutsOf(events, map);
    expect(workouts).toHaveLength(2);
    expect(workouts[0].habitId).toBe("h1");
    expect(workouts[0].habitName).toBe("Run");
    expect(workouts[0].movingS).toBe(1700);
    expect(workouts[1].habitId).toBeUndefined();
    expect(workouts[1].activityType).toBe("yoga");
  });

  it("works without a habit map", () => {
    const events = [
      garminEvent("workout_completed", 100, { activityType: "strength_training" }, 2400000),
    ];
    const workouts = workoutsOf(events);
    expect(workouts).toHaveLength(1);
    expect(workouts[0].habitId).toBeUndefined();
  });
});
