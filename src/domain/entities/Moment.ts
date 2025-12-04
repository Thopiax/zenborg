import { normalizeTag, validateTag } from "../services/TagService";
import type { CustomMetric } from "../value-objects/Attitude";
import type { Phase } from "../value-objects/Phase";

// Re-export for convenience
export { normalizeTag };

/**
 * Moment - A named intention (1-3 words maximum)
 *
 * Represents a conscious allocation of attention to a specific activity.
 * Moments can be unallocated (in the drawing board) or allocated to a
 * specific day and phase.
 *
 * Cycle Integration:
 * - cycleId: Links moment to a time period (for Review mode)
 * - cyclePlanId: Links to budget plan (null = spontaneous, non-null = budgeted)
 * - Budgeted moments: cyclePlanId !== null (pre-created from cycle plans)
 * - Spontaneous moments: cyclePlanId === null (ad-hoc creation)
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
  cycleId: string | null; // Which cycle TIME PERIOD this belongs to
  cyclePlanId: string | null; // Which budget plan (null = spontaneous)
  phase: Phase | null;
  day: string | null; // ISO date: "2025-01-15"
  order: number; // 0-2 (max 3 per phase)

  emoji?: string | null; // Optional emoji override (inherits from habit or area)
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
  cycleId?: string | null; // Optional link to cycle
  cyclePlanId?: string | null; // Optional link to cycle plan
  phase?: Phase | null;
  emoji?: string | null; // Optional emoji override
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
    cycleId = null, // Default to null (no cycle)
    cyclePlanId = null, // Default to null (spontaneous)
    phase = null,
    emoji = null, // Default to null (inherits from habit/area)
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
    cycleId: cycleId ? cycleId.trim() : null, // Trim or null
    cyclePlanId: cyclePlanId ? cyclePlanId.trim() : null, // Trim or null
    phase,
    day: null,
    order: 0,
    emoji: emoji ? emoji.trim() : null, // Trim or null
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
// Cycle Integration Helpers
// ============================================================================

/**
 * Checks if a moment is allocated to a day and phase
 *
 * @param moment - The moment to check
 * @returns True if moment has both day and phase set
 */
export function isAllocated(moment: Moment): boolean {
  return moment.day !== null && moment.phase !== null;
}

/**
 * Checks if a moment is in the cycle deck (unallocated but budgeted)
 *
 * @param moment - The moment to check
 * @returns True if moment is budgeted but not yet allocated
 */
export function isInDeck(moment: Moment): boolean {
  return !isAllocated(moment) && moment.cyclePlanId !== null;
}

/**
 * Checks if a moment is budgeted (created from a cycle plan)
 *
 * @param moment - The moment to check
 * @returns True if moment was created from a cycle plan
 */
export function isBudgeted(moment: Moment): boolean {
  return moment.cyclePlanId !== null;
}

/**
 * Checks if a moment is spontaneous (created ad-hoc, not from plan)
 *
 * @param moment - The moment to check
 * @returns True if moment was created ad-hoc (not from a cycle plan)
 */
export function isSpontaneous(moment: Moment): boolean {
  return moment.cyclePlanId === null;
}

// ============================================================================
// Tag Management
// ============================================================================
// Tag validation/normalization now in TagService (domain/services/TagService.ts)

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
