import { Attitude, type CustomMetric } from "../value-objects/Attitude";
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
 * Attitudes & Tags (optional):
 * - attitude: Optional relationship mode (beginning, keeping, building, pushing, being)
 * - customMetric: Only for PUSHING attitude - user-defined performance tracking
 * - tags: Flexible labels for organization (lowercase, no spaces, alphanumeric + hyphen)
 */
export interface Moment {
  readonly id: string;
  name: string;
  areaId: string;
  phase: Phase | null;
  day: string | null; // ISO date: "2025-01-15"
  order: number; // 0-2 (max 3 per phase)
  horizon: Horizon | null; // Temporal scope for drawing board organization

  // Attitudes & Tags (Phase 2 features)
  attitude: Attitude | null; // Optional relationship mode
  customMetric?: CustomMetric; // Only for PUSHING attitude
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
 * Creates a new unallocated moment
 *
 * @param name - Moment name (1-3 words)
 * @param areaId - ID of the area this moment belongs to
 * @param horizon - Optional time horizon
 * @param attitude - Optional attitude (default: null for pure presence)
 * @param tags - Optional tags (default: empty array)
 * @param customMetric - Optional custom metric (only for PUSHING attitude)
 * @returns New moment or error if validation fails
 */
export function createMoment(
  name: string,
  areaId: string,
  horizon: Horizon | null = null,
  phase: Phase | null = null,
  attitude: Attitude | null = null,
  tags: string[] = [],
  customMetric?: CustomMetric
): MomentResult {
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
    phase,
    day: null,
    order: 0,
    horizon,
    attitude,
    customMetric,
    tags: tags.filter(validateTag), // Filter out invalid tags
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Allocates a moment to a specific day and phase
 * Horizon is cleared when allocating (only relevant for unallocated moments)
 *
 * @param moment - The moment to allocate
 * @param day - ISO date string
 * @param phase - Phase to allocate to
 * @param order - Position within the phase (0-2)
 * @returns Updated moment
 */
export function allocateMoment(
  moment: Moment,
  day: string,
  phase: Phase,
  order: number
): Moment {
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
 * Updates the name of a moment
 *
 * @param moment - The moment to update
 * @param newName - New name (1-3 words)
 * @returns Updated moment or error if validation fails
 */
export function updateMomentName(
  moment: Moment,
  newName: string
): MomentResult {
  const validation = validateMomentName(newName);

  if (!validation.valid) {
    return { error: validation.error! };
  }

  return {
    ...moment,
    name: newName.trim(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Updates the horizon of a moment
 *
 * @param moment - The moment to update
 * @param horizon - New time horizon
 * @returns Updated moment
 */
export function updateMomentHorizon(
  moment: Moment,
  horizon: Horizon | null
): Moment {
  return {
    ...moment,
    horizon,
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
 * Adds a tag to a moment
 *
 * @param moment - The moment to update
 * @param tag - Tag to add (will be normalized)
 * @returns Updated moment or error if validation fails
 */
export function addTagToMoment(moment: Moment, tag: string): MomentResult {
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
 * Removes a tag from a moment
 *
 * @param moment - The moment to update
 * @param tag - Tag to remove
 * @returns Updated moment
 */
export function removeTagFromMoment(moment: Moment, tag: string): Moment {
  return {
    ...moment,
    tags: moment.tags?.filter((t) => t !== tag) || [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sets all tags for a moment (replaces existing tags)
 *
 * @param moment - The moment to update
 * @param tags - New tags array (will be normalized and validated)
 * @returns Updated moment
 */
export function setMomentTags(moment: Moment, tags: string[]): Moment {
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
// Attitude Management
// ============================================================================

/**
 * Sets the attitude for a moment
 *
 * @param moment - The moment to update
 * @param attitude - New attitude (null for pure presence)
 * @returns Updated moment
 */
export function setMomentAttitude(
  moment: Moment,
  attitude: Attitude | null
): Moment {
  return {
    ...moment,
    attitude,
    // Clear custom metric if attitude is not PUSHING
    customMetric:
      attitude === Attitude.PUSHING ? moment.customMetric : undefined,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sets the custom metric for a moment with PUSHING attitude
 *
 * @param moment - The moment to update
 * @param metric - Custom metric definition
 * @returns Updated moment or error if validation fails
 */
export function setMomentCustomMetric(
  moment: Moment,
  metric: CustomMetric
): MomentResult {
  if (moment.attitude !== Attitude.PUSHING) {
    return { error: "Custom metrics are only available for PUSHING attitude" };
  }

  if (!metric.name || !metric.unit) {
    return { error: "Metric must have a name and unit" };
  }

  return {
    ...moment,
    customMetric: metric,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Clears the custom metric from a moment
 *
 * @param moment - The moment to update
 * @returns Updated moment
 */
export function clearMomentCustomMetric(moment: Moment): Moment {
  return {
    ...moment,
    customMetric: undefined,
    updatedAt: new Date().toISOString(),
  };
}
