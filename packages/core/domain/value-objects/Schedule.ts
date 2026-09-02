import { isHourInPhase, type Phase, type PhaseConfig } from "./Phase.ts";
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
  /**
   * IANA zone the `startTime` is read in, e.g. "America/Sao_Paulo".
   *
   * Absent means *floating* — the clock time is whatever local time you are
   * in. Present means *anchored* to a fixed instant. See
   * `scheduleLocalStartTime`.
   */
  readonly timezone?: string;
}

export type ScheduleResult = Schedule | { error: string };

export interface CreateScheduleProps {
  weekdays: readonly Weekday[];
  startTime: string;
  durationMin: number;
  timezone?: string;
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

  if (props.timezone !== undefined && !isValidTimezone(props.timezone)) {
    return {
      error: `Schedule timezone must be an IANA identifier like "America/Sao_Paulo", got: ${props.timezone}`,
    };
  }

  const schedule: Schedule = {
    weekdays,
    startTime: props.startTime,
    durationMin: props.durationMin,
    ...(props.timezone ? { timezone: props.timezone } : {}),
  };
  return schedule;
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

// ────────────────────────────────────────────────────────────────────────
// Timezone — floating vs anchored schedules
// ────────────────────────────────────────────────────────────────────────

/**
 * IANA identifier shape: "Europe/Paris", "America/Argentina/Buenos_Aires",
 * or the bare "UTC".
 *
 * Deliberately stricter than `Intl`, which also accepts fixed offsets such as
 * "+05:00". The Swift calendar sidecar resolves this same string through
 * `TimeZone(identifier:)`, which rejects an offset and returns nil — and a nil
 * there falls back to the device's own zone, firing the event at the wrong
 * hour with nothing logged. Refusing the offset here is what keeps the three
 * readers agreeing on one meaning.
 */
const IANA_TIMEZONE_PATTERN =
  /^(UTC|[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+)$/;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is an IANA zone this system and the sidecar both accept. */
export function isValidTimezone(value: string): boolean {
  if (!IANA_TIMEZONE_PATTERN.test(value)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * True when the schedule names the zone its clock time is read in.
 *
 * Anchored — "09:00 America/Sao_Paulo" — is a lesson a teacher in Brazil
 * keeps. The instant is fixed and the wall clock you read it at moves when
 * you do.
 *
 * Floating, the default and the case for most habits, is "09:00" meaning nine
 * in the morning wherever you happen to be. A run, a sit.
 */
export function isScheduleAnchored(schedule: Schedule): boolean {
  return schedule.timezone !== undefined;
}

/**
 * The offset of `timeZone` from UTC at one instant, in milliseconds.
 *
 * Derived by formatting the instant *in* that zone and reading the wall clock
 * back — the only offset-free way to ask, and the reason DST needs no table
 * here.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const read = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return asUtc - instant.getTime();
}

/**
 * The instant at which `startTime` reads on the wall clock of `timeZone`, on
 * `day`.
 *
 * Two passes, because the offset depends on the instant and the instant
 * depends on the offset. The first guess is corrected once, which settles
 * every case except a wall time inside a spring-forward gap — an hour that
 * does not exist, where the correction lands just after the jump. That is the
 * conventional resolution and matches what EventKit does with the same input.
 */
function instantForZonedWallTime(
  day: string,
  startTime: string,
  timeZone: string,
): Date {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = startTime.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, date, hour, minute);
  const firstGuess = naive - zoneOffsetMs(new Date(naive), timeZone);
  return new Date(naive - zoneOffsetMs(new Date(firstGuess), timeZone));
}

/**
 * The wall clock to *render* for a scheduled commitment, as read from
 * `viewerTimezone` on `day`.
 *
 * A floating schedule returns its `startTime` untouched. An anchored one is
 * converted: the singing lesson stored as "09:00 America/Sao_Paulo" renders
 * "14:00" when read from Europe/Paris.
 *
 * `day` is required because the gap between two zones is not a constant — the
 * hemispheres change over on different dates, so São Paulo and Paris sit five
 * hours apart in one part of the year and four in another. This is precisely
 * why an offset is never stored, only ever computed at render.
 *
 * Fails soft, per the vault contract: an unusable zone or day on either side
 * returns the stored `startTime` rather than throwing. A wrong hour is
 * recoverable; a card that will not render is not.
 */
export function scheduleLocalStartTime(
  schedule: Schedule,
  viewerTimezone: string,
  day: string,
): string {
  const anchor = schedule.timezone;
  if (
    anchor === undefined ||
    anchor === viewerTimezone ||
    !DAY_PATTERN.test(day) ||
    !isValidTimezone(anchor) ||
    !isValidTimezone(viewerTimezone)
  ) {
    return schedule.startTime;
  }
  const instant = instantForZonedWallTime(day, schedule.startTime, anchor);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: viewerTimezone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const read = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  const local = `${read("hour").padStart(2, "0")}:${read("minute").padStart(2, "0")}`;
  return isValidStartTime(local) ? local : schedule.startTime;
}
