/**
 * Rhythm — declared cadence for a habit
 *
 * Rhythm expresses how often the habit should recur, as a count over a
 * period. Interpretation depends on the habit's attitude:
 *   - KEEPING: silence threshold (period / count days before the habit wilts)
 *   - BUILDING / PUSHING: target pace within the period
 *   - BEGINNING: loose guide, no wilt
 *   - BEING: no rhythm
 *
 * Period day counts are approximate (30-day months, 90-day quarters). Good
 * enough for mindful cadence; avoids calendar edge cases.
 */

export type RhythmPeriod =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "annually";

export interface Rhythm {
  period: RhythmPeriod;
  count: number;
}

export const PERIOD_DAYS: Record<RhythmPeriod, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  annually: 365,
};

export function rhythmPerWeek(r: Rhythm): number {
  return (r.count * 7) / PERIOD_DAYS[r.period];
}

export function rhythmToCycleBudget(r: Rhythm, cycleDays: number): number {
  return Math.round((r.count * cycleDays) / PERIOD_DAYS[r.period]);
}

export function rhythmSilenceThresholdDays(r: Rhythm): number {
  return PERIOD_DAYS[r.period] / r.count;
}
