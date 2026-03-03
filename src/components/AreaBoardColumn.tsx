"use client";

import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  maxHabitsHeight?: string;
}

export function AreaBoardColumn({
  area,
  habits,
  onUpdateArea,
  onArchiveArea,
  onEditHabit,
  onArchiveHabit,
  onCreateHabit,
  maxHabitsHeight = "calc(100vh - 16rem)",
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
          onCreateHabit={onCreateHabit}
        />
      </div>

      {/* Colored Divider */}
      <div
        className="h-[3px] mx-4 mb-2"
        style={{ backgroundColor: area.color }}
      />

      {/* Habits List (scrollable) */}
      <div
        className="flex flex-col gap-3 p-4 flex-1 overflow-y-auto"
        style={{ maxHeight: maxHabitsHeight }}
      >
        {habits.length === 0 ? (
          <button
            type="button"
            onClick={onCreateHabit}
            className="flex items-center justify-center gap-2 py-6 text-stone-400 dark:text-stone-500 hover:text-stone-500 dark:hover:text-stone-400 transition-colors cursor-pointer"
          >
            <span className="text-sm font-mono">Add first habit</span>
          </button>
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
    </div>
  );
}
