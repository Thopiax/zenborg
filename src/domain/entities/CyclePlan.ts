/**
 * CyclePlan - Budget allocation linking a habit to a cycle
 *
 * Represents the planned allocation of a habit across a cycle period.
 * For example: "6 Running cards for November Focus cycle"
 *
 * Constraints:
 * - One CyclePlan per (cycleId, habitId) pair
 * - budgetedCount must be >= 0
 * - Deleting creates 0-count plan (soft delete pattern)
 */
export interface CyclePlan {
  readonly id: string;
  cycleId: string; // FK to Cycle
  habitId: string; // FK to Habit
  budgetedCount: number; // e.g., 6 for "6 Running cards"
  createdAt: string;
  updatedAt: string;
}

/**
 * Result type for operations that may fail
 */
export type CyclePlanResult = CyclePlan | { error: string };

/**
 * Parameters for creating a new cycle plan
 */
export interface CreateCyclePlanProps {
  cycleId: string;
  habitId: string;
  budgetedCount: number;
}

/**
 * Creates a new cycle plan
 *
 * @param props - Cycle plan creation parameters
 * @returns New cycle plan or error if validation fails
 */
export function createCyclePlan(
  props: CreateCyclePlanProps
): CyclePlanResult {
  const { cycleId, habitId, budgetedCount } = props;

  if (!cycleId || !cycleId.trim()) {
    return { error: "Cycle ID cannot be empty" };
  }

  if (!habitId || !habitId.trim()) {
    return { error: "Habit ID cannot be empty" };
  }

  if (budgetedCount < 0) {
    return { error: "Budgeted count must be >= 0" };
  }

  if (!Number.isInteger(budgetedCount)) {
    return { error: "Budgeted count must be an integer" };
  }

  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    cycleId: cycleId.trim(),
    habitId: habitId.trim(),
    budgetedCount,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Parameters for updating a cycle plan's budget count
 */
export interface UpdateCyclePlanBudgetProps {
  budgetedCount: number;
}

/**
 * Updates the budgeted count for a cycle plan
 *
 * @param plan - The cycle plan to update
 * @param props - Update parameters
 * @returns Updated cycle plan or error if validation fails
 */
export function updateCyclePlanBudget(
  plan: CyclePlan,
  props: UpdateCyclePlanBudgetProps
): CyclePlanResult {
  const { budgetedCount } = props;

  if (budgetedCount < 0) {
    return { error: "Budgeted count must be >= 0" };
  }

  if (!Number.isInteger(budgetedCount)) {
    return { error: "Budgeted count must be an integer" };
  }

  return {
    ...plan,
    budgetedCount,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Type guard to check if result is an error
 */
export function isCyclePlanError(
  result: CyclePlanResult
): result is { error: string } {
  return "error" in result;
}
