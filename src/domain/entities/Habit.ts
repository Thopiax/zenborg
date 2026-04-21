import { normalizeTag } from "@/domain/services/TagService";
import type { Attitude } from "../value-objects/Attitude";
import type { Phase } from "../value-objects/Phase";
import type { Rhythm } from "../value-objects/Rhythm";

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
  attitude: Attitude | null; // Override Area's attitude if set. BEING = crystallized (off-timeline).
  phase: Phase | null; // Default phase preference for this habit
  tags: string[]; // Attributes for filtering (e.g., "cardio", "outdoor")
  emoji: string | null; // Optional override of Area emoji
  isArchived: boolean; // Soft delete
  order: number; // Display order within attitude section
  description?: string; // Free-form prose describing the habit (capped at HABIT_DESCRIPTION_MAX_CHARS)
  guidance?: string; // Practitioner-facing guidance for the habit
  rhythm?: Rhythm; // Optional declared cadence (count per period)
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
  description?: string;
  guidance?: string;
  rhythm?: Rhythm;
}

/**
 * Maximum character length for Habit.description.
 * The 3-word `name` constraint is the core invariant; description is prose
 * context. Cap prevents description from eroding name's role.
 */
export const HABIT_DESCRIPTION_MAX_CHARS = 2000;

/**
 * Props for updating a habit
 */
export type UpdateHabitProps = Partial<
  Omit<Habit, "id" | "isArchived" | "createdAt" | "updatedAt">
>;

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
    description,
    guidance,
    rhythm,
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

  const normalizedTags = (tags?.map(normalizeTag).filter(Boolean) ??
    []) as string[];

  const trimmedDescription = description?.trim();
  if (trimmedDescription && trimmedDescription.length > HABIT_DESCRIPTION_MAX_CHARS) {
    return {
      error: `Habit description cannot exceed ${HABIT_DESCRIPTION_MAX_CHARS} characters`,
    };
  }
  const trimmedGuidance = guidance?.trim();

  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    areaId: areaId.trim(),
    attitude,
    phase,
    tags: normalizedTags,
    emoji: emoji ? emoji.trim() : null,
    isArchived: false,
    order,
    ...(trimmedDescription ? { description: trimmedDescription } : {}),
    ...(trimmedGuidance ? { guidance: trimmedGuidance } : {}),
    ...(rhythm ? { rhythm } : {}),
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

  if (
    updates.description !== undefined &&
    updates.description.trim().length > HABIT_DESCRIPTION_MAX_CHARS
  ) {
    return {
      error: `Habit description cannot exceed ${HABIT_DESCRIPTION_MAX_CHARS} characters`,
    };
  }

  const emoji = updates.emoji?.trim() ?? habit.emoji;

  const normalizedTags = (updates.tags?.map(normalizeTag).filter(Boolean) ??
    habit.tags ??
    []) as string[];

  const merged: Habit = {
    ...habit,
    ...updates,
    name: updates.name ? updates.name.trim() : habit.name,
    tags: normalizedTags,
    emoji,
    updatedAt: new Date().toISOString(),
  };
  if ("rhythm" in updates && updates.rhythm === undefined) {
    delete merged.rhythm;
  }
  return merged;
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
