import {
  addDays,
  format,
  isToday,
  isTomorrow,
  isYesterday,
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
 * Get display label for a date (e.g., "Yesterday", "Today", "Tomorrow", or formatted date)
 */
export function getDateLabel(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isYesterday(dateObj)) return "Yesterday";
  if (isToday(dateObj)) return "Today";
  if (isTomorrow(dateObj)) return "Tomorrow";

  return format(dateObj, "EEE, MMM d");
}

/**
 * Parse ISO date string to Date object
 */
export function fromISODate(isoDate: string): Date {
  return new Date(isoDate);
}

/**
 * Get the current hour (0-23) for phase detection
 */
export function getCurrentHour(): number {
  return new Date().getHours();
}
