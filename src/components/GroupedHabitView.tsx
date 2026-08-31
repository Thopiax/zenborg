"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { observer, use$ } from "@legendapp/state/react";
import { Archive, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Habit } from "@/domain/entities/Habit";
import type { Area } from "@/domain/entities/Area";
import {
  Attitude,
  ATTITUDE_METADATA,
} from "@/domain/value-objects/Attitude";
import { Phase } from "@/domain/value-objects/Phase";
import { PHASE_STYLES, PhaseIcon } from "@/domain/value-objects/phaseStyles";
import { HabitService } from "@/application/services/HabitService";
import {
  activeAreas$,
  activeHabits$,
  childHabitsByParent$,
} from "@/infrastructure/state/store";
import {
  closeHabitForm,
  habitFormState$,
  openHabitFormEdit,
  type HabitGroupBy,
} from "@/infrastructure/state/ui-store";
import { HabitFormDialog } from "@/components/HabitFormDialog";
import { TagSummary } from "@/components/TagSummary";
import { columnWidth, getTextColorsForBackground } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

const ATTITUDE_ORDER = [
  Attitude.BEGINNING,
  Attitude.RETURNING,
  Attitude.KEEPING,
  Attitude.BUILDING,
  Attitude.PUSHING,
  Attitude.PRUNING,
  Attitude.BEING,
];

const PHASE_ORDER = [Phase.MORNING, Phase.AFTERNOON, Phase.EVENING, Phase.NIGHT];

const NONE_KEY = "__none__";

const NONE_LABELS: Record<HabitGroupBy, string> = {
  area: "No area",
  attitude: "No attitude",
  phase: "No phase",
  tag: "No tag",
};

function GroupColumnHeader({
  groupBy,
  groupKey,
  count,
}: {
  groupBy: HabitGroupBy;
  groupKey: string;
  count: number;
}) {
  if (groupBy === "phase" && groupKey !== NONE_KEY) {
    const phase = groupKey as Phase;
    return (
      <div className="px-4 py-3 flex items-center gap-2">
        <PhaseIcon phase={phase} className="w-3.5 h-3.5 flex-shrink-0 text-stone-500 dark:text-stone-400" />
        <span className="text-sm font-mono font-medium text-stone-700 dark:text-stone-300">
          {phase.charAt(0) + phase.slice(1).toLowerCase()}
        </span>
        <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
          {count}
        </span>
      </div>
    );
  }

  if (groupBy === "attitude" && groupKey !== NONE_KEY) {
    const meta = ATTITUDE_METADATA[groupKey as Attitude];
    return (
      <div className="px-4 py-3 flex items-center gap-2">
        <span className="text-sm text-stone-500 dark:text-stone-400">{meta?.icon}</span>
        <span className="text-sm font-mono font-medium text-stone-700 dark:text-stone-300">
          {meta?.label ?? groupKey}
        </span>
        <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
          {count}
        </span>
      </div>
    );
  }

  // Default: area, tag, or none
  let label: string;
  if (groupKey === NONE_KEY) {
    label = NONE_LABELS[groupBy];
  } else if (groupBy === "tag") {
    label = `#${groupKey}`;
  } else {
    label = groupKey;
  }

  return (
    <div className="px-4 py-3 flex items-center gap-2">
      <span className="text-sm font-mono font-medium text-stone-700 dark:text-stone-300">
        {label}
      </span>
      <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
        {count}
      </span>
    </div>
  );
}

function groupHabits(
  habits: Habit[],
  groupBy: HabitGroupBy,
  areas: Area[],
): { key: string; color?: string; habits: Habit[] }[] {
  const groups = new Map<string, { color?: string; habits: Habit[] }>();

  for (const habit of habits) {
    let key: string;
    let color: string | undefined;

    switch (groupBy) {
      case "area": {
        const area = areas.find((a) => a.id === habit.areaId);
        key = habit.areaId;
        color = area?.color;
        break;
      }
      case "attitude":
        key = habit.attitude ?? NONE_KEY;
        break;
      case "phase":
        key = habit.phase ?? NONE_KEY;
        break;
      case "tag":
        key = habit.tags[0] ?? NONE_KEY;
        break;
    }

    if (!groups.has(key)) {
      groups.set(key, { color, habits: [] });
    }
    groups.get(key)!.habits.push(habit);
  }

  const entries = [...groups.entries()];
  entries.sort(([a], [b]) => {
    if (groupBy === "attitude") {
      const ai = ATTITUDE_ORDER.indexOf(a as Attitude);
      const bi = ATTITUDE_ORDER.indexOf(b as Attitude);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
    }
    if (groupBy === "phase") {
      const ai = PHASE_ORDER.indexOf(a as Phase);
      const bi = PHASE_ORDER.indexOf(b as Phase);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
    }
    if (a === NONE_KEY) return 1;
    if (b === NONE_KEY) return -1;
    return a.localeCompare(b);
  });

  return entries.map(([key, group]) => ({ key, ...group }));
}

function DraggableHabitCard({
  habit,
  areaColor,
  groupKey,
  onEdit,
  onArchive,
}: {
  habit: Habit;
  areaColor?: string;
  groupKey: string;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: habit.id,
    data: { habitId: habit.id, sourceGroupKey: groupKey, type: "grouped-habit" },
  });

  const textColors = getTextColorsForBackground(areaColor);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: areaColor,
    "--tw-ring-color": `${areaColor}99`,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style as React.CSSProperties}
      className="group flex items-center justify-between gap-2 px-3 py-3 rounded-md transition-all hover:ring-2 hover:ring-offset-2 ring-offset-transparent"
      data-habit-name={habit.name}
      {...attributes}
      {...listeners}
    >
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
          <span
            data-habit-label
            className="text-lg font-semibold truncate flex-1 min-w-0"
          >
            {habit.name}
          </span>
          <TagSummary
            tags={habit.tags}
            className={cn("flex-shrink-0", textColors.primary)}
          />
        </div>
      </button>

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
    </div>
  );
}

function VariantCard({
  habit,
  areaColor,
  onEdit,
}: {
  habit: Habit;
  areaColor?: string;
  onEdit: () => void;
}) {
  const textColors = getTextColorsForBackground(areaColor);

  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex items-center gap-2 pl-9 pr-3 py-2 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-left w-full"
      style={{ backgroundColor: areaColor ? `${areaColor}88` : undefined }}
    >
      <span className="text-sm flex-shrink-0">{habit.emoji}</span>
      <span
        className={cn(
          "text-sm font-mono font-medium truncate flex-1 min-w-0",
          textColors.primary,
        )}
      >
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

function HabitStack({
  habit,
  children: childHabits,
  areaColor,
  groupKey,
  onEditHabit,
  onArchiveHabit,
}: {
  habit: Habit;
  children: Habit[];
  areaColor?: string;
  groupKey: string;
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
            className={cn(
              "flex-shrink-0 p-1 rounded transition-colors",
              textColors.secondary,
            )}
            aria-label={expanded ? "Collapse variants" : "Expand variants"}
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        <div className={cn("flex-1 min-w-0", !hasChildren && "ml-6")}>
          <DraggableHabitCard
            habit={habit}
            areaColor={areaColor}
            groupKey={groupKey}
            onEdit={() => onEditHabit(habit.id)}
            onArchive={() => onArchiveHabit(habit.id)}
          />
        </div>
      </div>

      {expanded &&
        childHabits.map((child) => (
          <VariantCard
            key={child.id}
            habit={child}
            areaColor={areaColor}
            onEdit={() => onEditHabit(child.id)}
          />
        ))}
    </div>
  );
}

function GroupColumn({
  groupKey,
  groupBy,
  color,
  habits,
  areas,
  childHabitsMap,
  onEditHabit,
  onArchiveHabit,
}: {
  groupKey: string;
  groupBy: HabitGroupBy;
  color?: string;
  habits: Habit[];
  areas: Area[];
  childHabitsMap: Record<string, Habit[]>;
  onEditHabit: (habitId: string) => void;
  onArchiveHabit: (habitId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${groupKey}`,
    data: { targetGroupKey: groupKey, type: "group-column" },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col snap-start rounded-lg",
        columnWidth.scrollableClassName,
        isOver && "ring-2 ring-stone-400 dark:ring-stone-500 bg-stone-50 dark:bg-stone-800/50",
      )}
    >
      <GroupColumnHeader groupBy={groupBy} groupKey={groupKey} count={habits.length} />

      <div
        className="h-[3px] mx-4"
        style={{ backgroundColor: color ?? "var(--color-stone-300)" }}
      />

      <SortableContext
        items={habits.map((h) => h.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className="flex flex-col gap-3 p-4 flex-1 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 16rem)" }}
        >
          {habits.length === 0 ? (
            <span className="text-sm font-mono text-stone-400 dark:text-stone-500 text-center py-6">
              No habits
            </span>
          ) : (
            habits.map((habit) => {
              const area = areas.find((a) => a.id === habit.areaId);
              return (
                <HabitStack
                  key={habit.id}
                  habit={habit}
                  children={childHabitsMap[habit.id] || []}
                  areaColor={area?.color}
                  groupKey={groupKey}
                  onEditHabit={onEditHabit}
                  onArchiveHabit={onArchiveHabit}
                />
              );
            })
          )}
        </div>
      </SortableContext>
    </div>
  );
}

const DND_ENABLED_GROUPS: HabitGroupBy[] = ["attitude", "phase", "area"];

function applyGroupChange(
  habitService: HabitService,
  habitId: string,
  groupBy: HabitGroupBy,
  targetGroupKey: string,
) {
  const value = targetGroupKey === NONE_KEY ? null : targetGroupKey;
  switch (groupBy) {
    case "attitude":
      habitService.updateHabit(habitId, { attitude: value as Attitude | null });
      break;
    case "phase":
      habitService.updateHabit(habitId, { phase: value as Phase | null });
      break;
    case "area":
      if (value) habitService.updateHabit(habitId, { areaId: value });
      break;
  }
}

export const GroupedHabitView = observer(
  ({
    groupBy,
    filter,
    showEmpty,
  }: {
    groupBy: HabitGroupBy;
    filter: string;
    showEmpty: boolean;
  }) => {
    const habitService = new HabitService();
    const allHabits = use$(activeHabits$);
    const allAreas = use$(activeAreas$);
    const childHabitsMap = use$(childHabitsByParent$);
    const [activeId, setActiveId] = useState<string | null>(null);

    const filtered = filter
      ? allHabits.filter((h) =>
          h.name.toLowerCase().includes(filter.toLowerCase()),
        )
      : allHabits;

    let groups = groupHabits(filtered, groupBy, allAreas);
    if (!showEmpty) {
      groups = groups.filter((g) => g.habits.length > 0);
    }

    const handleEditHabit = (habitId: string) => {
      // Check root habits first, then children
      let habit = allHabits.find((h) => h.id === habitId);
      if (!habit) {
        for (const children of Object.values(childHabitsMap)) {
          habit = children.find((h) => h.id === habitId);
          if (habit) break;
        }
      }
      if (habit) openHabitFormEdit(habitId, habit);
    };

    const handleArchiveHabit = (habitId: string) => {
      habitService.archiveHabit(habitId);
    };

    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
      useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
      useSensor(KeyboardSensor),
    );

    const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const dragData = active.data.current as {
        habitId?: string;
        sourceGroupKey?: string;
        type?: string;
      };
      const overData = over.data.current as {
        targetGroupKey?: string;
        sourceGroupKey?: string;
        type?: string;
      };

      if (dragData?.type !== "grouped-habit") return;
      if (!DND_ENABLED_GROUPS.includes(groupBy)) return;

      const targetGroupKey =
        overData?.targetGroupKey ?? overData?.sourceGroupKey;
      if (!targetGroupKey || !dragData.habitId) return;
      if (targetGroupKey === dragData.sourceGroupKey) return;

      applyGroupChange(habitService, dragData.habitId, groupBy, targetGroupKey);
    };

    const activeHabit = activeId
      ? allHabits.find((h) => h.id === activeId)
      : null;
    const activeArea = activeHabit
      ? allAreas.find((a) => a.id === activeHabit.areaId)
      : null;

    return (
      <>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto px-4 py-4 h-full snap-x snap-mandatory scroll-smooth">
            {groups.map((g) => (
              <GroupColumn
                key={g.key}
                groupKey={g.key}
                groupBy={groupBy}
                color={g.color}
                habits={g.habits}
                areas={allAreas}
                childHabitsMap={childHabitsMap}
                onEditHabit={handleEditHabit}
                onArchiveHabit={handleArchiveHabit}
              />
            ))}
          </div>

          <DragOverlay>
            {activeHabit ? (
              <div
                className="flex items-center gap-2 px-3 py-3 rounded-md border border-stone-300 dark:border-stone-600 opacity-90"
                style={{ backgroundColor: activeArea?.color, width: "22.5rem" }}
              >
                <span className="text-lg">{activeHabit.emoji}</span>
                <span className="text-lg font-mono font-semibold text-white truncate">
                  {activeHabit.name}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <HabitFormDialog
          onSave={(props) => {
            const formState = habitFormState$.peek();
            if (formState.mode === "edit" && formState.editingHabitId) {
              habitService.updateHabit(formState.editingHabitId, props);
            }
          }}
          onDelete={() => {
            const formState = habitFormState$.peek();
            if (formState.editingHabitId) {
              habitService.archiveHabit(formState.editingHabitId);
              closeHabitForm();
            }
          }}
        />
      </>
    );
  },
);
