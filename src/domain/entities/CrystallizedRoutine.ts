/**
 * CrystallizedRoutine - A moment that has graduated to automatic practice
 *
 * When a moment reaches "being" attitude, it moves off the timeline
 * into this section. These are practices that happen automatically
 * and no longer need conscious allocation.
 *
 * Examples: Morning routine, vitamins, journaling
 */

export interface CrystallizedRoutine {
  readonly id: string;
  name: string;
  areaId: string;
  description?: string;
  tags: string[];
  /** Optional reference to the moment it was migrated from */
  migratedFrom?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Creates a new crystallized routine
 */
export function createCrystallizedRoutine(
  name: string,
  areaId: string,
  tags: string[] = [],
  description?: string,
  migratedFrom?: string
): CrystallizedRoutine {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    areaId: areaId.trim(),
    description: description?.trim(),
    tags,
    migratedFrom,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Updates a crystallized routine
 */
export function updateCrystallizedRoutine(
  routine: CrystallizedRoutine,
  updates: Partial<Pick<CrystallizedRoutine, "name" | "areaId" | "description" | "tags">>
): CrystallizedRoutine {
  return {
    ...routine,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}
