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
import type { Habit, Moment, Rhythm } from './vault.js';
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
 * How far past their rhythm this person has gone, as a multiple of it.
 *
 * 1.0 is exactly at the threshold; 5.71 is "five and a half times past due".
 * Raw elapsed days cannot express this — an `{annually,1}` friend at 400 days
 * (1.1x) is far less overdue than a `{weekly,2}` friend at 20 days (5.71x),
 * yet raw days ranks the annual one higher forever and buries the short-rhythm
 * people the queue exists to protect.
 *
 * Null means unrankable by ratio: never contacted, or no rhythm to measure
 * against. Both sort to the head via `overdueRank`; in practice only the
 * never-contacted case reaches the queue, since a person with no rhythm is
 * `unstated` and so never wilting.
 *
 * Rounded to 2 decimals, and it is the ROUNDED value that sorts — so the order
 * an agent reads aloud is the order it was handed.
 */
export function overdueRatio(
  daysSince: number | null,
  rhythm: Rhythm | null | undefined,
): number | null {
  if (daysSince === null || !rhythm) {
    return null;
  }
  return (
    Math.round((daysSince / rhythmSilenceThresholdDays(rhythm)) * 100) / 100
  );
}

/**
 * Sort key for the outreach queue, applied to `overdueRatio`. Null (never
 * contacted) ranks above every ratio, and stays finite so two of them compare
 * to 0 rather than NaN.
 */
export function overdueRank(ratio: number | null): number {
  return ratio === null ? Number.MAX_SAFE_INTEGER : ratio;
}

export interface PersonToReach {
  personId: string;
  name: string;
  areaId: string;
  tags: string[];
  rhythm: Rhythm | null;
  daysSinceLastContact: number | null;
  overdueRatio: number | null;
}

/**
 * The outreach queue: who has gone quiet past their rhythm with nothing
 * already arranged, most overdue first.
 *
 * Pure — the tool handler only reads the two collections and hands them over,
 * so the filter chain, the sort direction and the after-sort slice are all
 * testable without a vault.
 */
export function selectPeopleToReach(
  habits: Record<string, Habit>,
  moments: Moment[],
  now: Date,
  opts: { areaId?: string; tag?: string; limit?: number } = {},
): PersonToReach[] {
  const { areaId, tag, limit } = opts;
  const results: PersonToReach[] = [];

  for (const habit of Object.values(habits)) {
    if (habit.kind !== 'person') {
      continue;
    }
    if (habit.isArchived) {
      continue;
    }
    if (areaId && habit.areaId !== areaId) {
      continue;
    }
    if (tag && !(habit.tags ?? []).includes(tag)) {
      continue;
    }
    if (personHealth(habit, moments, now) !== 'wilting') {
      continue;
    }
    // Already reached out and agreed a date — stay quiet.
    if (hasArrangedContact(habit.id, moments, now)) {
      continue;
    }

    const daysSince = daysSinceLastContact(habit.id, moments, now);
    const rhythm = habit.rhythm ?? null;
    results.push({
      personId: habit.id,
      name: habit.name,
      areaId: habit.areaId,
      tags: habit.tags,
      rhythm,
      daysSinceLastContact: daysSince,
      overdueRatio: overdueRatio(daysSince, rhythm),
    });
  }

  // Sort FIRST, then slice — `limit` must surface the most overdue, not an
  // arbitrary prefix of the vault's insertion order.
  results.sort(
    (a, b) => overdueRank(b.overdueRatio) - overdueRank(a.overdueRatio),
  );
  return limit ? results.slice(0, limit) : results;
}
