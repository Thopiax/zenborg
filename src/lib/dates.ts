import {
  addDays,
  format,
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
