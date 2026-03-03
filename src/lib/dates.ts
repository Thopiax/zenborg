import {
  addDays,
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
  subDays,
} from "date-fns";

/**
 * Date utility functions for timeline navigation
 */

/**
 * Get ISO date string (YYYY-MM-DD) for a given date
 */
export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Get today's ISO date string
 */
export function getTodayISO(): string {
  return toISODate(new Date());
}

/**
 * Get yesterday's ISO date string
 */
export function getYesterdayISO(): string {
  return toISODate(subDays(new Date(), 1));
}

/**
 * Get tomorrow's ISO date string
 */
export function getTomorrowISO(): string {
  return toISODate(addDays(new Date(), 1));
}

/**
 * Get the 3 days for timeline display (yesterday, today, tomorrow)
 */
export function getTimelineDays(): {
  yesterday: string;
  today: string;
  tomorrow: string;
} {
  return {
    yesterday: getYesterdayISO(),
    today: getTodayISO(),
    tomorrow: getTomorrowISO(),
  };
}

/**
 * Get extended timeline days (multiple days before and after today)
 * @param daysBefore - Number of days before today to include (default: 2)
 * @param daysAfter - Number of days after today to include (default: 3)
 * @param centerDate - Optional date to center around (defaults to today)
 */
export function getExtendedTimelineDays(
  daysBefore = 2,
  daysAfter = 3,
  centerDate?: string
): Array<{ date: string; isToday: boolean; isActiveDay: boolean }> {
  const today = new Date();
  const todayISO = toISODate(today);
  const center = centerDate ? new Date(centerDate) : today;
  const activeDay = getActiveDay();
  const days: Array<{ date: string; isToday: boolean; isActiveDay: boolean }> =
    [];

  // Add days before center
  for (let i = daysBefore; i > 0; i--) {
    const date = toISODate(subDays(center, i));
    days.push({
      date,
      isToday: date === todayISO,
      isActiveDay: date === activeDay,
    });
  }

  // Add center day
  const centerISO = toISODate(center);
  days.push({
    date: centerISO,
    isToday: centerISO === todayISO,
    isActiveDay: centerISO === activeDay,
  });

  // Add days after center
  for (let i = 1; i <= daysAfter; i++) {
    const date = toISODate(addDays(center, i));
    days.push({
      date,
      isToday: date === todayISO,
      isActiveDay: date === activeDay,
    });
  }

  return days;
}

/**
 * Get display label for a date (e.g., "Yesterday", "Today", "Tomorrow", or formatted date)
 */
export function getDateLabel(date: Date | string): string {
  const dateObj = typeof date === "string" ? fromISODate(date) : date;

  if (isYesterday(dateObj)) return "Yesterday";
  if (isToday(dateObj)) return "Today";
  if (isTomorrow(dateObj)) return "Tomorrow";

  return format(dateObj, "EEE, MMM d");
}

/**
 * Parse ISO date string to Date object in local timezone
 * @param isoDate - ISO date string (YYYY-MM-DD)
 * @returns Date object at midnight in local timezone
 */
export function fromISODate(isoDate: string): Date {
  return parseISO(isoDate);
}

/**
 * Get the current hour (0-23) for phase detection
 */
export function getCurrentHour(): number {
  return new Date().getHours();
}

/**
 * Get the active day ISO string, accounting for phase schedule
 *
 * The "active day" shifts only when morning starts (default: 6 AM).
 * If it's 2 AM (NIGHT phase), the active day is still yesterday.
 *
 * @param morningStartHour - Hour when morning starts (default: 6)
 * @returns ISO date string for the active day
 */
export function getActiveDay(morningStartHour = 6): string {
  const now = new Date();
  const currentHour = now.getHours();

  // If current hour is before morning starts, the active day is yesterday
  if (currentHour < morningStartHour) {
    return toISODate(subDays(now, 1));
  }

  return toISODate(now);
}

/**
 * Formats a cycle's date range as a compact string
 *
 * Examples:
 * - Same month: "Jan 5 - 12"
 * - Same year: "Jan 5 - Feb 10"
 * - Different years: "Dec 28 2024 - Jan 10 2025"
 * - Ongoing: "Jan 5 - ongoing"
 *
 * @param startDate - ISO date string (YYYY-MM-DD)
 * @param endDate - ISO date string or null for ongoing cycles
 * @returns Formatted date range string
 */
export function formatCycleDateRange(
  startDate: string,
  endDate: string | null
): string {
  const start = fromISODate(startDate);
  const end = endDate ? fromISODate(endDate) : null;

  if (!end) {
    return `${format(start, "MMM dd")} - ongoing`;
  }

  const isSameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();

  const isSameYear = start.getFullYear() === end.getFullYear();

  if (isSameMonth) {
    const startDay = format(start, "d");
    const endDay = format(end, "d");
    const month = format(start, "MMM");
    return `${month} ${startDay} - ${endDay}`;
  }

  if (isSameYear) {
    const startStr = format(start, "MMM dd");
    const endStr = format(end, "MMM dd");
    return `${startStr} - ${endStr}`;
  }

  const startStr = format(start, "MMM dd yyyy");
  const endStr = format(end, "MMM dd yyyy");
  return `${startStr} - ${endStr}`;
}

/**
 * Formats a cycle's end date as a countdown or date string
 *
 * Examples:
 * - "ends in 5 days"
 * - "ends today"
 * - "ends tomorrow"
 * - "ends on Jan 15"
 * - "ongoing"
 *
 * @param endDate - ISO date string or null for ongoing cycles
 * @returns Formatted end date string
 */
export function formatCycleEndDate(endDate: string | null): string {
  if (!endDate) {
    return "ongoing";
  }

  const end = fromISODate(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `ended ${Math.abs(diffDays)} days ago`;
  }

  if (diffDays === 0) {
    return "ends today";
  }

  if (diffDays === 1) {
    return "ends tomorrow";
  }

  if (diffDays <= 7) {
    return `ends in ${diffDays} days`;
  }

  return `ends on ${format(end, "MMM dd")}`;
}

/**
 * Formats a cycle subtitle based on its temporal relationship to today.
 * Uses date-fns for humanized distance strings.
 *
 * Active cycle: "5 days left", "ends today", "ongoing"
 * Future cycle: "starts in 3 days", "starts in 2 weeks"
 * Past cycle: "ended 3 days ago"
 *
 * @param startDate - ISO date string
 * @param endDate - ISO date string or null
 * @param isActive - Whether this is the currently active cycle
 * @returns Formatted subtitle string
 */
export function formatCycleSubtitle(
  startDate: string,
  endDate: string | null,
  isActive: boolean,
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = fromISODate(startDate);
  const startDiff = differenceInCalendarDays(start, today);

  // Future cycle
  if (startDiff > 0) {
    if (startDiff === 1) {
      return "starts tomorrow";
    }
    return `starts in ${formatDistanceToNowStrict(start)}`;
  }

  // Current/past cycle — check end date
  if (!endDate) {
    return isActive ? "ongoing" : "no end date";
  }

  const end = fromISODate(endDate);
  const endDiff = differenceInCalendarDays(end, today);

  if (endDiff < 0) {
    return `ended ${formatDistanceToNowStrict(end)} ago`;
  }
  if (endDiff === 0) {
    return "ends today";
  }
  if (endDiff === 1) {
    return "ends tomorrow";
  }
  return `${formatDistanceToNowStrict(end)} left`;
}
