"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { use$ } from "@legendapp/state/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Habit } from "@/domain/entities/Habit";
import { Phase } from "@/domain/value-objects/Phase";
import { PhaseIcon } from "@/domain/value-objects/phaseStyles";
import { childHabitsByParent$ } from "@/infrastructure/state/store";
import { getTextColorsForBackground } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { DraggableHabitItem } from "./DraggableHabitItem";

interface PlanHabitsListProps {
  habits: Habit[];
  areaId: string;
  areaColor: string;
  onEditHabit: (habitId: string) => void;
  onArchiveHabit: (habitId: string) => void;
}

function VariantItem({
  habit,
  areaColor,
  onEdit,
}: {
  habit: Habit;
  areaColor: string;
  onEdit: () => void;
}) {
  const textColors = getTextColorsForBackground(areaColor);
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex items-center gap-2 pl-9 pr-3 py-2 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-left w-full"
      style={{ backgroundColor: `${areaColor}88` }}
    >
      <span className="text-sm flex-shrink-0">{habit.emoji}</span>
      <span className={cn("text-sm font-mono font-medium truncate flex-1 min-w-0", textColors.primary)}>
        {habit.name}
      </span>
      {habit.phase && (
        <PhaseIcon
          phase={habit.phase as Phase}
          className={cn("w-3 h-3 flex-shrink-0", textColors.secondary)}
        />
      )}
    </button>
  );
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
  const textColors = getTextColorsForBackground(areaColor);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-0">
        {hasChildren && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className={cn("flex-shrink-0 p-1 rounded transition-colors", textColors.secondary)}
            aria-label={expanded ? "Collapse variants" : "Expand variants"}
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
        <div className={cn("flex-1 min-w-0", !hasChildren && "ml-6")}>
          <DraggableHabitItem
            habit={habit}
            areaColor={areaColor}
            onEdit={() => onEditHabit(habit.id)}
            onArchive={() => onArchiveHabit(habit.id)}
          />
        </div>
      </div>
      {expanded &&
        childHabits.map((child) => (
          <VariantItem
            key={child.id}
            habit={child}
            areaColor={areaColor}
            onEdit={() => onEditHabit(child.id)}
          />
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
