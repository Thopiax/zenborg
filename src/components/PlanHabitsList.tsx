"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Habit } from "@/domain/entities/Habit";
import { DraggableHabitItem } from "./DraggableHabitItem";

interface PlanHabitsListProps {
  habits: Habit[];
  areaId: string;
  areaColor: string;
  onEditHabit: (habitId: string) => void;
  onArchiveHabit: (habitId: string) => void;
}

/**
 * PlanHabitsList - List of draggable habits within an area
 *
 * Features:
 * - Habits can be dragged to different areas (changes areaId)
 * - Habits can be dragged to cycle deck (budgets to cycle)
 * - Drag logic handled by parent DndContext
 */
export function PlanHabitsList({
  habits,
  areaColor,
  onEditHabit,
  onArchiveHabit,
}: PlanHabitsListProps) {
  // Sort habits by order property (ascending)
  const sortedHabits = [...habits].sort((a, b) => a.order - b.order);

  // Empty state
  if (sortedHabits.length === 0) {
    return null;
  }

  return (
    <SortableContext
      items={sortedHabits.map((h) => h.id)}
      strategy={verticalListSortingStrategy}
    >
      <div className="flex-1 space-y-2 rounded-md p-2 bg-stone-100/60 dark:bg-stone-800/40 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]">
        {sortedHabits.map((habit) => (
          <DraggableHabitItem
            key={habit.id}
            habit={habit}
            areaColor={areaColor}
            onEdit={() => onEditHabit(habit.id)}
            onArchive={() => onArchiveHabit(habit.id)}
          />
        ))}
      </div>
    </SortableContext>
  );
}
