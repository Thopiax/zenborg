import { normalizeTag } from "../services/TagService";
import type { Attitude } from "../value-objects/Attitude";
import type { Phase } from "../value-objects/Phase";

/**
 * Habit - Recurring moment template
 *
 * Habits represent patterns that emerge from repeated moments.
 * Users create habits from patterns or proactively in Planning phase.
 * Habits provide structure while preserving organic moment creation.
 */
export interface Habit {
  readonly id: string;
  name: string; // 1-3 words
  areaId: string; // FK to Area (required parent)
  attitude: Attitude | null; // Override Area's attitude if set
  phase: Phase | null; // Default phase preference for this habit
  tags: string[]; // Attributes for filtering (e.g., "cardio", "outdoor")
  emoji: string | null; // Optional override of Area emoji
  isArchived: boolean; // Soft delete
  order: number; // Display order within attitude section
  createdAt: string;
  updatedAt: string;
}

/**
 * Result type for operations that may fail
 */
export type HabitResult = Habit | { error: string };

/**
 * Props for creating a habit
 */
export interface CreateHabitProps {
  name: string;
  areaId: string;
  order: number;
  attitude?: Attitude | null;
  phase?: Phase | null;
  tags?: string[];
  emoji?: string | null;
}

/**
 * Validates habit name (1-3 words)
 */
function validateHabitName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: "Habit name cannot be empty" };
  }

  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);

  if (words.length < 1) {
    return { valid: false, error: "Habit name must contain at least 1 word" };
  }

  if (words.length > 3) {
    return {
      valid: false,
      error: "Habit name cannot exceed 3 words",
    };
  }

  return { valid: true };
}

/**
 * Creates a new habit
 */
export function createHabit(props: CreateHabitProps): HabitResult {
  const {
    name,
    areaId,
    order,
    attitude = null,
    phase = null,
    tags = [],
    emoji = null,
  } = props;

  const validation = validateHabitName(name);
  if (!validation.valid) {
    return { error: validation.error! };
  }

  if (!areaId || !areaId.trim()) {
    return { error: "Habit must have an areaId" };
  }

  if (order < 0) {
    return { error: "Order must be non-negative" };
  }

  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    areaId: areaId.trim(),
    attitude,
    phase,
    tags: tags.map(normalizeTag).filter((t): t is string => t !== null),
    emoji: emoji ? emoji.trim() : null,
    isArchived: false,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Updates habit properties (excluding immutable fields and those with dedicated methods)
 */
export function updateHabit(
  habit: Habit,
  updates: Partial<Omit<Habit, "id" | "isArchived" | "createdAt" | "updatedAt">>
): HabitResult {
  if (updates.name !== undefined) {
    const validation = validateHabitName(updates.name);
    if (!validation.valid) {
      return { error: validation.error! };
    }
  }

  if (updates.order !== undefined && updates.order < 0) {
    return { error: "Order must be non-negative" };
  }

  return {
    ...habit,
    ...updates,
    name: updates.name ? updates.name.trim() : habit.name,
    tags: updates.tags
      ? updates.tags.map(normalizeTag).filter((t): t is string => t !== null)
      : habit.tags,
    emoji:
      updates.emoji !== undefined
        ? updates.emoji
          ? updates.emoji.trim()
          : null
        : habit.emoji,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Archives a habit (soft delete)
 */
export function archiveHabit(habit: Habit): Habit {
  return {
    ...habit,
    isArchived: true,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Unarchives a habit
 */
export function unarchiveHabit(habit: Habit): Habit {
  return {
    ...habit,
    isArchived: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Type guard to check if result is an error
 */
export function isHabitError(result: HabitResult): result is { error: string } {
  return "error" in result;
}
