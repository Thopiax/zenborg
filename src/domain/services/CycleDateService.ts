import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfQuarter,
  format,
  getISOWeek,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from "date-fns";
import { toISODate, getTodayISO, getTomorrowISO, fromISODate } from "@/lib/dates";
import type { Cycle } from "@/domain/entities/Cycle";

/**
 * Domain Service: Cycle Date Calculations
 *
 * Pure business logic for cycle date operations using date-fns.
 * All operations are timezone-agnostic (work with ISO date strings).
 *
 * Business Rules:
 * 1. Cycles can start on the same day the previous cycle ended
 * 2. Template durations align to calendar boundaries (Monday, 1st of month, etc.)
 * 3. If no cycles exist, default start date is tomorrow
 */

export type TemplateDuration = "week" | "2-week" | "month" | "quarter";

/**
 * Generates a human-readable cycle name from a template duration and start date.
 * Uses ISO week numbers for week-based templates.
 *
 * @param template - Template duration
 * @param startDate - Start date for the cycle
 * @returns Generated cycle name (e.g., "Week 10", "March 2026", "Q1 2026")
 */
export function generateCycleName(template: TemplateDuration, startDate: Date): string {
  switch (template) {
    case "week":
      return `Week ${getISOWeek(startDate)}`;
    case "2-week":
      return `Weeks ${getISOWeek(startDate)}\u2013${getISOWeek(addDays(startDate, 13))}`;
    case "month":
      return format(startDate, "MMMM yyyy");
    case "quarter":
      return `Q${Math.ceil((startDate.getMonth() + 1) / 3)} ${startDate.getFullYear()}`;
  }
}

/**
 * Calculates the default start date for a new cycle
 *
 * Business Rules:
 * - If no cycles exist: tomorrow
 * - If cycles exist: same day as latest cycle's end date (or today if latest is ongoing)
 *
 * @param cycles - All existing cycles
 * @returns ISO date string for default start date
 */
export function calculateDefaultStartDate(cycles: Cycle[]): string {
  if (cycles.length === 0) {
    return getTomorrowISO();
  }

  // Find the cycle with the latest end date
  const cyclesWithEndDates = cycles.filter((c) => c.endDate !== null);

  if (cyclesWithEndDates.length === 0) {
    // All cycles are ongoing, default to tomorrow
    return getTomorrowISO();
  }

  // Sort by end date descending
  const latestCycle = cyclesWithEndDates.sort((a, b) => {
    const dateA = fromISODate(a.endDate!);
    const dateB = fromISODate(b.endDate!);
    return dateB.getTime() - dateA.getTime();
  })[0];

  // New cycle can start on the same day the previous one ended
  return latestCycle.endDate!;
}

/**
 * Calculates start and end dates for a template duration
 *
 * If baseDate is provided, aligns to calendar boundaries from that date.
 * Otherwise, uses the default start date logic.
 *
 * @param template - Template duration
 * @param cycles - All existing cycles (for default date calculation)
 * @param baseDate - Optional base date (if not provided, uses calculateDefaultStartDate)
 * @returns Object with startDate and endDate as ISO strings
 */
export function calculateTemplateDates(
  template: TemplateDuration,
  cycles: Cycle[],
  baseDate?: string
): {
  startDate: string;
  endDate: string;
} {
  // Determine base date
  const baseDateISO = baseDate || calculateDefaultStartDate(cycles);
  const base = fromISODate(baseDateISO);

  // Align to calendar boundaries
  const startDate = alignToCalendarBoundary(base, template);
  const endDate = calculateEndDateFromStart(startDate, template);

  return {
    startDate: toISODate(startDate),
    endDate: toISODate(endDate),
  };
}

/**
 * Aligns a date to calendar boundaries based on template
 *
 * @param date - Base date
 * @param template - Template duration
 * @returns Aligned date
 */
function alignToCalendarBoundary(
  date: Date,
  template: TemplateDuration
): Date {
  switch (template) {
    case "week":
    case "2-week":
      // Align to Monday (start of ISO week)
      return startOfWeek(date, { weekStartsOn: 1 });

    case "month":
      // Align to 1st of month
      return startOfMonth(date);

    case "quarter":
      // Align to 1st of quarter month (Jan, Apr, Jul, Oct)
      return startOfQuarter(date);

    default:
      return date;
  }
}

/**
 * Calculates end date based on start date and template
 *
 * @param startDate - Start date
 * @param template - Template duration
 * @returns End date (inclusive)
 */
function calculateEndDateFromStart(
  startDate: Date,
  template: TemplateDuration
): Date {
  switch (template) {
    case "week":
      // 7 days (Monday to Sunday)
      return addDays(startDate, 6);

    case "2-week":
      // 14 days
      return addDays(startDate, 13);

    case "month":
      // Last day of month
      return endOfMonth(startDate);

    case "quarter":
      // Last day of quarter (3 months)
      return endOfQuarter(startDate);

    default:
      return startDate;
  }
}

/**
 * Checks if two date ranges overlap
 *
 * Business Rule: Cycles cannot overlap on interior days.
 * Touching endpoints (one ends the same day another starts) do NOT overlap —
 * cycles can start on the day the previous cycle ended.
 *
 * @param range1Start - Start date of first range
 * @param range1End - End date of first range (null = ongoing)
 * @param range2Start - Start date of second range
 * @param range2End - End date of second range (null = ongoing)
 * @returns True if ranges overlap
 */
export function doDateRangesOverlap(
  range1Start: string,
  range1End: string | null,
  range2Start: string,
  range2End: string | null
): boolean {
  const start1 = fromISODate(range1Start);
  const start2 = fromISODate(range2Start);

  // If either range is ongoing (null end date), check start dates
  if (range1End === null || range2End === null) {
    // Ongoing cycles: only overlap if they have the same start date
    return start1.getTime() === start2.getTime();
  }

  const end1 = fromISODate(range1End);
  const end2 = fromISODate(range2End);

  // Both have end dates: overlap only on interior days (strict inequality).
  // start1 === end2 or end1 === start2 means a single touching day, not overlap.
  return start1 < end2 && end1 > start2;
}

/**
 * Finds a cycle that overlaps with the given date range
 *
 * @param cycles - All cycles to check
 * @param startDate - Start date to check
 * @param endDate - End date to check (null = ongoing)
 * @returns Overlapping cycle or null
 */
export function findOverlappingCycle(
  cycles: Cycle[],
  startDate: string,
  endDate: string | null
): Cycle | null {
  for (const cycle of cycles) {
    if (
      doDateRangesOverlap(cycle.startDate, cycle.endDate, startDate, endDate)
    ) {
      return cycle;
    }
  }

  return null;
}

/**
 * Calculates the day before a given date (for auto-closing cycles)
 *
 * @param date - ISO date string
 * @returns ISO date string for the day before
 */
export function getDayBefore(date: string): string {
  const dateObj = fromISODate(date);
  return toISODate(addDays(dateObj, -1));
}

/**
 * Calculates a smart default end date when closing a cycle.
 *
 * Returns the earlier of:
 * - today
 * - the day before the next cycle's start date (if one exists)
 *
 * This ensures the default never creates an overlap with a subsequent cycle.
 *
 * @param cycle - The cycle being ended
 * @param allCycles - All cycles (including the one being ended)
 * @returns ISO date string for the default end date
 */
export function calculateDefaultEndDate(
  cycle: Cycle,
  allCycles: Cycle[]
): string {
  const cycleStart = fromISODate(cycle.startDate);

  const nextCycle = allCycles
    .filter((c) => c.id !== cycle.id && fromISODate(c.startDate) > cycleStart)
    .sort(
      (a, b) =>
        fromISODate(a.startDate).getTime() - fromISODate(b.startDate).getTime()
    )[0];

  const todayISO = getTodayISO();

  if (!nextCycle) {
    return todayISO;
  }

  const cap = getDayBefore(nextCycle.startDate);
  return fromISODate(cap) < fromISODate(todayISO) ? cap : todayISO;
}
