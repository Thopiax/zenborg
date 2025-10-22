/**
 * Attitude - Optional relationship mode for moments that need progression support
 *
 * Philosophy: Most moments exist in pure presence (allocation = realization).
 * Some moments benefit from tracking appropriate to how you're currently
 * relating to that practice. Attitudes make this relationship explicit and
 * provide minimal, appropriate feedback.
 *
 * Core Principle: You choose your attitude. The system reflects it.
 * No prescription, no judgment, no optimization pressure.
 */

/**
 * The five attitudes representing different relationships to a practice
 */
export enum Attitude {
  /** First encounters, exploration - shows count of times allocated */
  BEGINNING = "BEGINNING",
  /** Sporadic engagement, maintaining connection - shows days since last */
  KEEPING = "KEEPING",
  /** Regular practice, developing capacity - shows frequency patterns */
  BUILDING = "BUILDING",
  /** Focused progression, specific goals - shows custom metrics */
  PUSHING = "PUSHING",
  /** Integrated, automatic, part of identity - moves to crystallized routines */
  BEING = "BEING",
}

/**
 * Custom metric definition for PUSHING attitude
 * User-defined performance tracking
 */
export interface CustomMetric {
  /** Name of the metric (e.g., "distance", "weight", "tempo") */
  name: string;
  /** Unit of measurement (e.g., "km", "kg", "bpm") */
  unit: string;
  /** Optional target value */
  target?: number;
}

/**
 * Attitude metadata and descriptions for UI
 */
export const ATTITUDE_METADATA: Record<
  Attitude,
  {
    label: string;
    description: string;
    shows: string;
    icon: string;
  }
> = {
  [Attitude.BEGINNING]: {
    label: "Beginning",
    description: "First encounters, exploration",
    shows: "Count of times allocated",
    icon: "◇",
  },
  [Attitude.KEEPING]: {
    label: "Keeping",
    description: "Sporadic engagement, maintaining connection",
    shows: "Days since last allocation",
    icon: "◌",
  },
  [Attitude.BUILDING]: {
    label: "Building",
    description: "Regular practice, developing capacity",
    shows: "Frequency patterns over time",
    icon: "△",
  },
  [Attitude.PUSHING]: {
    label: "Pushing",
    description: "Focused progression, specific goals",
    shows: "Custom performance metrics",
    icon: "↑",
  },
  [Attitude.BEING]: {
    label: "Being",
    description: "Integrated, automatic, part of identity",
    shows: "Moves to Crystallized Routines",
    icon: "◉",
  },
};

/**
 * Get human-readable label for an attitude
 */
export function getAttitudeLabel(attitude: Attitude): string {
  return ATTITUDE_METADATA[attitude].label;
}

/**
 * Get description for an attitude
 */
export function getAttitudeDescription(attitude: Attitude): string {
  return ATTITUDE_METADATA[attitude].description;
}

/**
 * Get what the system shows for an attitude
 */
export function getAttitudeShows(attitude: Attitude): string {
  return ATTITUDE_METADATA[attitude].shows;
}

/**
 * Get icon for an attitude
 */
export function getAttitudeIcon(attitude: Attitude): string {
  return ATTITUDE_METADATA[attitude].icon;
}
