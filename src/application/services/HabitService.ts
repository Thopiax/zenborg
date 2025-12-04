import {
  archiveHabit,
  type CreateHabitProps,
  createHabit,
  type Habit,
  type HabitResult,
  unarchiveHabit,
  updateHabit,
} from "@/domain/entities/Habit";
import { habits$ } from "@/infrastructure/state/store";

/**
 * Application Service for Habit Management
 *
 * Orchestrates habit CRUD operations with Legend State store integration.
 * This service encapsulates business workflows for habits, keeping
 * infrastructure concerns (store management) out of the domain layer.
 *
 * Business Rules:
 * 1. Validate habit name (1-3 words)
 * 2. Automatically persist to Legend State store
 * 3. Support archiving (soft delete pattern)
 */
export class HabitService {
  /**
   * Creates a new habit and adds it to the store
   *
   * @param props - Habit creation parameters
   * @returns Created habit or error if validation fails
   */
  createHabit(props: CreateHabitProps): HabitResult {
    const result = createHabit(props);

    if ("error" in result) {
      return result;
    }

    // Add to store
    habits$[result.id].set(result);

    return result;
  }

  /**
   * Updates an existing habit and syncs to store
   *
   * @param habitId - ID of habit to update
   * @param updates - Fields to update (excluding immutable fields)
   * @returns Updated habit or error if validation fails
   */
  updateHabit(
    habitId: string,
    updates: Partial<
      Omit<Habit, "id" | "isArchived" | "createdAt" | "updatedAt">
    >
  ): HabitResult {
    const existing = habits$[habitId].get();

    if (!existing) {
      return { error: `Habit with ID ${habitId} not found` };
    }

    const result = updateHabit(existing, updates);

    if ("error" in result) {
      return result;
    }

    // Update store
    habits$[habitId].set(result);

    return result;
  }

  /**
   * Archives a habit (soft delete)
   *
   * @param habitId - ID of habit to archive
   * @returns Archived habit or error if not found
   */
  archiveHabit(habitId: string): HabitResult {
    const existing = habits$[habitId].get();

    if (!existing) {
      return { error: `Habit with ID ${habitId} not found` };
    }

    const result = archiveHabit(existing);

    // Update store
    habits$[habitId].set(result);

    return result;
  }

  /**
   * Unarchives a habit
   *
   * @param habitId - ID of habit to unarchive
   * @returns Unarchived habit or error if not found
   */
  unarchiveHabit(habitId: string): HabitResult {
    const existing = habits$[habitId].get();

    if (!existing) {
      return { error: `Habit with ID ${habitId} not found` };
    }

    const result = unarchiveHabit(existing);

    // Update store
    habits$[habitId].set(result);

    return result;
  }

  /**
   * Gets a single habit by ID
   *
   * @param habitId - ID of habit to retrieve
   * @returns Habit if found, null otherwise
   */
  getHabit(habitId: string): Habit | null {
    return habits$[habitId].get() || null;
  }

  /**
   * Gets all habits (including archived)
   *
   * @returns Array of all habits
   */
  getAllHabits(): Habit[] {
    const habitsRecord = habits$.get();
    return Object.values(habitsRecord);
  }

  /**
   * Gets only active (non-archived) habits, sorted by order
   *
   * @returns Array of active habits
   */
  getActiveHabits(): Habit[] {
    const habitsRecord = habits$.get();
    return Object.values(habitsRecord)
      .filter((habit) => !habit.isArchived)
      .sort((a, b) => a.order - b.order);
  }
}
