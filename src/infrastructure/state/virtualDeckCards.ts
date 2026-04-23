import type { Area } from "@/domain/entities/Area";
import type { CyclePlan } from "@/domain/entities/CyclePlan";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";

export interface VirtualDeckCard {
  plan: CyclePlan;
  habit: Habit;
  ghosts: number;
}

export interface ComputeInput {
  cycleId: string;
  plans: CyclePlan[];
  habits: Habit[];
  areas: Area[];
  moments: Moment[];
}

export function computeVirtualDeckCards(
  input: ComputeInput,
): VirtualDeckCard[] {
  const { cycleId, plans, habits, areas, moments } = input;
  const habitById = new Map(habits.map((h) => [h.id, h]));
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const cards: VirtualDeckCard[] = [];
  for (const plan of plans) {
    if (plan.cycleId !== cycleId) continue;
    const habit = habitById.get(plan.habitId);
    if (!habit || habit.isArchived) continue;
    const allocated = moments.filter(
      (m) =>
        m.cyclePlanId === plan.id && m.day !== null && m.phase !== null,
    ).length;
    const ghosts = Math.max(0, plan.budgetedCount - allocated);
    cards.push({ plan, habit, ghosts });
  }

  cards.sort((a, b) => {
    const areaA =
      areaById.get(a.habit.areaId)?.order ?? Number.MAX_SAFE_INTEGER;
    const areaB =
      areaById.get(b.habit.areaId)?.order ?? Number.MAX_SAFE_INTEGER;
    if (areaA !== areaB) return areaA - areaB;
    return a.habit.order - b.habit.order;
  });

  return cards;
}
