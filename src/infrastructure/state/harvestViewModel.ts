import type { Area } from "@/domain/entities/Area";
import {
  type Cycle,
  isDateInCycle,
  isHumanWritten,
} from "@/domain/entities/Cycle";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import type { Phase, PhaseConfig } from "@/domain/value-objects/Phase";
import {
  parseReflection,
  type Reflection,
} from "@/domain/value-objects/Reflection";

/**
 * Harvest view model — one closed season, read back.
 *
 * A pure projection: collections in, render-ready season out. No React, no
 * store, no clock of its own. Everything it needs about time arrives as an
 * argument, which is what makes the whole surface testable.
 *
 * What it deliberately does NOT compute: any ranking, score, percentage
 * against a budget, or comparison between seasons. Counting what was planted
 * is information; measuring it against a target is a verdict, and harvest
 * never returns one (`docs/principles.md` Red Lines).
 */

/** A moment as harvest renders it — joined to its area and its people. */
export interface HarvestMoment {
  readonly id: string;
  readonly name: string;
  readonly day: string;
  readonly phase: Phase | null;
  readonly areaId: string;
  /** Null when the area is gone — a season keeps its history either way. */
  readonly areaName: string | null;
  readonly areaColor: string | null;
  /** Names of the people present. Empty when the moment names none. */
  readonly people: readonly string[];
}

/** One day of the season, and everything planted in it. */
export interface HarvestDay {
  readonly date: string;
  readonly moments: readonly HarvestMoment[];
}

/** One season, as harvest reads it back. */
export interface HarvestSeason {
  readonly cycleId: string;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly intention: string | null;
  readonly reflection: Reflection | null;
  /**
   * Did the person write this reflection themselves? Unknown provenance reads
   * as false, so a draft is never rendered as their own words.
   */
  readonly reflectionIsHuman: boolean;
  readonly days: readonly HarvestDay[];
  /** How many moments were planted. A count, not a score. */
  readonly momentCount: number;
}

export interface DeriveHarvestInput {
  readonly cycle: Cycle;
  readonly moments: readonly Moment[];
  readonly areas: readonly Area[];
  readonly habits: readonly Habit[];
  readonly phaseConfigs: readonly PhaseConfig[];
}

/**
 * Where a phase sorts within a day.
 *
 * Read from the user's own phase configuration rather than the enum's
 * declaration order, so a garden that reorders its phases reads back in the
 * order it actually lives in. A moment with no phase sorts last.
 */
function phaseRank(
  phase: Phase | null,
  phaseConfigs: readonly PhaseConfig[],
): number {
  if (phase === null) {
    return Number.MAX_SAFE_INTEGER;
  }

  const config = phaseConfigs.find((c) => c.phase === phase);

  return config?.order ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Reads one season back: its intention, its reflection, and the moments
 * planted inside its window, grouped by day.
 *
 * The window is the season's own date range — a cycle IS a time container,
 * so containment is the definition of "planted in this season". Unallocated
 * moments (`day === null`) were never planted and are left out.
 *
 * Nothing here truncates. `DAY_VIEW_PHASE_CAPACITY` is a day-view display
 * affordance; a historical phase can legitimately hold more than three
 * moments, and dropping them would silently rewrite the record.
 */
export function deriveHarvestSeason({
  cycle,
  moments,
  areas,
  habits,
  phaseConfigs,
}: DeriveHarvestInput): HarvestSeason {
  const areasById = new Map(areas.map((a) => [a.id, a]));
  const habitsById = new Map(habits.map((h) => [h.id, h]));

  const planted = moments.filter(
    (m): m is Moment & { day: string } =>
      m.day !== null && isDateInCycle(cycle, m.day),
  );

  const byDay = new Map<string, HarvestMoment[]>();

  for (const moment of planted) {
    const area = areasById.get(moment.areaId) ?? null;

    const harvested: HarvestMoment = {
      id: moment.id,
      name: moment.name,
      day: moment.day,
      phase: moment.phase,
      areaId: moment.areaId,
      areaName: area?.name ?? null,
      areaColor: area?.color ?? null,
      people: (moment.personIds ?? [])
        .map((id) => habitsById.get(id)?.name)
        .filter((name): name is string => Boolean(name)),
    };

    const day = byDay.get(moment.day);
    if (day) {
      day.push(harvested);
    } else {
      byDay.set(moment.day, [harvested]);
    }
  }

  const orderById = new Map(moments.map((m) => [m.id, m.order]));

  const days: HarvestDay[] = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayMoments]) => ({
      date,
      moments: dayMoments.sort(
        (a, b) =>
          phaseRank(a.phase, phaseConfigs) - phaseRank(b.phase, phaseConfigs) ||
          (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0),
      ),
    }));

  return {
    cycleId: cycle.id,
    name: cycle.name,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    intention: cycle.intention,
    reflection: parseReflection(cycle.reflection),
    reflectionIsHuman: isHumanWritten(cycle),
    days,
    momentCount: planted.length,
  };
}

/**
 * Which season harvest opens on.
 *
 * Harvest is for seasons that have closed, so the most recently closed one is
 * the answer. Failing that it shows the season you are in, then the latest
 * one started — an empty garden is the only case with nothing to read back,
 * and it is an empty state, never an error.
 *
 * @param cycles - Every season in the garden
 * @param today - ISO date the read-back happens on
 */
export function pickHarvestSeason(
  cycles: readonly Cycle[],
  today: string,
): Cycle | null {
  const closed = cycles
    .filter((c) => c.endDate !== null && c.endDate < today)
    .sort((a, b) => (a.endDate as string).localeCompare(b.endDate as string));

  if (closed.length) {
    return closed[closed.length - 1];
  }

  const holdingToday = cycles
    .filter((c) => isDateInCycle(c, today))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (holdingToday.length) {
    return holdingToday[holdingToday.length - 1];
  }

  const byStart = [...cycles].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );

  return byStart[byStart.length - 1] ?? null;
}

/**
 * Which season harvest is showing: the one picked from the index, or the
 * default when nothing has been picked.
 *
 * A picked id that no longer resolves — the season was deleted from another
 * pane while harvest held its id — falls back to the default rather than
 * emptying the surface. Fail soft: a missing record means "not there", never
 * an error.
 *
 * @param cycles - Every season in the garden
 * @param selectedCycleId - The season picked from the index, or null
 * @param today - ISO date the read-back happens on
 */
export function resolveHarvestCycle(
  cycles: readonly Cycle[],
  selectedCycleId: string | null,
  today: string,
): Cycle | null {
  const selected = selectedCycleId
    ? cycles.find((c) => c.id === selectedCycleId)
    : undefined;

  return selected ?? pickHarvestSeason(cycles, today);
}
