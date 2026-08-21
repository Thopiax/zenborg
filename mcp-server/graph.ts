import type { Area, Habit, Moment } from "./vault.js";

/**
 * Habit relationships — derived edges, no stored graph.
 *
 * Three edge types fall out of existing data at read time:
 *   shared tags       — habits whose tag signatures overlap (a habit's
 *                       signature = its own tags ∪ the tags of its moments,
 *                       so person-/place- mediation shows up here)
 *   co-occurrence     — habits allocated on the same days
 *   area siblings     — active habits sharing the plot
 *
 * Typed, intentional edges ("enables", "pairs with") would be a vault shape
 * change — this derived layer is the experiment that shows which relations
 * are worth storing.
 */

export interface RelatedHabits {
  habit: string;
  sharedTags: { habit: string; tags: string[] }[];
  coOccurrence: { habit: string; days: number; shareOfMine: number }[];
  areaSiblings: string[];
  coOccurrenceTruncated: boolean;
}

const CO_OCCURRENCE_CAP = 10;

function tagSignature(habit: Habit, moments: Moment[]): Set<string> {
  const signature = new Set(habit.tags);
  for (const m of moments) {
    if (m.habitId !== habit.id) continue;
    for (const t of m.tags ?? []) signature.add(t);
  }
  return signature;
}

function allocatedDays(habitId: string, moments: Moment[]): Set<string> {
  const days = new Set<string>();
  for (const m of moments) {
    if (m.habitId === habitId && m.day !== null) days.add(m.day);
  }
  return days;
}

export function buildRelatedHabits(
  habitId: string,
  habits: Habit[],
  moments: Moment[],
  areas: Area[],
): RelatedHabits | null {
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return null;
  const others = habits.filter((h) => h.id !== habitId);

  const mySignature = tagSignature(habit, moments);
  const sharedTags = others
    .map((h) => ({
      habit: h.name,
      tags: Array.from(tagSignature(h, moments)).filter((t) =>
        mySignature.has(t),
      ),
    }))
    .filter((e) => e.tags.length > 0)
    .sort(
      (a, b) => b.tags.length - a.tags.length || a.habit.localeCompare(b.habit),
    );

  const myDays = allocatedDays(habitId, moments);
  const coAll = others
    .map((h) => {
      const days = allocatedDays(h.id, moments);
      let co = 0;
      for (const d of myDays) if (days.has(d)) co += 1;
      return {
        habit: h.name,
        days: co,
        shareOfMine:
          myDays.size === 0 ? 0 : Math.round((co / myDays.size) * 100) / 100,
      };
    })
    .filter((e) => e.days > 0)
    .sort((a, b) => b.days - a.days || a.habit.localeCompare(b.habit));

  const areaName = areas.find((a) => a.id === habit.areaId)?.name;
  const areaSiblings = others
    .filter((h) => h.areaId === habit.areaId && !h.isArchived)
    .map((h) => h.name)
    .sort();

  return {
    habit: areaName ? `${habit.name} (${areaName})` : habit.name,
    sharedTags,
    coOccurrence: coAll.slice(0, CO_OCCURRENCE_CAP),
    areaSiblings,
    coOccurrenceTruncated: coAll.length > CO_OCCURRENCE_CAP,
  };
}
