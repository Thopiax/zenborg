import type { CustomMetric } from "../value-objects/Attitude";
import type { Phase } from "../value-objects/Phase";

/**
 * Horizon - Time perspective for moments
 *
 * Horizons organize unallocated moments in the drawing board.
 * All allocated moments go to "this week" in the timeline.
 */
export type Horizon = "this-week" | "next-week" | "this-month" | "later";

/**
 * Moment - A named intention (1-3 words maximum)
 *
 * Represents a conscious allocation of attention to a specific activity.
 * Moments can be unallocated (in the drawing board) or allocated to a
 * specific day and phase.
 *
 * Tags & Metrics (optional):
 * - customMetric: For PUSHING habit support - user-defined performance tracking
 * - tags: Flexible labels for organization (lowercase, no spaces, alphanumeric + hyphen)
 *
 * Note: Attitude now lives at Habit/Area level. Moments inherit attitude via:
 * habit?.attitude ?? area?.attitude ?? null
 */
export interface Moment {
  readonly id: string;
  name: string;
  areaId: string;
  habitId: string | null; // Optional link to Habit (emergent structure)
  phase: Phase | null;
  day: string | null; // ISO date: "2025-01-15"
  order: number; // 0-2 (max 3 per phase)
  horizon: Horizon | null; // Temporal scope for drawing board organization

  // Attitudes & Tags (Phase 2 features)
  // REMOVED: attitude field (now on Habit/Area)
  customMetric?: CustomMetric; // Keep for PUSHING habit support
  tags: string[] | null; // Flexible organization labels

  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/**
 * Result of moment name validation
 */
export interface MomentNameValidation {
  valid: boolean;
  wordCount?: number;
  error?: string;
}

/**
 * Result type for operations that may fail
 */
export type MomentResult = Moment | { error: string };

/**
 * Validates that a moment name contains 1-3 words
 *
 * @param name - The moment name to validate
 * @returns Validation result with error message if invalid
 */
export function validateMomentName(name: string): MomentNameValidation {
  const trimmed = name.trim();

  if (!trimmed) {
    return {
      valid: false,
      wordCount: 0,
      error: "Moment name cannot be empty",
    };
  }

  // Split by whitespace and filter out empty strings
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);

  if (words.length < 1) {
    return {
      valid: false,
      wordCount: 0,
      error: "Moment name must contain at least 1 word",
    };
  }

  if (words.length > 3) {
    return {
      valid: false,
      wordCount: words.length,
      error: "Moment name cannot exceed 3 words",
    };
  }

  return {
    valid: true,
    wordCount: words.length,
  };
}

/**
 * Checks if a moment can be allocated to a specific day/phase
 * Enforces the constraint: max 3 moments per (day, phase) combination
 *
 * @param moments - All existing moments
 * @param day - ISO date string
 * @param phase - Phase to allocate to
 * @returns True if allocation is allowed
 */
export function canAllocateToPhase(
  moments: Moment[],
  day: string,
  phase: Phase
): boolean {
  const momentsInPhase = moments.filter(
    (m) => m.day === day && m.phase === phase
  );

  return momentsInPhase.length < 3;
}

/**
 * Parameters for creating a new moment
 */
export interface CreateMomentProps {
  name: string;
  areaId: string;
  habitId?: string | null; // Optional link to habit
  horizon?: Horizon | null;
  phase?: Phase | null;
  // REMOVED: attitude (now on Habit/Area)
  tags?: string[];
  customMetric?: CustomMetric; // Keep for habit-inherited PUSHING support
}

/**
 * Creates a new unallocated moment
 *
 * @param props - Moment creation parameters
 * @returns New moment or error if validation fails
 */
export function createMoment(props: CreateMomentProps): MomentResult {
  const {
    name,
    areaId,
    habitId = null, // Default to null (orphaned)
    horizon = null,
    phase = null,
    tags = [],
    customMetric, // Keep for habit-inherited PUSHING support
  } = props;

  const validation = validateMomentName(name);

  if (!validation.valid) {
    return { error: validation.error! };
  }

  if (!areaId || !areaId.trim()) {
    return { error: "Moment must have an areaId" };
  }

  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    areaId: areaId.trim(),
    habitId: habitId ? habitId.trim() : null, // Trim or null
    phase,
    day: null,
    order: 0,
    horizon,
    // REMOVED: attitude
    customMetric,
    tags: tags.filter(validateTag), // Filter out invalid tags
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Parameters for allocating a moment
 */
export interface AllocateMomentProps {
  day: string;
  phase: Phase;
  order: number;
}

/**
 * Allocates a moment to a specific day and phase
 * Horizon is cleared when allocating (only relevant for unallocated moments)
 *
 * @param moment - The moment to allocate
 * @param props - Allocation parameters
 * @returns Updated moment
 */
export function allocateMoment(
  moment: Moment,
  props: AllocateMomentProps
): Moment {
  const { day, phase, order } = props;

  if (order < 0 || order > 2) {
    throw new Error("Order must be between 0 and 2");
  }

  return {
    ...moment,
    day,
    phase,
    order,
    horizon: null, // Clear horizon when allocating
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Unallocates a moment, returning it to the drawing board
 *
 * @param moment - The moment to unallocate
 * @returns Updated moment with null day/phase
 */
export function unallocateMoment(moment: Moment): Moment {
  return {
    ...moment,
    day: null,
    phase: null,
    order: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Parameters for updating a moment's name
 */
export interface UpdateMomentNameProps {
  name: string;
}

/**
 * Updates the name of a moment
 *
 * @param moment - The moment to update
 * @param props - Update parameters
 * @returns Updated moment or error if validation fails
 */
export function updateMomentName(
  moment: Moment,
  props: UpdateMomentNameProps
): MomentResult {
  const { name } = props;
  const validation = validateMomentName(name);

  if (!validation.valid) {
    return { error: validation.error! };
  }

  return {
    ...moment,
    name: name.trim(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Parameters for updating a moment's horizon
 */
export interface UpdateMomentHorizonProps {
  horizon: Horizon | null;
}

/**
 * Updates the horizon of a moment
 *
 * @param moment - The moment to update
 * @param props - Update parameters
 * @returns Updated moment
 */
export function updateMomentHorizon(
  moment: Moment,
  props: UpdateMomentHorizonProps
): Moment {
  const { horizon } = props;
  return {
    ...moment,
    horizon,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Parameters for updating a moment's area
 */
export interface UpdateMomentAreaProps {
  areaId: string;
}

/**
 * Updates the area of a moment
 *
 * @param moment - The moment to update
 * @param props - Update parameters
 * @returns Updated moment or error if validation fails
 */
export function updateMomentArea(
  moment: Moment,
  props: UpdateMomentAreaProps
): MomentResult {
  const { areaId } = props;

  if (!areaId || !areaId.trim()) {
    return { error: "Area ID cannot be empty" };
  }

  return {
    ...moment,
    areaId: areaId.trim(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Parameters for updating a moment's phase grouping
 */
export interface UpdateMomentPhaseGroupingProps {
  phase: Phase | null;
}

/**
 * Updates the phase grouping for an unallocated moment
 * Business rule: Only unallocated moments can have phase grouping
 *
 * @param moment - The moment to update
 * @param props - Update parameters
 * @returns Updated moment or error if validation fails
 */
export function updateMomentPhaseGrouping(
  moment: Moment,
  props: UpdateMomentPhaseGroupingProps
): MomentResult {
  const { phase } = props;

  if (moment.day !== null) {
    return {
      error: "Cannot set phase grouping for allocated moments",
    };
  }

  return {
    ...moment,
    phase,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Type guard to check if result is an error
 */
export function isMomentError(
  result: MomentResult
): result is { error: string } {
  return "error" in result;
}

// ============================================================================
// Tag Management
// ============================================================================

/**
 * Validates a tag format
 * Rules: lowercase, no spaces, alphanumeric + hyphen, 1-20 characters
 *
 * @param tag - Tag to validate
 * @returns True if valid
 */
export function validateTag(tag: string): boolean {
  if (!tag || typeof tag !== "string") return false;
  return /^[a-z0-9-]{1,20}$/.test(tag);
}

/**
 * Normalizes a tag to the correct format
 * Converts to lowercase, replaces spaces with hyphens
 *
 * @param tag - Tag to normalize
 * @returns Normalized tag or null if invalid
 */
export function normalizeTag(tag: string): string | null {
  if (!tag || typeof tag !== "string") return null;

  const normalized = tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, "") // Remove invalid characters
    .substring(0, 20); // Limit to 20 characters

  return validateTag(normalized) ? normalized : null;
}

/**
 * Parameters for adding a tag to a moment
 */
export interface AddTagToMomentProps {
  tag: string;
}

/**
 * Adds a tag to a moment
 *
 * @param moment - The moment to update
 * @param props - Tag parameters
 * @returns Updated moment or error if validation fails
 */
export function addTagToMoment(
  moment: Moment,
  props: AddTagToMomentProps
): MomentResult {
  const { tag } = props;
  const normalized = normalizeTag(tag);

  if (!normalized) {
    return {
      error:
        "Invalid tag format. Use lowercase, alphanumeric, and hyphens only.",
    };
  }

  // Check if tag already exists
  if (moment.tags?.includes(normalized)) {
    return moment; // Already has this tag, no-op
  }

  return {
    ...moment,
    tags: [...(moment.tags || []), normalized],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Parameters for removing a tag from a moment
 */
export interface RemoveTagFromMomentProps {
  tag: string;
}

/**
 * Removes a tag from a moment
 *
 * @param moment - The moment to update
 * @param props - Tag parameters
 * @returns Updated moment
 */
export function removeTagFromMoment(
  moment: Moment,
  props: RemoveTagFromMomentProps
): Moment {
  const { tag } = props;
  return {
    ...moment,
    tags: moment.tags?.filter((t) => t !== tag) || [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Parameters for setting moment tags
 */
export interface SetMomentTagsProps {
  tags: string[];
}

/**
 * Sets all tags for a moment (replaces existing tags)
 *
 * @param moment - The moment to update
 * @param props - Tag parameters
 * @returns Updated moment
 */
export function setMomentTags(
  moment: Moment,
  props: SetMomentTagsProps
): Moment {
  const { tags } = props;
  const validTags = tags
    .map(normalizeTag)
    .filter((t): t is string => t !== null);

  return {
    ...moment,
    tags: Array.from(new Set(validTags)), // Deduplicate
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// REMOVED: Attitude Management
// ============================================================================
// Attitude now lives at Habit/Area level (pattern, not instance).
// Moments inherit attitude via: habit?.attitude ?? area?.attitude ?? null
//
// Custom metrics still supported for PUSHING habits, managed at habit level.
