import { addDays, format, parseISO, subDays } from "date-fns";

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function fromISODate(isoDate: string): Date {
  return parseISO(isoDate);
}

export function getTodayISO(): string {
  return toISODate(new Date());
}

export function getTomorrowISO(): string {
  return toISODate(addDays(new Date(), 1));
}

export function getActiveDay(morningStartHour = 6): string {
  const now = new Date();
  return now.getHours() < morningStartHour
    ? toISODate(subDays(now, 1))
    : toISODate(now);
}
