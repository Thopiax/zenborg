"use client";

import { use$ } from "@legendapp/state/react";
import { habitHealthService } from "@/domain/services/HabitHealthService";
import {
  activeCycleId$,
  cyclePlans$,
  habits$,
  moments$,
} from "@/infrastructure/state/store";

/**
 * Returns true if any non-archived habit in the area is currently wilting.
 * Ambient signal only — callers must NOT display counts.
 */
export function useAreaHasWilting(areaId: string): boolean {
  const habitsRec = use$(habits$);
  const momentsRec = use$(moments$);
  const plansRec = use$(cyclePlans$);
  const activeCycleId = use$(activeCycleId$);

  const allMoments = Object.values(momentsRec);
  const allPlans = Object.values(plansRec);
  const now = new Date();

  for (const habit of Object.values(habitsRec)) {
    if (habit.isArchived) continue;
    if (habit.areaId !== areaId) continue;

    const plan = activeCycleId
      ? (allPlans.find(
          (p) => p.cycleId === activeCycleId && p.habitId === habit.id
        ) ?? null)
      : null;

    const health = habitHealthService.computeHealth(
      habit,
      plan,
      allMoments,
      now
    );
    if (health === "wilting") return true;
  }

  return false;
}
