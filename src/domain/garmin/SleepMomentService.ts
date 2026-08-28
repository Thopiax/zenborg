/**
 * SleepMomentService — convert a Garmin sleep night into moment fields.
 *
 * The missing bridge between Garmin sleep data and the calendar sidecar.
 * GarminHabitMap handles activities (yoga, running, etc.) from
 * `get_activities_by_date`. Sleep comes from a different API
 * (`get_sleep_summary`) with a different shape, so it gets its own path.
 *
 * Pure. No filesystem, no network, no clock.
 */

import { Phase } from "../value-objects/Phase.ts";
import { localHourOf, type SleepNight } from "./SleepPhaseService.ts";

export interface SleepMomentConfig {
  readonly habitId: string;
  readonly areaId: string;
}

export interface SleepMomentFields {
  readonly name: string;
  readonly areaId: string;
  readonly habitId: string;
  readonly day: string;
  readonly startTime: string;
  readonly durationMin: number;
  readonly phase: Phase;
  readonly tags: string[];
}

const GRID_MINUTES = 15;

function snapToGrid(minutes: number): number {
  return Math.max(
    GRID_MINUTES,
    Math.round(minutes / GRID_MINUTES) * GRID_MINUTES,
  );
}

function snapTimeToGrid(totalMinutes: number): number {
  const snapped = Math.round(totalMinutes / GRID_MINUTES) * GRID_MINUTES;
  return Math.min(snapped, 24 * 60 - GRID_MINUTES);
}

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function localDate(epochMs: number, timeZone?: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timeZone !== undefined ? { timeZone } : {}),
  });
  return fmt.format(new Date(epochMs));
}

/**
 * Convert a Garmin sleep night into the fields needed to create a moment.
 *
 * Returns null when the night has insufficient data (watch off, travel).
 * Phase is always NIGHT — sleep is, by definition, the night phase.
 */
export function sleepToMomentFields(
  night: SleepNight,
  config: SleepMomentConfig,
  timeZone?: string,
): SleepMomentFields | null {
  if (
    typeof night.sleep_start !== "number" ||
    typeof night.sleep_end !== "number"
  ) {
    return null;
  }

  const durationMs = night.sleep_end - night.sleep_start;
  const durationRawMin = durationMs / 60_000;

  const startHour = localHourOf(night.sleep_start, timeZone);
  const startTotalMin = Math.round(startHour * 60);
  const snappedStartMin = snapTimeToGrid(startTotalMin);
  const snappedDuration = snapToGrid(durationRawMin);

  const day = localDate(night.sleep_start, timeZone);

  const tags: string[] = [];
  if (typeof night.sleep_score === "number") {
    tags.push(`score:${night.sleep_score}`);
  }

  return {
    name: "sleep",
    areaId: config.areaId,
    habitId: config.habitId,
    day,
    startTime: formatTime(snappedStartMin),
    durationMin: snappedDuration,
    phase: Phase.NIGHT,
    tags,
  };
}
