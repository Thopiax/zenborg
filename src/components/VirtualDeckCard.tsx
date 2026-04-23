"use client";

import { useDraggable } from "@dnd-kit/core";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import { useHabitHealth } from "@/hooks/useHabitHealth";
import { healthEmojiClass } from "@/lib/health-style";
import { cn } from "@/lib/utils";
import type { DraggableData } from "@/types/dnd";

interface VirtualDeckCardProps {
  cycleId: string;
  habit: Habit;
  area: Area;
  /** Unique index so multiple ghost slots for the same habit each have their own draggable id. */
  slotIndex: number;
}

/**
 * VirtualDeckCard — a draggable ghost slot rendered from a CyclePlan's budget.
 *
 * The card is never materialized until dropped on a timeline slot. The drag
 * payload carries `{ type: "deck-card", cycleId, habitId }` — the drop target
 * in the timeline calls `CycleService.allocateFromPlan(...)` to create a
 * concrete Moment. Until then, this card exists only in the derived view.
 */
export function VirtualDeckCard({
  cycleId,
  habit,
  area,
  slotIndex,
}: VirtualDeckCardProps) {
  const health = useHabitHealth(habit.id);

  const dragData: DraggableData = {
    type: "deck-card",
    cycleId,
    habitId: habit.id,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `deck-card-${cycleId}-${habit.id}-${slotIndex}`,
    data: dragData,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid="deck-card"
      data-habit-id={habit.id}
      data-cycle-id={cycleId}
      data-draggable="true"
      className={cn(
        "rounded-lg w-full min-h-[64px] flex items-center gap-2 px-3 py-2",
        "border-2 border-dashed transition-opacity cursor-grab",
        isDragging && "opacity-50 cursor-grabbing",
      )}
      style={{
        borderColor: area.color,
      }}
    >
      {habit.emoji && (
        <span className={cn("text-lg", healthEmojiClass(health))}>
          {habit.emoji}
        </span>
      )}
      <span className="text-sm font-mono font-medium text-stone-700 dark:text-stone-200 truncate">
        {habit.name}
      </span>
    </div>
  );
}
