import type { Area, Habit, Moment } from "./vault.js";

/**
 * Tag aggregation — the derived people/place/theme index.
 *
 * Tags are the graph's stopgap: `person-<name>` and `place-<name>` namespaced
 * tags on moments (and habits) stand in for first-class Person/Place entities.
 * Everything here is computed from the collections at read time — no stored
 * index, no vault shape change, so neither vault implementation pays a cost.
 */

export interface TagIndexEntry {
  tag: string;
  moments: number;
  habits: number;
  areas: number;
  firstDay: string | null;
  lastDay: string | null;
}

export interface TagProfile {
  tag: string;
  momentCount: number;
  firstDay: string | null;
  lastDay: string | null;
  habits: { name: string; count: number }[];
  areas: { name: string; count: number }[];
  coTags: { tag: string; count: number }[];
  recentMoments: {
    name: string;
    day: string | null;
    phase: string | null;
    area: string;
  }[];
  recentMomentsTruncated: boolean;
}

const RECENT_MOMENTS_CAP = 10;

function momentTags(m: Moment): string[] {
  return m.tags ?? [];
}

/** Track earliest/lastest allocated day across a tag's moments. */
function foldDayRange(
  range: { firstDay: string | null; lastDay: string | null },
  day: string | null,
): void {
  if (day === null) return;
  if (range.firstDay === null || day < range.firstDay) range.firstDay = day;
  if (range.lastDay === null || day > range.lastDay) range.lastDay = day;
}

export function buildTagIndex(
  moments: Moment[],
  habits: Habit[],
  areas: Area[],
  prefix?: string,
): TagIndexEntry[] {
  const entries = new Map<
    string,
    TagIndexEntry & {
      range: { firstDay: string | null; lastDay: string | null };
    }
  >();
  const entry = (tag: string) => {
    let e = entries.get(tag);
    if (!e) {
      e = {
        tag,
        moments: 0,
        habits: 0,
        areas: 0,
        firstDay: null,
        lastDay: null,
        range: { firstDay: null, lastDay: null },
      };
      entries.set(tag, e);
    }
    return e;
  };

  for (const m of moments) {
    for (const tag of momentTags(m)) {
      const e = entry(tag);
      e.moments += 1;
      foldDayRange(e.range, m.day);
    }
  }
  for (const h of habits) {
    for (const tag of h.tags) entry(tag).habits += 1;
  }
  for (const a of areas) {
    for (const tag of a.tags ?? []) entry(tag).areas += 1;
  }

  return Array.from(entries.values())
    .filter((e) => (prefix ? e.tag.startsWith(prefix) : true))
    .map(({ range, ...e }) => ({
      ...e,
      firstDay: range.firstDay,
      lastDay: range.lastDay,
    }))
    .sort(
      (a, b) =>
        b.moments + b.habits + b.areas - (a.moments + a.habits + a.areas) ||
        a.tag.localeCompare(b.tag),
    );
}

export function buildTagProfile(
  tag: string,
  moments: Moment[],
  habits: Habit[],
  areas: Area[],
): TagProfile {
  const tagged = moments.filter((m) => momentTags(m).includes(tag));
  const habitById = new Map(habits.map((h) => [h.id, h]));
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const range = {
    firstDay: null as string | null,
    lastDay: null as string | null,
  };
  const byHabit = new Map<string, number>();
  const byArea = new Map<string, number>();
  const coTags = new Map<string, number>();

  for (const m of tagged) {
    foldDayRange(range, m.day);
    if (m.habitId !== null) {
      const name = habitById.get(m.habitId)?.name ?? "(archived habit)";
      byHabit.set(name, (byHabit.get(name) ?? 0) + 1);
    }
    const areaName = areaById.get(m.areaId)?.name ?? "(unknown area)";
    byArea.set(areaName, (byArea.get(areaName) ?? 0) + 1);
    for (const t of momentTags(m)) {
      if (t === tag) continue;
      coTags.set(t, (coTags.get(t) ?? 0) + 1);
    }
  }
  // Habits carrying the tag directly count even before any moment is planted.
  for (const h of habits) {
    if (h.tags.includes(tag) && !byHabit.has(h.name)) byHabit.set(h.name, 0);
  }

  const descending = <K>(m: Map<K, number>) =>
    Array.from(m.entries()).sort(
      (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])),
    );

  const recent = tagged
    .filter((m) => m.day !== null)
    .sort((a, b) => (a.day! < b.day! ? 1 : a.day! > b.day! ? -1 : 0));

  return {
    tag,
    momentCount: tagged.length,
    firstDay: range.firstDay,
    lastDay: range.lastDay,
    habits: descending(byHabit).map(([name, count]) => ({ name, count })),
    areas: descending(byArea).map(([name, count]) => ({ name, count })),
    coTags: descending(coTags).map(([t, count]) => ({ tag: t, count })),
    recentMoments: recent.slice(0, RECENT_MOMENTS_CAP).map((m) => ({
      name: m.name,
      day: m.day,
      phase: m.phase,
      area: areaById.get(m.areaId)?.name ?? "(unknown area)",
    })),
    recentMomentsTruncated: recent.length > RECENT_MOMENTS_CAP,
  };
}
