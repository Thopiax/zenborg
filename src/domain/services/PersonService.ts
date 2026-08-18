import type { Moment } from "@/domain/entities/Moment";
import { type Cadence, cadenceDays } from "@/domain/value-objects/Cadence";
import type { Health } from "@/domain/value-objects/Health";
import { fromISODate } from "@/lib/dates";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * PersonService — pure derivations for people, keyed by registry entity key.
 *
 * A person is a registry entity (spec D1), not a habit. Zenborg holds only
 * references: `Moment.personIds` carries entity keys such as `"ada"`. The
 * declared contact cadence and the paused/active status are registry facts
 * and arrive here as parameters — this module never reads a habit record and
 * never stores anything (spec D9).
 *
 * Deliberately independent of HabitHealthService: attitude is not even an
 * input. A person's health is cadence and silence, nothing else.
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
export function personMoments(personKey: string, moments: Moment[]): Moment[] {
  const found: Moment[] = [];
  for (const m of moments) {
    if (m.habitId === personKey || (m.personIds?.includes(personKey) ?? false)) {
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
  personKey: string,
  moments: Moment[],
  now: Date,
): Date | null {
  let latest: Date | null = null;
  for (const m of personMoments(personKey, moments)) {
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
  personKey: string,
  moments: Moment[],
  now: Date,
): boolean {
  for (const m of personMoments(personKey, moments)) {
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
 * the threshold — so this can show a stable "7" while health flips from
 * blooming to wilting at midday.
 */
export function daysSinceLastContact(
  personKey: string,
  moments: Moment[],
  now: Date,
): number | null {
  const last = latestContactDate(personKey, moments, now);
  if (last === null) {
    return null;
  }
  return Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
}

/**
 * Person health: declared cadence and silence only.
 *
 *   paused          -> "unstated"  (stepped back deliberately, never nagged)
 *   no cadence      -> "unstated"  (a roster entry, not a commitment)
 *   never seen      -> "wilting"
 *   within bucket   -> "blooming"
 *   past bucket     -> "wilting"
 *
 * Cadence and status are registry facts, passed in — zenborg stores neither.
 */
export function personHealth(
  personKey: string,
  cadence: Cadence | null,
  status: "active" | "paused",
  moments: Moment[],
  now: Date,
): Health {
  if (status === "paused") {
    return "unstated";
  }
  if (cadence === null) {
    return "unstated";
  }
  const last = latestContactDate(personKey, moments, now);
  if (last === null) {
    return "wilting";
  }
  const daysSince = (now.getTime() - last.getTime()) / MS_PER_DAY;
  return daysSince <= cadenceDays(cadence) ? "blooming" : "wilting";
}
