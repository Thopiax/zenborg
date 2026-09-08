import type { CyclePlan } from "@/domain/entities/CyclePlan";
import type { Habit } from "@/domain/entities/Habit";
import {
  countsAsAllocation,
  type Moment,
  momentInvolvesHabit,
} from "@/domain/entities/Moment";
import { Attitude } from "@/domain/value-objects/Attitude";
import { PERIOD_DAYS, type Rhythm } from "@/domain/value-objects/Rhythm";
import { fromISODate } from "@/lib/dates";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Attitude modulates how fast a habit wilts — borrowed from spaced repetition's
 * ease factor. Same rhythm, different resilience.
 */
const ATTITUDE_MULTIPLIER: Record<Attitude, number> = {
  [Attitude.BEGINNING]: 1.0,
  [Attitude.RETURNING]: 1.2,
  [Attitude.KEEPING]: 1.8,
  [Attitude.BUILDING]: 1.4,
  [Attitude.PUSHING]: 1.2,
  [Attitude.PRUNING]: 1.0,
  [Attitude.BEING]: 2.5,
};

export interface ThirstInput {
  readonly habit: Habit;
  readonly cyclePlan: CyclePlan | null;
  readonly moments: readonly Moment[];
  readonly now: Date;
  /** Days elapsed in the current cycle, for plan deficit. */
  readonly cycleDaysElapsed?: number;
  /** Total days in the current cycle. */
  readonly cycleDaysTotal?: number;
}

export interface ThirstScore {
  readonly habitId: string;
  /** >1.0 = wilting. Higher = thirstier. 0 = no signal (no rhythm). */
  readonly score: number;
  readonly daysSinceLast: number | null;
  readonly planDeficit: number;
}

/**
 * Compute thirst for a single habit.
 *
 * thirst = daysSinceLast / effectiveInterval
 *   where effectiveInterval = (periodDays / count) × attitudeMultiplier
 *
 * Plan deficit adds a bonus: (budgeted − actual) / budgeted, scaled to [0, 1],
 * added to the base thirst so under-watered cycle plans surface.
 */
export function computeThirst(input: ThirstInput): ThirstScore {
  const { habit, cyclePlan, moments, now, cycleDaysElapsed, cycleDaysTotal } =
    input;

  const rhythm: Rhythm | null =
    cyclePlan?.rhythmOverride ?? habit.rhythm ?? null;
  if (!rhythm) return { habitId: habit.id, score: 0, daysSinceLast: null, planDeficit: 0 };

  const habitMoments = moments.filter(
    (m) => countsAsAllocation(m) && momentInvolvesHabit(m, habit.id),
  );

  const daysSinceLast = latestDaysSince(habitMoments, now);

  const periodDays = PERIOD_DAYS[rhythm.period];
  const optimalInterval = periodDays / rhythm.count;
  const multiplier =
    ATTITUDE_MULTIPLIER[habit.attitude ?? Attitude.BEGINNING];
  const effectiveInterval = optimalInterval * multiplier;

  const baseThirst =
    daysSinceLast !== null ? daysSinceLast / effectiveInterval : 2.0;

  const planDeficit = computePlanDeficit(
    cyclePlan,
    habitMoments,
    cycleDaysElapsed,
    cycleDaysTotal,
  );

  return {
    habitId: habit.id,
    score: baseThirst + planDeficit,
    daysSinceLast,
    planDeficit,
  };
}

function latestDaysSince(
  habitMoments: readonly Moment[],
  now: Date,
): number | null {
  let latest: Date | null = null;
  for (const m of habitMoments) {
    if (m.day === null) continue;
    const d = fromISODate(m.day);
    if (d > now) continue;
    if (latest === null || d > latest) latest = d;
  }
  if (latest === null) return null;
  return (now.getTime() - latest.getTime()) / MS_PER_DAY;
}

/**
 * Plan deficit: how far behind the cycle budget this habit is.
 * Returns a value in [0, 1] representing the fractional shortfall.
 * 0 = on track or no plan. 1 = said N×, done 0×.
 */
function computePlanDeficit(
  cyclePlan: CyclePlan | null,
  habitMoments: readonly Moment[],
  cycleDaysElapsed?: number,
  cycleDaysTotal?: number,
): number {
  if (!cyclePlan || cyclePlan.budgetedCount <= 0) return 0;
  if (!cycleDaysElapsed || !cycleDaysTotal || cycleDaysTotal <= 0) return 0;

  const progress = Math.min(cycleDaysElapsed / cycleDaysTotal, 1);
  const expectedByNow = cyclePlan.budgetedCount * progress;
  const actual = habitMoments.filter((m) => m.cyclePlanId !== null).length;

  if (expectedByNow <= 0) return 0;
  const deficit = Math.max(0, expectedByNow - actual) / cyclePlan.budgetedCount;
  return Math.min(deficit, 1);
}

/**
 * Sort gap practices by thirst, thirstiest first.
 */
export function rankByThirst(scores: readonly ThirstScore[]): readonly ThirstScore[] {
  return [...scores].sort((a, b) => b.score - a.score);
}

// ── Body battery energy gate ──────────────────────────────────────────

const THIRTY_SECONDS = 30_000;
const TWO_MINUTES = 2 * 60_000;

export interface EnergyCandidate {
  readonly habitId: string;
  readonly fitsMs?: number;
  readonly attitude?: Attitude | null;
}

/**
 * Filter and reorder gap candidates by Garmin body battery (0–100).
 *
 * | Battery | Max duration | Bias                        |
 * |---------|--------------|-----------------------------|
 * | < 25    | 30s          | restorative only            |
 * | 25–50   | 2m           | favor gentle                |
 * | 50–75   | —            | full selection              |
 * | 75+     | —            | slight boost to PUSHING/BUILDING |
 *
 * Undefined battery = moderate band (full selection, no bias).
 */
export function filterByEnergy<T extends EnergyCandidate>(
  candidates: readonly T[],
  bodyBattery?: number,
): readonly T[] {
  if (bodyBattery === undefined || bodyBattery === null) return candidates;

  if (bodyBattery < 25) {
    return candidates.filter(
      (c) => c.fitsMs !== undefined && c.fitsMs <= THIRTY_SECONDS,
    );
  }

  if (bodyBattery < 50) {
    return candidates.filter(
      (c) => c.fitsMs !== undefined && c.fitsMs <= TWO_MINUTES,
    );
  }

  if (bodyBattery >= 75) {
    // ponytail: simple sort bump, not a weighted score — upgrade if calibration data says otherwise
    const boost = new Set([Attitude.PUSHING, Attitude.BUILDING]);
    return [...candidates].sort((a, b) => {
      const aBoost = boost.has(a.attitude as Attitude) ? -1 : 0;
      const bBoost = boost.has(b.attitude as Attitude) ? -1 : 0;
      return aBoost - bBoost;
    });
  }

  return candidates;
}
