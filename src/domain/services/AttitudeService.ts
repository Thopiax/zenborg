import type { Moment } from "@/domain/entities/Moment";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import type { Attitude } from "@/domain/value-objects/Attitude";

/**
 * Domain Service: Attitude Resolution
 *
 * Handles attitude inheritance chain: moment -> habit?.attitude -> area?.attitude -> null
 * This is a domain service because it encapsulates business rules about
 * how attitudes flow through the domain model hierarchy.
 *
 * Business Rules:
 * 1. Moments inherit attitudes from linked habits first
 * 2. If no habit or habit has no attitude, inherit from area
 * 3. If no area attitude, default to null (pure presence)
 */
export class AttitudeService {
  /**
   * Computes the effective attitude for a moment using inheritance chain
   *
   * Business Rule: Moments inherit attitudes from habits, then areas, then default to null
   *
   * @param moment - The moment to compute attitude for
   * @param habits - Record of all habits by ID
   * @param areas - Record of all areas by ID
   * @returns The computed attitude or null (pure presence)
   */
  getMomentAttitude(
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

  /**
   * Batch compute attitudes for multiple moments
   * Useful for bulk operations and grouping
   *
   * @param moments - Array of moments to compute attitudes for
   * @param habits - Record of all habits by ID
   * @param areas - Record of all areas by ID
   * @returns Map of moment ID to computed attitude
   */
  getMomentsAttitudes(
    moments: Moment[],
    habits: Record<string, Habit>,
    areas: Record<string, Area>
  ): Map<string, Attitude | null> {
    const result = new Map<string, Attitude | null>();

    for (const moment of moments) {
      result.set(moment.id, this.getMomentAttitude(moment, habits, areas));
    }

    return result;
  }
}

/**
 * Singleton instance for convenience
 * Use this in application code: attitudeService.getMomentAttitude(...)
 */
export const attitudeService = new AttitudeService();
