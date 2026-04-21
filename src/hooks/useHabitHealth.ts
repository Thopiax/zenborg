"use client";

import { use$ } from "@legendapp/state/react";
import { habitHealthService } from "@/domain/services/HabitHealthService";
import type { Health } from "@/domain/value-objects/Health";
import {
  activeCycle$,
  cyclePlans$,
  habits$,
  moments$,
} from "@/infrastructure/state/store";

/**
 * Returns the current computed health for a habit.
 * Recomputes whenever habits, moments, active cycle, or plans change.
 */
export function useHabitHealth(habitId: string): Health {
  const habit = use$(habits$[habitId]);
  const allMoments = use$(moments$);
  const allPlans = use$(cyclePlans$);
  const activeCycle = use$(activeCycle$);

  if (!habit) return "unstated";

  const plan = activeCycle
    ? (Object.values(allPlans).find(
        (p) => p.cycleId === activeCycle.id && p.habitId === habitId
      ) ?? null)
    : null;

  return habitHealthService.computeHealth(
    habit,
    plan,
    Object.values(allMoments),
    new Date()
  );
}
