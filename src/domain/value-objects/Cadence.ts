// src/domain/value-objects/Cadence.ts
/**
 * Cadence — a declared contact rhythm for a person, in four buckets.
 *
 * Deliberately NOT a `Rhythm { period, count }`: the registry data shows the
 * extra dimension was never wanted (spec D10). Four values, ordered, and the
 * overdue ratio is days-since divided by the bucket's day count.
 *
 * The cadence itself lives in wake's registry, on the person entity. Zenborg
 * only receives it as a parameter and ranks against it — nothing here is
 * stored (spec D1, D9).
 *
 * Mirrored in `mcp-server/cadence.ts`, which cannot import this module. The
 * two must stay in lockstep, in particular the rounding: it is the ROUNDED
 * value that sorts the outreach queue, so the order an agent reads aloud is
 * the order it was handed.
 */

export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";

const CADENCE_DAYS: Record<Cadence, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

/** The bucket's day count — the silence threshold for that cadence. */
export function cadenceDays(cadence: Cadence): number {
  return CADENCE_DAYS[cadence];
}

/**
 * How far past their cadence a person has gone, as a multiple of it.
 *
 * 1.0 is exactly at the threshold; 2.86 is "nearly three buckets of silence".
 * Raw elapsed days cannot express this — a yearly friend at 400 days (1.10x)
 * is far less overdue than a weekly friend at 20 days (2.86x), yet raw days
 * would rank the yearly one higher forever and bury the short-cadence people
 * the queue exists to protect.
 *
 * Rounded to 2 decimals, matching `mcp-server/cadence.ts` exactly so the two
 * implementations agree on every rank.
 */
export function overdueRatio(daysSince: number, cadence: Cadence): number {
  return Math.round((daysSince / cadenceDays(cadence)) * 100) / 100;
}
