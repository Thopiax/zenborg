"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Habit } from "@/domain/entities/Habit";
import { habits$ } from "@/infrastructure/state/store";
import { SortableHabitItem } from "./SortableHabitItem";

interface PlanHabitsListProps {
  habits: Habit[];
  areaId: string;
  areaColor: string;
  onEditHabit: (habitId: string) => void;
  onArchiveHabit: (habitId: string) => void;
}

/**
 * PlanHabitsList - Sortable list of habits within an area
 *
 * Features:
 * - Drag-and-drop reordering with @dnd-kit
 * - Touch support (150ms delay for mobile)
 * - Updates habit order in observable store
 * - Scoped to single area (habits cannot drag between areas)
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

  // Configure sensors for drag interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4, // 4px drag threshold
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = sortedHabits.findIndex((h) => h.id === active.id);
    const newIndex = sortedHabits.findIndex((h) => h.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Reorder the array
    const reordered = arrayMove(sortedHabits, oldIndex, newIndex);

    // Update order property for all habits in this area
    for (const [index, habit] of reordered.entries()) {
      if (habit.order !== index) {
        habits$[habit.id].order.set(index);
        habits$[habit.id].updatedAt.set(new Date().toISOString());
      }
    }
  }

  // Empty state - no DndContext needed
  if (sortedHabits.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedHabits.map((h) => h.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {sortedHabits.map((habit) => (
            <SortableHabitItem
              key={habit.id}
              habit={habit}
              areaColor={areaColor}
              onEdit={() => onEditHabit(habit.id)}
              onArchive={() => onArchiveHabit(habit.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
