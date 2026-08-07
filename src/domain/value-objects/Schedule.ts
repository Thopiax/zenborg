import { isHourInPhase, type Phase, type PhaseConfig } from "./Phase";
import type { Rhythm } from "./Rhythm";

/**
 * Schedule — a habit's declared clock-time commitment.
 *
 * `rhythm` says *how often* ("once a week"); `schedule` says *when*
 * ("Mondays at 14:00, for 60 minutes"). Most habits are ambient and carry
 * neither. A habit only grows a schedule when the commitment is genuinely
 * pinned to the clock — therapy, singing, footy — the kind of thing that
 * previously lived as prose in `description` and was therefore unqueryable.
 *
 * Immutable value object: no identity, replaced rather than mutated.
 */

export enum Weekday {
  MON = "MON",
  TUE = "TUE",
  WED = "WED",
  THU = "THU",
  FRI = "FRI",
  SAT = "SAT",
  SUN = "SUN",
}

/** ISO-8601 week order — Monday first. */
export const WEEKDAY_ORDER: readonly Weekday[] = [
  Weekday.MON,
  Weekday.TUE,
  Weekday.WED,
  Weekday.THU,
  Weekday.FRI,
  Weekday.SAT,
  Weekday.SUN,
];

export interface Schedule {
  readonly weekdays: readonly Weekday[];
  readonly startTime: string; // "HH:MM", 24h, zero-padded
  readonly durationMin: number; // positive whole minutes
}

export type ScheduleResult = Schedule | { error: string };

export interface CreateScheduleProps {
  weekdays: readonly Weekday[];
  startTime: string;
  durationMin: number;
}

const START_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True when `value` is a zero-padded 24h "HH:MM" clock time. */
export function isValidStartTime(value: string): boolean {
  return START_TIME_PATTERN.test(value);
}

/** Hour component of a validated "HH:MM" start time. */
export function startTimeHour(startTime: string): number {
  return Number.parseInt(startTime.slice(0, 2), 10);
}

/** De-duplicates and sorts weekdays into MON..SUN order. */
export function normalizeWeekdays(
  weekdays: readonly Weekday[],
): readonly Weekday[] {
  const present = new Set(weekdays);
  return WEEKDAY_ORDER.filter((day) => present.has(day));
}

export function createSchedule(props: CreateScheduleProps): ScheduleResult {
  const weekdays = normalizeWeekdays(props.weekdays);

  if (weekdays.length === 0) {
    return { error: "Schedule must have at least one weekday" };
  }

  if (!isValidStartTime(props.startTime)) {
    return {
      error: `Schedule startTime must be HH:MM (24h), got: ${props.startTime}`,
    };
  }

  if (!Number.isInteger(props.durationMin) || props.durationMin <= 0) {
    return {
      error: "Schedule durationMin must be a positive whole number of minutes",
    };
  }

  return {
    weekdays,
    startTime: props.startTime,
    durationMin: props.durationMin,
  };
}

export function isScheduleError(
  result: ScheduleResult,
): result is { error: string } {
  return "error" in result;
}

/**
 * The per-instance timing a moment inherits when it is spawned from a
 * scheduled habit. The moment may then override either half — the habit says
 * 12:00, this Sunday's footy actually starts at 12:15.
 */
export function timingFromSchedule(schedule: Schedule): {
  startTime: string;
  durationMin: number;
} {
  return { startTime: schedule.startTime, durationMin: schedule.durationMin };
}

/**
 * The weekly rhythm a schedule implies: one occurrence per scheduled weekday.
 * Used to fill `rhythm` when a habit declares a schedule but no cadence.
 */
export function deriveRhythmFromSchedule(schedule: Schedule): Rhythm {
  return { period: "weekly", count: schedule.weekdays.length };
}

/**
 * Consistency check between a schedule and a declared rhythm.
 *
 * Only *weekly* rhythms are constrained: there, `count` and `weekdays.length`
 * are two spellings of the same fact and must agree. Longer periods leave the
 * weekdays as candidate days ("every other Monday" = biweekly ×1 on [MON]),
 * so no constraint applies.
 */
export function scheduleRhythmError(
  schedule: Schedule,
  rhythm: Rhythm | undefined,
): string | null {
  if (!rhythm || rhythm.period !== "weekly") {
    return null;
  }
  if (rhythm.count !== schedule.weekdays.length) {
    return `Weekly rhythm count (${rhythm.count}) must equal the number of scheduled weekdays (${schedule.weekdays.length})`;
  }
  return null;
}

/**
 * The phase band a clock time falls into.
 *
 * Visibility is ignored on purpose — a 03:00 start belongs to NIGHT whether or
 * not NIGHT is shown on the timeline. Returns null when no band covers the
 * hour (configs can be partial or mis-configured).
 */
export function phaseForStartTime(
  startTime: string,
  phaseConfigs: readonly PhaseConfig[],
): Phase | null {
  const hour = startTimeHour(startTime);
  const ordered = [...phaseConfigs].sort((a, b) => a.order - b.order);
  for (const config of ordered) {
    if (isHourInPhase(hour, config)) {
      return config.phase;
    }
  }
  return null;
}

/**
 * Consistency check between a schedule's start time and a declared phase.
 * A habit that starts at 14:00 cannot claim to be a MORNING habit.
 */
export function schedulePhaseError(
  schedule: Schedule,
  phase: Phase | null | undefined,
  phaseConfigs: readonly PhaseConfig[],
): string | null {
  if (!phase) {
    return null;
  }
  const derived = phaseForStartTime(schedule.startTime, phaseConfigs);
  if (derived === null || derived === phase) {
    return null;
  }
  return `Phase ${phase} contradicts startTime ${schedule.startTime}, which falls in ${derived}`;
}
