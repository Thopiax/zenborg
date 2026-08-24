import type { CyclePlan, Habit, Moment, Rhythm } from "./vault.js";
import { PERIOD_DAYS, rhythmSilenceThresholdDays } from "./vault.js";

export type Health =
  | "seedling"
  | "budding"
  | "blooming"
  | "wilting"
  | "dormant"
  | "evergreen"
  | "unstated";

/**
 * Mirrors src/domain/entities/Moment.ts countsAsAllocation (spec D5).
 * The single predicate every aggregating filter composes with, so the
 * call sites cannot drift apart on what counts.
 */
export function countsAsAllocation(moment: Moment): boolean {
  return moment.status !== "tentative";
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BUDDING_PERIOD_COUNT = 3;
/**
 * RETURNING extends the KEEPING silence threshold to acknowledge re-engagement
 * friction. Mirrors src/domain/services/HabitHealthService.ts.
 */
const RETURNING_THRESHOLD_MULTIPLIER = 1.5;

/**
 * Parse a YYYY-MM-DD vault date string as local midnight.
 * Using bare `new Date(dayString)` would parse as UTC midnight, which drifts
 * by a day in negative UTC offsets at day boundaries. Matches the domain
 * side's `fromISODate` behavior from `src/lib/dates.ts`.
 */
export function parseVaultDay(day: string): Date {
  return new Date(`${day}T00:00:00`);
}

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
  if (habit.attitude === null) return "unstated";
  if (habit.attitude === "BEING") return "evergreen";

  const rhythm = resolveRhythm(habit, plan);
  // A moment belongs to this habit when it was planted against it OR when it
  // names it among the people present. People ARE habit records, so one dinner
  // with three friends is ONE moment carrying three `personIds` — without the
  // second clause that dinner would be invisible here while list_people_to_reach
  // counts it, and the two read-paths would disagree about the same person.
  // For an ordinary habit `personIds` can never hold its own id, so this is
  // provably inert there. Mirrors src/domain/services/HabitHealthService.ts.
  const habitMoments = moments.filter(
    (m) =>
      countsAsAllocation(m) &&
      (m.habitId === habit.id || (m.personIds?.includes(habit.id) ?? false)),
  );

  if (habit.attitude === "BEGINNING") {
    return habitMoments.length >= 5 ? "budding" : "seedling";
  }

  if (habit.attitude === "RETURNING") {
    if (!rhythm) return "unstated";
    const threshold =
      rhythmSilenceThresholdDays(rhythm) * RETURNING_THRESHOLD_MULTIPLIER;
    const last = latestAllocationDate(habitMoments);
    if (last === null) return "wilting";
    const daysSince = (now.getTime() - last.getTime()) / MS_PER_DAY;
    return daysSince <= threshold ? "blooming" : "wilting";
  }

  if (habit.attitude === "KEEPING") {
    if (!rhythm) return "unstated";
    const threshold = rhythmSilenceThresholdDays(rhythm);
    const last = latestAllocationDate(habitMoments);
    if (last === null) return "wilting";
    const daysSince = (now.getTime() - last.getTime()) / MS_PER_DAY;
    return daysSince <= threshold ? "blooming" : "wilting";
  }

  if (habit.attitude === "BUILDING" || habit.attitude === "PUSHING") {
    if (!rhythm) return "unstated";
    const periodDays = PERIOD_DAYS[rhythm.period];
    const buddingWindow = periodDays * BUDDING_PERIOD_COUNT;
    const habitUpdated = new Date(habit.updatedAt);
    const daysSinceUpdate =
      (now.getTime() - habitUpdated.getTime()) / MS_PER_DAY;
    if (daysSinceUpdate < buddingWindow) return "budding";

    const periodStart = new Date(now.getTime() - periodDays * MS_PER_DAY);
    const countInPeriod = habitMoments.filter((m) => {
      if (m.day === null) return false;
      return parseVaultDay(m.day).getTime() >= periodStart.getTime();
    }).length;
    const daysElapsed = Math.min(periodDays, daysSinceUpdate);
    const expected = rhythm.count * (daysElapsed / periodDays);
    const tolerance = Math.max(1, Math.floor(rhythm.count * 0.2));
    return countInPeriod + tolerance >= expected ? "blooming" : "wilting";
  }

  return "unstated";
}

function latestAllocationDate(moments: Moment[]): Date | null {
  let latest: Date | null = null;
  for (const m of moments) {
    if (!countsAsAllocation(m)) continue;
    if (m.day === null) continue;
    const d = parseVaultDay(m.day);
    if (latest === null || d > latest) latest = d;
  }
  return latest;
}

export function daysSinceLast(
  habitId: string,
  moments: Moment[],
  now: Date,
): number | null {
  // Same widening as `computeHealth` — these two are emitted side by side in
  // get_habit_health / list_wilting_habits, so a narrower filter here would
  // report "90 days" next to a "blooming" derived from the very same moments.
  const habitMoments = moments.filter(
    (m) =>
      countsAsAllocation(m) &&
      (m.habitId === habitId || (m.personIds?.includes(habitId) ?? false)),
  );
  const last = latestAllocationDate(habitMoments);
  if (last === null) return null;
  return Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
}
