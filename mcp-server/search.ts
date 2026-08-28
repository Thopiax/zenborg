/**
 * Fuzzy entity resolution for the garden skills plugin.
 *
 * Pure string ops -- no external dependencies. At ~200 entities per
 * collection, full scan is sub-millisecond.
 *
 * Matching strategy (ordered by confidence):
 *   1. Exact match (case-insensitive)
 *   2. Prefix match (startsWith)
 *   3. Substring match (includes)
 *   4. Levenshtein distance <= 2
 *   5. Alias match (habits and people have an `aliases` field)
 */
import type { Habit, Person, Place } from "./vault.js";

// ── Levenshtein ───────────────────────────────────────────────────────

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// ── Fuzzy match ───────────────────────────────────────────────────────

export type MatchMethod = "exact" | "prefix" | "substring" | "levenshtein";

export interface FuzzyResult {
  value: string;
  score: number;
  method: MatchMethod;
}

const MAX_LEVENSHTEIN = 2;

export function fuzzyMatch(query: string, candidates: string[]): FuzzyResult[] {
  const q = query.toLowerCase();
  const results: FuzzyResult[] = [];

  for (const candidate of candidates) {
    const c = candidate.toLowerCase();

    if (c === q) {
      results.push({ value: candidate, score: 0, method: "exact" });
    } else if (c.startsWith(q)) {
      results.push({ value: candidate, score: 1, method: "prefix" });
    } else if (c.includes(q)) {
      results.push({ value: candidate, score: 2, method: "substring" });
    } else if (levenshtein(q, c) <= MAX_LEVENSHTEIN) {
      results.push({ value: candidate, score: 3, method: "levenshtein" });
    }
  }

  results.sort((a, b) => a.score - b.score);
  return results;
}

// ── Search habits ─────────────────────────────────────────────────────

export interface HabitMatch {
  habit: Habit;
  matchedOn: "name" | "alias";
  matchedValue: string;
  score: number;
  method: MatchMethod;
}

export function searchHabits(
  query: string,
  habits: Record<string, Habit>,
  opts: { areaId?: string; includeArchived?: boolean } = {},
): HabitMatch[] {
  const { areaId, includeArchived = false } = opts;
  const results: HabitMatch[] = [];

  for (const habit of Object.values(habits)) {
    if (!includeArchived && habit.isArchived) continue;
    if (areaId && habit.areaId !== areaId) continue;

    const nameMatches = fuzzyMatch(query, [habit.name]);
    if (nameMatches.length > 0) {
      const m = nameMatches[0];
      results.push({
        habit,
        matchedOn: "name",
        matchedValue: habit.name,
        score: m.score,
        method: m.method,
      });
      continue;
    }

    const aliases = habit.aliases ?? [];
    if (aliases.length > 0) {
      const aliasMatches = fuzzyMatch(query, aliases);
      if (aliasMatches.length > 0) {
        const m = aliasMatches[0];
        results.push({
          habit,
          matchedOn: "alias",
          matchedValue: m.value,
          score: m.score + 0.5,
          method: m.method,
        });
      }
    }
  }

  results.sort((a, b) => a.score - b.score);
  return results;
}

// ── Search people ─────────────────────────────────────────────────────

export interface PersonMatch {
  person: Person;
  matchedOn: "name" | "alias" | "key";
  matchedValue: string;
  score: number;
  method: MatchMethod;
}

export function searchPeople(
  query: string,
  people: Record<string, Person>,
): PersonMatch[] {
  const results: PersonMatch[] = [];

  for (const person of Object.values(people)) {
    const nameMatches = fuzzyMatch(query, [person.name]);
    if (nameMatches.length > 0) {
      const m = nameMatches[0];
      results.push({
        person,
        matchedOn: "name",
        matchedValue: person.name,
        score: m.score,
        method: m.method,
      });
      continue;
    }

    const aliases = person.aliases ?? [];
    if (aliases.length > 0) {
      const aliasMatches = fuzzyMatch(query, aliases);
      if (aliasMatches.length > 0) {
        const m = aliasMatches[0];
        results.push({
          person,
          matchedOn: "alias",
          matchedValue: m.value,
          score: m.score + 0.5,
          method: m.method,
        });
        continue;
      }
    }

    const keyMatches = fuzzyMatch(query, [person.key]);
    if (keyMatches.length > 0) {
      const m = keyMatches[0];
      results.push({
        person,
        matchedOn: "key",
        matchedValue: person.key,
        score: m.score + 0.5,
        method: m.method,
      });
    }
  }

  results.sort((a, b) => a.score - b.score);
  return results;
}

// ── Search places ─────────────────────────────────────────────────────

export interface PlaceMatch {
  place: Place;
  matchedOn: "name" | "key" | "parentKey";
  matchedValue: string;
  score: number;
  method: MatchMethod;
}

export function searchPlaces(
  query: string,
  places: Record<string, Place>,
): PlaceMatch[] {
  const results: PlaceMatch[] = [];

  for (const place of Object.values(places)) {
    const nameMatches = fuzzyMatch(query, [place.name]);
    if (nameMatches.length > 0) {
      const m = nameMatches[0];
      results.push({
        place,
        matchedOn: "name",
        matchedValue: place.name,
        score: m.score,
        method: m.method,
      });
      continue;
    }

    const keyMatches = fuzzyMatch(query, [place.key]);
    if (keyMatches.length > 0) {
      const m = keyMatches[0];
      results.push({
        place,
        matchedOn: "key",
        matchedValue: place.key,
        score: m.score + 0.5,
        method: m.method,
      });
      continue;
    }

    if (place.parentKey) {
      const parentMatches = fuzzyMatch(query, [place.parentKey]);
      if (parentMatches.length > 0) {
        const m = parentMatches[0];
        results.push({
          place,
          matchedOn: "parentKey",
          matchedValue: place.parentKey,
          score: m.score + 1,
          method: m.method,
        });
      }
    }
  }

  results.sort((a, b) => a.score - b.score);
  return results;
}
