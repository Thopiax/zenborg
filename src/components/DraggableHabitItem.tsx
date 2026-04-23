"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive } from "lucide-react";
import type { Habit } from "@/domain/entities/Habit";
import { getTextColorsForBackground } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

interface DraggableHabitItemProps {
  habit: Habit;
  areaColor?: string;
  onEdit: () => void;
  onArchive?: () => void;
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
  onArchive,
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
      className="group flex items-center justify-between gap-2 px-3 py-3 rounded-md transition-all hover:ring-2 hover:ring-offset-2 ring-offset-transparent"
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
        className="flex-1 text-left min-w-0"
      >
        <div
          className={cn(
            "flex items-center text-sm font-mono gap-2",
            textColors.primary,
          )}
        >
          <span className="text-lg flex-shrink-0">{habit.emoji}</span>
          <span className="text-lg font-semibold truncate">
            {habit.name}
          </span>
          {/* Tags inline after name */}
          {habit.tags && habit.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
              {habit.tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "text-xs font-mono opacity-50",
                    textColors.primary,
                  )}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>

      {/* Archive — hover-revealed, quiet */}
      {onArchive && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          className={cn(
            "flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity",
            textColors.primary,
          )}
          aria-label="Archive habit"
          title="Archive"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
