import type { CyclePlan } from "@/domain/entities/CyclePlan";
import type { Habit } from "@/domain/entities/Habit";
import { type Moment, momentInvolvesHabit } from "@/domain/entities/Moment";
import { Attitude } from "@/domain/value-objects/Attitude";
import type { Health } from "@/domain/value-objects/Health";
import {
  PERIOD_DAYS,
  type Rhythm,
  rhythmSilenceThresholdDays,
} from "@/domain/value-objects/Rhythm";
import { fromISODate } from "@/lib/dates";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BUDDING_PERIOD_COUNT = 3;
/**
 * RETURNING extends the KEEPING silence threshold to acknowledge re-engagement
 * friction. A returning practitioner has prior identity work; their tolerance
 * for gaps should sit between BEGINNING (no wilt) and KEEPING (strict threshold).
 */
const RETURNING_THRESHOLD_MULTIPLIER = 1.5;

/**
 * HabitHealthService — pure derivation of per-habit health from
 * attitude, effective rhythm, and allocation history.
 *
 * Health is NEVER stored. Recomputed on every read.
 * Effective rhythm = cyclePlan.rhythmOverride ?? habit.rhythm ?? null.
 */
export class HabitHealthService {
  resolveRhythm(habit: Habit, cyclePlan: CyclePlan | null): Rhythm | null {
    return cyclePlan?.rhythmOverride ?? habit.rhythm ?? null;
  }

  computeHealth(
    habit: Habit,
    cyclePlan: CyclePlan | null,
    moments: Moment[],
    now: Date,
  ): Health {
    const attitude = habit.attitude;
    if (attitude === null) return "unstated";
    if (attitude === Attitude.BEING) return "evergreen";

    const rhythm = this.resolveRhythm(habit, cyclePlan);
    // A moment belongs to this habit when it was planted against it OR when it
    // names it among the people present — see `momentInvolvesHabit`. Every read
    // that derives history from the moment log shares that one predicate, so
    // health and the `daysSinceLast` emitted beside it cannot disagree.
    // The attitude gate above is untouched: person health still lives in
    // PersonService, standalone and attitude-free.
    const habitMoments = moments.filter((m) =>
      momentInvolvesHabit(m, habit.id),
    );

    switch (attitude) {
      case Attitude.BEGINNING:
        return this.computeBeginning(habitMoments);
      case Attitude.RETURNING:
        return this.computeReturning(rhythm, habitMoments, now);
      case Attitude.KEEPING:
        return this.computeKeeping(rhythm, habitMoments, now);
      case Attitude.BUILDING:
      case Attitude.PUSHING:
        return this.computePaced(habit, rhythm, habitMoments, now);
      default:
        return "unstated";
    }
  }

  private computeBeginning(habitMoments: Moment[]): Health {
    return habitMoments.length >= 5 ? "budding" : "seedling";
  }

  private computeKeeping(
    rhythm: Rhythm | null,
    habitMoments: Moment[],
    now: Date,
  ): Health {
    if (!rhythm) return "unstated";
    const threshold = rhythmSilenceThresholdDays(rhythm);

    const lastAllocation = this.latestAllocationDate(habitMoments, now);
    if (lastAllocation === null) return "wilting";

    const daysSince = (now.getTime() - lastAllocation.getTime()) / MS_PER_DAY;
    return daysSince <= threshold ? "blooming" : "wilting";
  }

  /**
   * RETURNING — like KEEPING but with an extended silence threshold to
   * acknowledge re-engagement friction. Threshold = KEEPING threshold × 1.5.
   * Without a rhythm, stays unstated (cannot derive a threshold).
   */
  private computeReturning(
    rhythm: Rhythm | null,
    habitMoments: Moment[],
    now: Date,
  ): Health {
    if (!rhythm) return "unstated";
    const threshold =
      rhythmSilenceThresholdDays(rhythm) * RETURNING_THRESHOLD_MULTIPLIER;

    const lastAllocation = this.latestAllocationDate(habitMoments, now);
    if (lastAllocation === null) return "wilting";

    const daysSince = (now.getTime() - lastAllocation.getTime()) / MS_PER_DAY;
    return daysSince <= threshold ? "blooming" : "wilting";
  }

  private computePaced(
    habit: Habit,
    rhythm: Rhythm | null,
    habitMoments: Moment[],
    now: Date,
  ): Health {
    if (!rhythm) return "unstated";

    const periodDays = PERIOD_DAYS[rhythm.period];
    const buddingWindowDays = periodDays * BUDDING_PERIOD_COUNT;
    const habitUpdatedAt = new Date(habit.updatedAt);
    const daysSinceHabitUpdate =
      (now.getTime() - habitUpdatedAt.getTime()) / MS_PER_DAY;
    if (daysSinceHabitUpdate < buddingWindowDays) return "budding";

    const periodStart = new Date(now.getTime() - periodDays * MS_PER_DAY);
    const countInPeriod = habitMoments.filter((m) => {
      if (m.day === null) return false;
      const dayDate = new Date(m.day);
      return (
        dayDate.getTime() >= periodStart.getTime() &&
        dayDate.getTime() <= now.getTime()
      );
    }).length;

    const daysElapsed = Math.min(periodDays, daysSinceHabitUpdate);
    const expectedByNow = rhythm.count * (daysElapsed / periodDays);
    const tolerance = Math.max(1, Math.floor(rhythm.count * 0.2));

    return countInPeriod + tolerance >= expectedByNow ? "blooming" : "wilting";
  }

  public latestAllocationDate(
    habitMoments: Moment[],
    now: Date | null = null,
  ): Date | null {
    let latest: Date | null = null;
    for (const m of habitMoments) {
      if (m.day === null) continue;
      const d = fromISODate(m.day);
      if (now !== null && d > now) continue;
      if (latest === null || d > latest) latest = d;
    }
    return latest;
  }
}

export const habitHealthService = new HabitHealthService();
