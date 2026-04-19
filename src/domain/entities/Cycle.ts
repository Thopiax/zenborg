/**
 * Cycle - Time container for moments
 *
 * Cycles represent named periods (e.g., "Barcelona Summer", "Q1 2025")
 * Only one cycle can be active at a time (enforced at application level)
 */
export interface Cycle {
  readonly id: string;
  name: string;
  startDate: string; // ISO date: "2025-01-15"
  endDate: string | null; // null for ongoing cycles
  intention: string | null; // Why this chapter — set at creation, editable later
  reflection: string | null; // Populated in harvest when the cycle closes
  createdAt: string;
  updatedAt: string;
}

/**
 * Props for creating a new cycle
 */
export interface CreateCycleProps {
  name: string;
  startDate: string;
  endDate?: string | null;
  intention?: string | null;
}

/**
 * Props for updating an existing cycle
 */
export interface UpdateCycleProps {
  name?: string;
  startDate?: string;
  endDate?: string | null;
  intention?: string | null;
  reflection?: string | null;
}

/**
 * Result type for operations that may fail
 */
export type CycleResult = Cycle | { error: string };

/**
 * Creates a new cycle
 *
 * @param props - Cycle creation properties
 * @returns New cycle or error
 */
export function createCycle(props: CreateCycleProps): CycleResult {
  const trimmedName = props.name.trim();

  if (!trimmedName) {
    return { error: "Cycle name cannot be empty" };
  }

  if (!props.startDate) {
    return { error: "Cycle must have a start date" };
  }

  // Validate ISO date format
  const startDateObj = new Date(props.startDate);
  if (Number.isNaN(startDateObj.getTime())) {
    return { error: "Start date must be a valid ISO date string" };
  }

  const endDate = props.endDate ?? null;

  if (endDate !== null) {
    const endDateObj = new Date(endDate);
    if (Number.isNaN(endDateObj.getTime())) {
      return { error: "End date must be a valid ISO date string" };
    }

    // Ensure end date is after start date
    if (endDateObj <= startDateObj) {
      return { error: "End date must be after start date" };
    }
  }

  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: trimmedName,
    startDate: props.startDate,
    endDate,
    intention: props.intention ?? null,
    reflection: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Updates a cycle's properties
 *
 * @param cycle - Cycle to update
 * @param props - Update properties
 * @returns Updated cycle or error
 */
export function updateCycle(cycle: Cycle, props: UpdateCycleProps): CycleResult {
  if (props.name !== undefined) {
    const trimmedName = props.name.trim();
    if (!trimmedName) {
      return { error: "Cycle name cannot be empty" };
    }
  }

  const newStartDate = props.startDate ?? cycle.startDate;
  const newEndDate =
    props.endDate !== undefined ? props.endDate : cycle.endDate;

  // Validate start date
  const startDateObj = new Date(newStartDate);
  if (Number.isNaN(startDateObj.getTime())) {
    return { error: "Start date must be a valid ISO date string" };
  }

  // Validate end date if provided
  if (newEndDate !== null) {
    const endDateObj = new Date(newEndDate);
    if (Number.isNaN(endDateObj.getTime())) {
      return { error: "End date must be a valid ISO date string" };
    }

    if (endDateObj <= startDateObj) {
      return { error: "End date must be after start date" };
    }
  }

  return {
    ...cycle,
    ...props,
    name: props.name ? props.name.trim() : cycle.name,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Completes a cycle by setting its end date to today
 *
 * @param cycle - Cycle to complete
 * @returns Updated cycle
 */
export function completeCycle(cycle: Cycle): Cycle {
  const today = new Date().toISOString().split("T")[0];

  return {
    ...cycle,
    endDate: today,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Checks if a date falls within a cycle's time range
 *
 * @param cycle - Cycle to check
 * @param date - ISO date string to check
 * @returns True if date is within cycle range
 */
export function isDateInCycle(cycle: Cycle, date: string): boolean {
  const dateObj = new Date(date);
  const startObj = new Date(cycle.startDate);

  if (dateObj < startObj) {
    return false;
  }

  if (cycle.endDate === null) {
    return true; // Ongoing cycle
  }

  const endObj = new Date(cycle.endDate);
  return dateObj <= endObj;
}

/**
 * Type guard to check if result is an error
 */
export function isCycleError(result: CycleResult): result is { error: string } {
  return "error" in result;
}

// ============================================================================
// Cycle Helpers
// ============================================================================

/**
 * Calculates the total bandwidth (available moment slots) for a cycle
 * Bandwidth = days × 3 phases × moments per day
 *
 * @param cycle - The cycle to calculate bandwidth for
 * @param momentsPerDay - User preference for moments per day (1-3)
 * @returns Total number of moment slots available
 */
export function calculateCycleBandwidth(
  cycle: Cycle,
  momentsPerDay: 1 | 2 | 3
): number {
  const startDate = new Date(cycle.startDate);
  const endDate = cycle.endDate ? new Date(cycle.endDate) : new Date();
  const days =
    Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
  return days * 3 * momentsPerDay; // 3 phases per day
}
