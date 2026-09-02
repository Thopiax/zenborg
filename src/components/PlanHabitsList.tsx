"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { use$ } from "@legendapp/state/react";
import { X } from "lucide-react";
import { useState } from "react";
import type { Habit } from "@zenborg/core/domain/entities/Habit";
import { childHabitsByParent$ } from "@/infrastructure/state/store";
import { getTextColorsForBackground } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { DraggableHabitItem } from "./DraggableHabitItem";
import { TagSummary } from "./TagSummary";

interface PlanHabitsListProps {
  habits: Habit[];
  areaId: string;
  areaColor: string;
  onEditHabit: (habitId: string) => void;
  onArchiveHabit: (habitId: string) => void;
}

function HabitItemStack({
  habit,
  children: childHabits,
  areaColor,
  onEditHabit,
  onArchiveHabit,
}: {
  habit: Habit;
  children: Habit[];
  areaColor: string;
  onEditHabit: (habitId: string) => void;
  onArchiveHabit: (habitId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = childHabits.length > 0;
  const layerCount = Math.min(childHabits.length, 2);
  const textColors = getTextColorsForBackground(areaColor);

  return (
    <div className="flex flex-col">
      {hasChildren && !expanded && (
        <>
          {layerCount >= 2 && (
            <div
              className="rounded-md mx-auto pointer-events-none"
              style={{
                width: "94%",
                height: "6px",
                backgroundColor: areaColor,
                opacity: 0.3,
                marginBottom: "-3px",
              }}
            />
          )}
          <div
            className="rounded-md mx-auto pointer-events-none"
            style={{
              width: "97%",
              height: "6px",
              backgroundColor: areaColor,
              opacity: 0.4,
              marginBottom: "-3px",
            }}
          />
        </>
      )}

      <div className="relative" style={{ zIndex: 3 }}>
        <DraggableHabitItem
          habit={habit}
          areaColor={areaColor}
          onEdit={
            hasChildren && !expanded
              ? () => setExpanded(true)
              : () => onEditHabit(habit.id)
          }
          onArchive={() => onArchiveHabit(habit.id)}
        />

        {expanded && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 shadow-sm hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
            style={{ zIndex: 10 }}
            aria-label="Close variants"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {expanded &&
        childHabits.map((child) => (
          <button
            key={child.id}
            type="button"
            onClick={() => onEditHabit(child.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-3 rounded-md transition-all hover:ring-2 hover:ring-offset-2 ring-offset-transparent text-left w-full mt-1",
              "border-l-[3px] border-black/15 dark:border-white/15",
            )}
            style={{
              backgroundColor: areaColor,
              "--tw-ring-color": `${areaColor}99`,
            } as React.CSSProperties}
          >
            <span className={cn("text-lg flex-shrink-0", textColors.primary)}>
              {child.emoji}
            </span>
            <span
              className={cn(
                "text-lg font-semibold font-mono truncate flex-1 min-w-0",
                textColors.primary,
              )}
            >
              {child.name}
            </span>
            <TagSummary
              tags={child.tags}
              className={cn("flex-shrink-0", textColors.primary)}
            />
          </button>
        ))}
    </div>
  );
}

export function PlanHabitsList({
  habits,
  areaColor,
  onEditHabit,
  onArchiveHabit,
}: PlanHabitsListProps) {
  const childHabitsMap = use$(childHabitsByParent$);
  const sortedHabits = [...habits].sort((a, b) => a.order - b.order);

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
          <HabitItemStack
            key={habit.id}
            habit={habit}
            children={childHabitsMap[habit.id] || []}
            areaColor={areaColor}
            onEditHabit={onEditHabit}
            onArchiveHabit={onArchiveHabit}
          />
        ))}
      </div>
    </SortableContext>
  );
}
