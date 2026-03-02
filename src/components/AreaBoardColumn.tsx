"use client";

import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { AreaColumnHeader } from "@/components/AreaColumnHeader";
import { PlanHabitsList } from "@/components/PlanHabitsList";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import { columnWidth } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

interface AreaBoardColumnProps {
  area: Area;
  habits: Habit[];
  onUpdateArea: (areaId: string, updates: Partial<Area>) => void;
  onArchiveArea: (areaId: string) => void;
  onEditHabit: (habitId: string) => void;
  onArchiveHabit: (habitId: string) => void;
  onCreateHabit: () => void;
}

export function AreaBoardColumn({
  area,
  habits,
  onUpdateArea,
  onArchiveArea,
  onEditHabit,
  onArchiveHabit,
  onCreateHabit,
}: AreaBoardColumnProps) {
  // Sortable for area reordering (the column itself is draggable)
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: area.id,
    data: {
      type: "area",
      areaId: area.id,
    },
  });

  // Droppable for receiving habits from other areas
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `area-${area.id}`,
    data: {
      targetType: "area",
      targetAreaId: area.id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={(node) => {
        setSortableRef(node);
        setDroppableRef(node);
      }}
      style={style}
      className={cn(
        "flex flex-col snap-start rounded-lg",
        columnWidth.scrollableClassName,
        isOver && "ring-2 ring-stone-400 dark:ring-stone-500 bg-stone-50 dark:bg-stone-800/50",
      )}
    >
      {/* Draggable Header (drag handle for area reorder) */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <AreaColumnHeader
          area={area}
          habitCount={habits.length}
          onUpdateArea={onUpdateArea}
          onArchiveArea={onArchiveArea}
        />
      </div>

      {/* Colored Divider */}
      <div
        className="h-[3px] mx-4 mb-2"
        style={{ backgroundColor: area.color }}
      />

      {/* Habits List */}
      <div className="flex flex-col gap-3 p-4 min-h-[300px] flex-1">
        {habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[240px] gap-3 py-8">
            <div className="text-4xl opacity-20">{area.emoji}</div>
            <div className="text-center space-y-1">
              <p className="text-sm text-stone-500 dark:text-stone-400 font-mono">
                No habits yet
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500">
                Click below to add one
              </p>
            </div>
          </div>
        ) : (
          <PlanHabitsList
            habits={habits}
            areaId={area.id}
            areaColor={area.color}
            onEditHabit={onEditHabit}
            onArchiveHabit={onArchiveHabit}
          />
        )}
      </div>

      {/* Add Habit Button */}
      <div className="px-4 pb-4 pt-2">
        <button
          type="button"
          onClick={onCreateHabit}
          className={cn(
            "w-full px-4 py-2.5 rounded-md",
            "flex items-center justify-center gap-2",
            "text-sm font-mono font-medium",
            "bg-white dark:bg-stone-900",
            "border-2 border-stone-300 dark:border-stone-600",
            "hover:border-stone-400 dark:hover:border-stone-500",
            "hover:shadow-sm",
            "text-stone-700 dark:text-stone-300",
            "transition-all duration-150",
          )}
          style={{ borderColor: `${area.color}40` }}
        >
          <Plus className="w-4 h-4" />
          <span>Add habit</span>
        </button>
      </div>
    </div>
  );
}
