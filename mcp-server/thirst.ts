import type { Attitude, CyclePlan, Habit, Moment, Rhythm } from "./vault.js";
import { PERIOD_DAYS } from "./vault.js";
import { countsAsAllocation, daysSinceLast, parseVaultDay, resolveRhythm } from "./health.js";

const GAP_TAG = "gap";
const SIZE_TAG = /^gap-(\d+)(s|m)$/;
const PLACE_PREFIX = "place-";

const ATTITUDE_MULTIPLIER: Record<Attitude, number> = {
  BEGINNING: 1.0,
  RETURNING: 1.2,
  KEEPING: 1.8,
  BUILDING: 1.4,
  PUSHING: 1.2,
  PRUNING: 1.0,
  BEING: 2.5,
};

export interface GapProposal {
  readonly habitId: string;
  readonly name: string;
  readonly thirst: number;
  readonly fitsMs?: number;
  readonly link?: string;
}

function sizeOf(tags: readonly string[]): number | undefined {
  for (const t of tags) {
    const m = SIZE_TAG.exec(t.trim().toLowerCase());
    if (!m) continue;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) continue;
    return m[2] === "s" ? n * 1000 : n * 60_000;
  }
  return undefined;
}

function placesOf(habit: Habit): readonly string[] {
  const declared = (habit.placeIds ?? [])
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0);
  if (declared.length > 0) return declared;
  return (habit.tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.startsWith(PLACE_PREFIX))
    .map((t) => t.slice(PLACE_PREFIX.length))
    .filter((p) => p.length > 0);
}

function computeThirst(
  habit: Habit,
  plan: CyclePlan | null,
  moments: Moment[],
  now: Date,
  cycleDaysElapsed?: number,
  cycleDaysTotal?: number,
): number {
  const rhythm = resolveRhythm(habit, plan);
  if (!rhythm) return 0;

  const days = daysSinceLast(habit.id, moments, now);
  const periodDays = PERIOD_DAYS[rhythm.period];
  const optimalInterval = periodDays / rhythm.count;
  const multiplier = ATTITUDE_MULTIPLIER[habit.attitude ?? "BEGINNING"];
  const effectiveInterval = optimalInterval * multiplier;

  const baseThirst = days !== null ? days / effectiveInterval : 2.0;

  let planDeficit = 0;
  if (plan && plan.budgetedCount > 0 && cycleDaysElapsed && cycleDaysTotal && cycleDaysTotal > 0) {
    const progress = Math.min(cycleDaysElapsed / cycleDaysTotal, 1);
    const expected = plan.budgetedCount * progress;
    const actual = moments.filter(
      (m) => countsAsAllocation(m) && m.habitId === habit.id && m.cyclePlanId !== null,
    ).length;
    if (expected > 0) {
      planDeficit = Math.min(Math.max(0, expected - actual) / plan.budgetedCount, 1);
    }
  }

  return baseThirst + planDeficit;
}

/**
 * Returns the thirstiest gap habits that fit the available window.
 * `withinMs` caps by gap-tag duration; `at` filters by place.
 */
export function proposeGap(
  habits: Record<string, Habit>,
  moments: Moment[],
  cycles: Record<string, { startDate: string; endDate: string | null }>,
  cyclePlans: Record<string, CyclePlan>,
  now: Date,
  withinMs?: number,
  at?: string,
  maxResults = 3,
): GapProposal[] {
  const isoToday = now.toISOString().slice(0, 10);
  const here = at?.trim().toLowerCase();

  const candidates: GapProposal[] = [];
  for (const habit of Object.values(habits)) {
    if (habit.isArchived) continue;
    const tags = (habit.tags ?? []).map((t) => t.trim().toLowerCase());
    if (!tags.includes(GAP_TAG)) continue;

    const places = placesOf(habit);
    if (here && places.length > 0 && !places.includes(here)) continue;

    const fitsMs = sizeOf(tags);
    if (withinMs !== undefined && fitsMs !== undefined && fitsMs > withinMs) continue;

    const activePlan = Object.values(cyclePlans).find((p) => {
      if (p.habitId !== habit.id) return false;
      const c = cycles[p.cycleId];
      if (!c) return false;
      return c.startDate <= isoToday && (!c.endDate || c.endDate >= isoToday);
    }) ?? null;

    let cycleDaysElapsed: number | undefined;
    let cycleDaysTotal: number | undefined;
    if (activePlan) {
      const c = cycles[activePlan.cycleId];
      if (c?.endDate) {
        const start = parseVaultDay(c.startDate);
        const end = parseVaultDay(c.endDate);
        cycleDaysTotal = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
        cycleDaysElapsed = (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
      }
    }

    const thirst = computeThirst(habit, activePlan, moments, now, cycleDaysElapsed, cycleDaysTotal);
    if (thirst <= 0) continue;

    candidates.push({
      habitId: habit.id,
      name: habit.name,
      thirst: Math.round(thirst * 100) / 100,
      ...(fitsMs ? { fitsMs } : {}),
      ...(habit.link ? { link: habit.link } : {}),
    });
  }

  // ponytail: O(n log n) sort — fine for ~200 habits, heap-select if the roster grows past 1000
  candidates.sort((a, b) => b.thirst - a.thirst);
  return candidates.slice(0, maxResults);
}
