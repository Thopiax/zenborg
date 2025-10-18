import type { Phase } from "../value-objects/Phase";

/**
 * Horizon - Time perspective for moments in the drawing board
 * A calm way to think about temporal scope without urgency
 */
export type Horizon = "now" | "soon" | "later";

/**
 * Moment - A named intention (1-3 words maximum)
 *
 * Represents a conscious allocation of attention to a specific activity.
 * Moments can be unallocated (in the drawing board) or allocated to a
 * specific day and phase.
 */
export interface Moment {
  readonly id: string;
  name: string;
  areaId: string;
  phase: Phase | null;
  day: string | null; // ISO date: "2025-01-15"
  order: number; // 0-2 (max 3 per phase)
  horizon: Horizon | null; // Temporal scope for drawing board organization
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
 * @returns New moment or error if validation fails
 */
export function createMoment(
  name: string,
  areaId: string,
  horizon: Horizon | null = null
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
    phase: null,
    day: null,
    order: 0,
    horizon,
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
