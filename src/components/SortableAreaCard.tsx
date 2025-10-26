"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import { PlanAreaCard } from "./PlanAreaCard";

interface SortableAreaCardProps {
  area: Area;
  habits: Habit[];
  onEditHabit: (habitId: string) => void;
  onArchiveHabit: (habitId: string) => void;
  onUpdateArea: (areaId: string, updates: Partial<Area>) => void;
  onArchiveArea: (areaId: string) => void;
  onQuickCreateHabit: (name: string, areaId: string) => void;
}

/**
 * SortableAreaCard - Draggable wrapper for area cards on Plan page
 *
 * Features:
 * - Drag handle (grip dots) in top-right corner
 * - Smooth transform/transition animations
 * - Wraps existing PlanAreaCard with drag functionality
 */
export function SortableAreaCard({
  area,
  habits,
  onEditHabit,
  onArchiveHabit,
  onUpdateArea,
  onArchiveArea,
  onQuickCreateHabit,
}: SortableAreaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: area.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Drag Handle - Top-right corner */}
      <button
        type="button"
        className="absolute top-4 right-4 z-10 opacity-0 hover:opacity-100 p-1.5 cursor-grab active:cursor-grabbing transition-opacity bg-white dark:bg-stone-900 rounded shadow-sm"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder area"
      >
        <GripVertical className="w-5 h-5 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300" />
      </button>

      {/* Area Card */}
      <PlanAreaCard
        area={area}
        habits={habits}
        onEditHabit={onEditHabit}
        onArchiveHabit={onArchiveHabit}
        onUpdateArea={onUpdateArea}
        onArchiveArea={onArchiveArea}
        onQuickCreateHabit={onQuickCreateHabit}
      />
    </div>
  );
}
