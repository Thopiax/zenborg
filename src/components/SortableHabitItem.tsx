"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Habit } from "@/domain/entities/Habit";
import { getTextColorsForBackground } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

interface SortableHabitItemProps {
  habit: Habit;
  areaColor: string;
  onEdit: () => void;
}

/**
 * SortableHabitItem - Draggable wrapper for habit rows
 *
 * Features:
 * - Drag handle (grip dots) on left side - always visible
 * - Smooth transform/transition animations
 * - Click to edit
 */
export function SortableHabitItem({
  habit,
  areaColor,
  onEdit,
}: SortableHabitItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: areaColor,
    "--tw-ring-color": `${areaColor}99`, // 60% opacity for ring
  };

  // Get accessible text colors for area color
  const textColors = getTextColorsForBackground(areaColor);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center justify-between gap-2 px-3 py-2 rounded-md transition-all hover:ring-2 hover:ring-offset-2 ring-offset-transparent"
    >
      {/* Drag Handle - Left side */}
      <button
        type="button"
        className="p-1 cursor-grab active:cursor-grabbing transition-opacity flex-shrink-0"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder habit"
      >
        <GripVertical
          className={cn("w-4 h-4", textColors.secondary)}
          style={{ opacity: 0.6 }}
        />
      </button>

      {/* Habit Content - Click to edit */}
      <button
        type="button"
        onClick={onEdit}
        className="flex-1 text-left"
      >
        <div className={cn("flex items-center text-sm font-mono", textColors.primary)}>
          <span className={cn("mr-2", "text-lg")}>{habit.emoji}</span>
          <span className={cn("text-lg font-semibold line-clamp-1 flex-shrink-0")}>
            {habit.name}
          </span>
        </div>
        {/* Tags under habit name */}
        {habit.tags && habit.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {habit.tags.map((tag) => (
              <span
                key={tag}
                className={cn("text-xs font-mono opacity-60", textColors.primary)}
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
