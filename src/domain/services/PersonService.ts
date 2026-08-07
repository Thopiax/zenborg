import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import type { Health } from "@/domain/value-objects/Health";
import { rhythmSilenceThresholdDays } from "@/domain/value-objects/Rhythm";
import { fromISODate } from "@/lib/dates";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * PersonService — pure derivations for people (habits with kind "person").
 *
 * Deliberately independent of HabitHealthService. That service gates on
 * attitude before rhythm (`attitude === null` short-circuits to "unstated"),
 * which would make attitude load-bearing for people — the exact coupling the
 * people design set out to remove. A person is never BUILDING or PUSHING;
 * their health is rhythm and silence, nothing else.
 *
 * Health is NEVER stored. Recomputed on every read.
 */

/**
 * Every moment involving this person.
 *
 * `habitId` is matched as well as `personIds` so that history predating the
 * people migration still counts — those moments were planted against the
 * person's own habit record, whose id the person kept.
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
    const d = fromISODate(m.day);
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
    if (fromISODate(m.day) > now) {
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
 * Person health: rhythm and silence only.
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
    return "unstated";
  }
  const last = latestContactDate(person.id, moments, now);
  if (last === null) {
    return "wilting";
  }
  const daysSince = (now.getTime() - last.getTime()) / MS_PER_DAY;
  return daysSince <= rhythmSilenceThresholdDays(person.rhythm)
    ? "blooming"
    : "wilting";
}
