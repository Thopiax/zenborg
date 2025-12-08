"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Habit } from "@/domain/entities/Habit";
import { getTextColorsForBackground } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

interface DraggableHabitItemProps {
  habit: Habit;
  areaColor: string;
  onEdit: () => void;
}

/**
 * DraggableHabitItem - Draggable habit that can be moved between areas or to cycles
 *
 * Features:
 * - Entire card is draggable (grab cursor indicates draggability)
 * - Can be dragged to different areas (changes areaId)
 * - Can be dragged to cycle deck (budgets to cycle)
 * - Click to edit
 */
export function DraggableHabitItem({
  habit,
  areaColor,
  onEdit,
}: DraggableHabitItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: habit.id,
    data: {
      habitId: habit.id,
      sourceAreaId: habit.areaId,
      type: "habit",
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: areaColor,
    "--tw-ring-color": `${areaColor}99`, // 60% opacity for ring
    cursor: isDragging ? "grabbing" : "grab",
  };

  // Get accessible text colors for area color
  const textColors = getTextColorsForBackground(areaColor);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center justify-between gap-2 px-3 py-2 rounded-md transition-all hover:ring-2 hover:ring-offset-2 ring-offset-transparent"
      {...attributes}
      {...listeners}
    >
      {/* Habit Content - Click to edit */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="flex-1 text-left"
      >
        <div
          className={cn(
            "flex items-center text-sm font-mono",
            textColors.primary
          )}
        >
          <span className={cn("mr-2", "text-lg")}>{habit.emoji}</span>
          <span
            className={cn(
              "text-lg font-semibold line-clamp-1 flex-shrink-0 flex-grow"
            )}
          >
            {habit.name}
          </span>
        </div>
        {/* Tags under habit name */}
        {habit.tags && habit.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {habit.tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "text-xs font-mono opacity-60",
                  textColors.primary
                )}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </button>
    </div>
  );
}
