/**
 * People derivations for the MCP server.
 *
 * Mirrors src/domain/services/PersonService.ts. Kept separate because
 * mcp-server ships standalone and does not import from src/domain — the same
 * arrangement health.ts already has with HabitHealthService.ts. The two must
 * stay in lockstep; they are small and fully covered by tests on both sides.
 *
 * Deliberately independent of computeHealth: that gates on attitude before
 * rhythm, and people must not depend on attitude. A person is never BUILDING
 * or PUSHING; their health is rhythm and silence, nothing else.
 *
 * Health is NEVER stored. Recomputed on every read.
 */
import type { Health } from './health.js';
import { parseVaultDay } from './health.js';
import type { Habit, Moment } from './vault.js';
import { rhythmSilenceThresholdDays } from './vault.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Every moment involving this person.
 *
 * `habitId` is matched as well as `personIds` so that history predating the
 * people migration still counts — those moments were planted against the
 * person's own habit record, whose id the person kept. Most moments in a real
 * vault carry neither field, so the optional chain is load-bearing.
 */
export function personMoments(personId: string, moments: Moment[]): Moment[] {
  const found: Moment[] = [];
  for (const m of moments) {
    if (m.habitId === personId || (m.personIds?.includes(personId) ?? false)) {
      found.push(m);
    }
  }
  return found;
}

/**
 * The most recent day this person was actually seen or spoken to.
 *
 * Future-dated moments are excluded: an arranged dinner is not contact yet.
 * Use `hasArrangedContact` for the "already sorted, stop nagging" signal.
 */
export function latestContactDate(
  personId: string,
  moments: Moment[],
  now: Date,
): Date | null {
  let latest: Date | null = null;
  for (const m of personMoments(personId, moments)) {
    if (m.day === null) {
      continue;
    }
    const d = parseVaultDay(m.day);
    if (d > now) {
      continue;
    }
    if (latest === null || d > latest) {
      latest = d;
    }
  }
  return latest;
}

/**
 * True when something with this person is already on the calendar ahead.
 *
 * The outreach queue uses this to stay quiet about someone you have already
 * reached out to. Known hole: a moment that keeps being postponed holds a
 * person out of the queue indefinitely. Accepted — it is visible in the
 * moment itself.
 */
export function hasArrangedContact(
  personId: string,
  moments: Moment[],
  now: Date,
): boolean {
  for (const m of personMoments(personId, moments)) {
    if (m.day === null) {
      continue;
    }
    if (parseVaultDay(m.day) > now) {
      return true;
    }
  }
  return false;
}

/**
 * Whole days since the last real contact. Null means never.
 *
 * Floors, whereas `personHealth` compares the fractional elapsed days against
 * the threshold — so a `count > 1` rhythm (e.g. {monthly, 4} → 7.5 days) can
 * show a stable "7" here while health flips from blooming to wilting at midday.
 */
export function daysSinceLastContact(
  personId: string,
  moments: Moment[],
  now: Date,
): number | null {
  const last = latestContactDate(personId, moments, now);
  if (last === null) {
    return null;
  }
  return Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
}

/**
 * Person health: rhythm and silence only. Attitude is never consulted.
 *
 *   no rhythm      -> "unstated"  (a roster entry, not a commitment)
 *   never seen     -> "wilting"
 *   within period  -> "blooming"
 *   past period    -> "wilting"
 */
export function personHealth(
  person: Habit,
  moments: Moment[],
  now: Date,
): Health {
  if (!person.rhythm) {
    return 'unstated';
  }
  const last = latestContactDate(person.id, moments, now);
  if (last === null) {
    return 'wilting';
  }
  const daysSince = (now.getTime() - last.getTime()) / MS_PER_DAY;
  return daysSince <= rhythmSilenceThresholdDays(person.rhythm)
    ? 'blooming'
    : 'wilting';
}

/**
 * Sort key for the outreach queue. Never-contacted ranks above every elapsed
 * count, and stays finite so two of them compare to 0 rather than NaN.
 */
export function overdueRank(daysSince: number | null): number {
  return daysSince === null ? Number.MAX_SAFE_INTEGER : daysSince;
}
