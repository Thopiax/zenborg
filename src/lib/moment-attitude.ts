import type { Moment } from "@/domain/entities/Moment";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import type { Attitude } from "@/domain/value-objects/Attitude";

/**
 * Computes the attitude for a moment using inheritance chain:
 * moment -> habit?.attitude -> area?.attitude -> null
 *
 * Moments don't have attitudes directly. Instead, they inherit from:
 * 1. Their linked habit's attitude (if habitId is set and habit exists)
 * 2. Their area's attitude (if no habit or habit has no attitude)
 * 3. null (pure presence, no relationship mode)
 *
 * @param moment - The moment to compute attitude for
 * @param habits - Record of all habits by ID
 * @param areas - Record of all areas by ID
 * @returns The computed attitude or null
 */
export function getMomentAttitude(
  moment: Moment,
  habits: Record<string, Habit>,
  areas: Record<string, Area>
): Attitude | null {
  // Try to get attitude from linked habit first
  if (moment.habitId) {
    const habit = habits[moment.habitId];
    if (habit && habit.attitude !== null) {
      return habit.attitude;
    }
  }

  // Fall back to area attitude
  const area = areas[moment.areaId];
  if (area && area.attitude !== null) {
    return area.attitude;
  }

  // Default to null (pure presence)
  return null;
}
