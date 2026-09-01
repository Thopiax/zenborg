import * as fs from "node:fs";
import * as path from "node:path";
import type { OracleAdapter, OracleResponse } from "../../src/domain/attention/Oracle.ts";
import { nightsOf, workoutsOf } from "../../src/infrastructure/integrations/garmin/BodyLog.ts";
import { parseHabitMap } from "../../src/infrastructure/integrations/garmin/GarminHabitMap.ts";
import { logDir, readActivityLog } from "../activity-log.ts";
import type { Habit } from "../vault.ts";

export interface GarminData {
  nights: Array<{
    calendarDate: string;
    asleepHours: number;
    score?: number;
    deepMin?: number;
    remMin?: number;
    avgHrBpm?: number;
  }>;
  workouts: Array<{
    day: string;
    start: string;
    activityType: string;
    elapsedMin: number;
    movingMin?: number;
    calories?: number;
    avgHrBpm?: number;
    habitId?: string;
    habitName?: string;
  }>;
}

function loadHabitMap(vaultRoot: string) {
  const mapPath = path.join(vaultRoot, "integrations", "garmin", "habit-map.json");
  if (!fs.existsSync(mapPath)) return parseHabitMap(null);
  try {
    return parseHabitMap(JSON.parse(fs.readFileSync(mapPath, "utf8")));
  } catch {
    return parseHabitMap(null);
  }
}

function localDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function timeStr(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function garminOracle(
  habits: Record<string, Habit>,
): OracleAdapter<GarminData> {
  const habitName = (id: string) => habits[id]?.name ?? id;
  return (vaultRoot, from, to): OracleResponse<GarminData> => {
    const events = readActivityLog(logDir(vaultRoot), from, to, ["garmin"]);
    const habitMap = loadHabitMap(vaultRoot);

    const nights = nightsOf(events).map((n) => ({
      calendarDate: n.calendarDate,
      asleepHours: +(n.asleepMs / 3_600_000).toFixed(1),
      ...(n.score !== undefined ? { score: n.score } : {}),
      ...(n.deepS !== undefined ? { deepMin: Math.round(n.deepS / 60) } : {}),
      ...(n.remS !== undefined ? { remMin: Math.round(n.remS / 60) } : {}),
      ...(n.avgHrBpm !== undefined ? { avgHrBpm: n.avgHrBpm } : {}),
    }));

    const workouts = workoutsOf(events, habitMap).map((w) => ({
      day: localDate(w.start),
      start: timeStr(w.start),
      activityType: w.activityType,
      elapsedMin: Math.round(w.elapsedMs / 60_000),
      ...(w.movingS !== undefined ? { movingMin: Math.round(w.movingS / 60) } : {}),
      ...(w.calories !== undefined ? { calories: w.calories } : {}),
      ...(w.avgHrBpm !== undefined ? { avgHrBpm: w.avgHrBpm } : {}),
      ...(w.habitId ? { habitId: w.habitId, habitName: habitName(w.habitId) } : {}),
    }));

    const garminEvents = events.filter((e) => e.surface === "garmin");
    const first = garminEvents.length > 0 ? garminEvents[0].ts : undefined;
    const last = garminEvents.length > 0 ? garminEvents[garminEvents.length - 1].ts : undefined;

    return {
      window: { from: localDate(from), to: localDate(to) },
      coverage: {
        ...(first !== undefined ? { first: localDate(first) } : {}),
        ...(last !== undefined ? { last: localDate(last) } : {}),
        records: garminEvents.length,
      },
      data: { nights, workouts },
    };
  };
}
