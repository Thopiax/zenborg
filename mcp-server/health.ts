import type { Habit, CyclePlan, Moment, Rhythm } from './vault.js';
import { PERIOD_DAYS, rhythmSilenceThresholdDays } from './vault.js';

export type Health =
  | 'seedling'
  | 'budding'
  | 'blooming'
  | 'wilting'
  | 'dormant'
  | 'evergreen'
  | 'unstated';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BUDDING_PERIOD_COUNT = 3;

export function resolveRhythm(
  habit: Habit,
  plan: CyclePlan | null,
): Rhythm | null {
  return plan?.rhythmOverride ?? habit.rhythm ?? null;
}

export function computeHealth(
  habit: Habit,
  plan: CyclePlan | null,
  moments: Moment[],
  now: Date,
): Health {
  if (habit.attitude === null) return 'unstated';
  if (habit.attitude === 'BEING') return 'evergreen';

  const rhythm = resolveRhythm(habit, plan);
  const habitMoments = moments.filter((m) => m.habitId === habit.id);

  if (habit.attitude === 'BEGINNING') {
    return habitMoments.length >= 5 ? 'budding' : 'seedling';
  }

  if (habit.attitude === 'KEEPING') {
    if (!rhythm) return 'unstated';
    const threshold = rhythmSilenceThresholdDays(rhythm);
    const last = latestAllocationDate(habitMoments);
    if (last === null) return 'wilting';
    const daysSince = (now.getTime() - last.getTime()) / MS_PER_DAY;
    return daysSince <= threshold ? 'blooming' : 'wilting';
  }

  if (habit.attitude === 'BUILDING' || habit.attitude === 'PUSHING') {
    if (!rhythm) return 'unstated';
    const periodDays = PERIOD_DAYS[rhythm.period];
    const buddingWindow = periodDays * BUDDING_PERIOD_COUNT;
    const habitUpdated = new Date(habit.updatedAt);
    const daysSinceUpdate =
      (now.getTime() - habitUpdated.getTime()) / MS_PER_DAY;
    if (daysSinceUpdate < buddingWindow) return 'budding';

    const periodStart = new Date(now.getTime() - periodDays * MS_PER_DAY);
    const countInPeriod = habitMoments.filter((m) => {
      if (m.day === null) return false;
      return new Date(m.day).getTime() >= periodStart.getTime();
    }).length;
    const daysElapsed = Math.min(periodDays, daysSinceUpdate);
    const expected = rhythm.count * (daysElapsed / periodDays);
    const tolerance = Math.max(1, Math.floor(rhythm.count * 0.2));
    return countInPeriod + tolerance >= expected ? 'blooming' : 'wilting';
  }

  return 'unstated';
}

function latestAllocationDate(moments: Moment[]): Date | null {
  let latest: Date | null = null;
  for (const m of moments) {
    if (m.day === null) continue;
    const d = new Date(m.day);
    if (latest === null || d > latest) latest = d;
  }
  return latest;
}

export function daysSinceLast(
  habitId: string,
  moments: Moment[],
  now: Date,
): number | null {
  const habitMoments = moments.filter((m) => m.habitId === habitId);
  const last = latestAllocationDate(habitMoments);
  if (last === null) return null;
  return Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
}
