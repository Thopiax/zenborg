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
 * Get extended timeline days (multiple days before and after today)
 * @param daysBefore - Number of days before today to include (default: 2)
 * @param daysAfter - Number of days after today to include (default: 3)
 */
export function getExtendedTimelineDays(
  daysBefore = 2,
  daysAfter = 3
): Array<{ date: string; isToday: boolean }> {
  const today = new Date();
  const days: Array<{ date: string; isToday: boolean }> = [];

  // Add days before today
  for (let i = daysBefore; i > 0; i--) {
    days.push({
      date: toISODate(subDays(today, i)),
      isToday: false,
    });
  }

  // Add today
  days.push({
    date: toISODate(today),
    isToday: true,
  });

  // Add days after today
  for (let i = 1; i <= daysAfter; i++) {
    days.push({
      date: toISODate(addDays(today, i)),
      isToday: false,
    });
  }

  return days;
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
