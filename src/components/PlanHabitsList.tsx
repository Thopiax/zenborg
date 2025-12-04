"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
  areaId,
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
      <div className="space-y-2">
        {sortedHabits.map((habit) => (
          <DraggableHabitItem
            key={habit.id}
            habit={habit}
            areaColor={areaColor}
            onEdit={() => onEditHabit(habit.id)}
          />
        ))}
      </div>
    </SortableContext>
  );
}
