/**
 * Derived views over garmin JSONL events — sleep nights and workouts.
 * Pure: no I/O, no persistence. Computed on request, thrown away after.
 */
import type { ActivityEvent } from "../../../domain/attention/ActivityEvent.ts";
import type {
  GarminHabitMap,
  HabitMapping,
} from "./GarminHabitMap.ts";

export interface NightRecord {
  readonly calendarDate: string;
  readonly asleepMs: number;
  readonly score?: number;
  readonly deepS?: number;
  readonly remS?: number;
  readonly avgHrBpm?: number;
}

export interface WorkoutRecord {
  readonly start: number;
  readonly elapsedMs: number;
  readonly movingS?: number;
  readonly activityType: string;
  readonly calories?: number;
  readonly avgHrBpm?: number;
  readonly habitId?: string;
  readonly habitName?: string;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function nightsOf(
  events: readonly ActivityEvent[],
): readonly NightRecord[] {
  const nights: NightRecord[] = [];
  for (const e of events) {
    if (e.surface !== "garmin" || e.kind !== "sleep_recorded") continue;
    const p = e.payload;
    const calendarDate = str(p.calendarDate);
    if (!calendarDate) continue;
    nights.push({
      calendarDate,
      asleepMs: e.durationMs ?? 0,
      ...(num(p.sleepScore) !== undefined ? { score: num(p.sleepScore) } : {}),
      ...(num(p.deepS) !== undefined ? { deepS: num(p.deepS) } : {}),
      ...(num(p.remS) !== undefined ? { remS: num(p.remS) } : {}),
      ...(num(p.avgHrBpm) !== undefined ? { avgHrBpm: num(p.avgHrBpm) } : {}),
    });
  }
  return nights.sort((a, b) => a.calendarDate.localeCompare(b.calendarDate));
}

export function workoutsOf(
  events: readonly ActivityEvent[],
  map?: GarminHabitMap,
): readonly WorkoutRecord[] {
  const workouts: WorkoutRecord[] = [];
  for (const e of events) {
    if (e.surface !== "garmin" || e.kind !== "workout_completed") continue;
    const p = e.payload;
    const activityType = str(p.activityType);
    if (!activityType) continue;

    let habit: HabitMapping | undefined;
    if (map) {
      const mapping = map.mappings[activityType];
      if (mapping) habit = mapping;
    }

    workouts.push({
      start: e.ts,
      elapsedMs: e.durationMs ?? 0,
      activityType,
      ...(num(p.movingDurationS) !== undefined ? { movingS: num(p.movingDurationS) } : {}),
      ...(num(p.calories) !== undefined ? { calories: num(p.calories) } : {}),
      ...(num(p.avgHrBpm) !== undefined ? { avgHrBpm: num(p.avgHrBpm) } : {}),
      ...(habit ? { habitId: habit.habitId, habitName: habit.habitName } : {}),
    });
  }
  return workouts.sort((a, b) => a.start - b.start);
}
