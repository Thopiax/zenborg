"use client";

import { observer, use$ } from "@legendapp/state/react";
import { Archive } from "lucide-react";
import type { Habit } from "@/domain/entities/Habit";
import type { Area } from "@/domain/entities/Area";
import {
  Attitude,
  ATTITUDE_METADATA,
} from "@/domain/value-objects/Attitude";
import { Phase } from "@/domain/value-objects/Phase";
import { PHASE_STYLES } from "@/domain/value-objects/phaseStyles";
import { HabitService } from "@/application/services/HabitService";
import {
  activeAreas$,
  activeHabits$,
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

function attitudeLabel(key: string): string {
  if (key === NONE_KEY) return NONE_LABELS.attitude;
  const meta = ATTITUDE_METADATA[key as Attitude];
  return meta ? `${meta.icon} ${meta.label}` : key;
}

function phaseLabel(key: string): string {
  if (key === NONE_KEY) return NONE_LABELS.phase;
  const style = PHASE_STYLES[key as Phase];
  return style ? `${style.emoji} ${style.phase.charAt(0)}${style.phase.slice(1).toLowerCase()}` : key;
}

function groupLabel(groupBy: HabitGroupBy, key: string, areas: Area[]): string {
  switch (groupBy) {
    case "area": {
      if (key === NONE_KEY) return NONE_LABELS.area;
      const area = areas.find((a) => a.id === key);
      return area ? `${area.emoji} ${area.name}` : "Unknown";
    }
    case "attitude":
      return attitudeLabel(key);
    case "phase":
      return phaseLabel(key);
    case "tag":
      return key === NONE_KEY ? NONE_LABELS.tag : `#${key}`;
  }
}

function groupHabits(
  habits: Habit[],
  groupBy: HabitGroupBy,
  areas: Area[],
): { key: string; label: string; color?: string; habits: Habit[] }[] {
  const groups = new Map<string, { label: string; color?: string; habits: Habit[] }>();

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
      groups.set(key, { label: groupLabel(groupBy, key, areas), color, habits: [] });
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

function StaticHabitCard({
  habit,
  areaColor,
  onEdit,
  onArchive,
}: {
  habit: Habit;
  areaColor?: string;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const textColors = getTextColorsForBackground(areaColor);

  return (
    <div
      className="group flex items-center justify-between gap-2 px-3 py-3 rounded-md transition-all hover:ring-2 hover:ring-offset-2 ring-offset-transparent"
      style={{
        backgroundColor: areaColor,
        "--tw-ring-color": `${areaColor}99`,
      } as React.CSSProperties}
      data-habit-name={habit.name}
    >
      <button
        type="button"
        onClick={onEdit}
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

function GroupColumn({
  label,
  color,
  habits,
  areas,
  onEditHabit,
  onArchiveHabit,
}: {
  label: string;
  color?: string;
  habits: Habit[];
  areas: Area[];
  onEditHabit: (habitId: string) => void;
  onArchiveHabit: (habitId: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col snap-start rounded-lg",
        columnWidth.scrollableClassName,
      )}
    >
      <div className="px-4 py-3 flex items-center gap-2">
        <span className="text-sm font-mono font-medium text-stone-700 dark:text-stone-300">
          {label}
        </span>
        <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
          {habits.length}
        </span>
      </div>

      <div
        className="h-[3px] mx-4"
        style={{ backgroundColor: color ?? "var(--color-stone-300)" }}
      />

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
              <StaticHabitCard
                key={habit.id}
                habit={habit}
                areaColor={area?.color}
                onEdit={() => onEditHabit(habit.id)}
                onArchive={() => onArchiveHabit(habit.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
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
      const habit = allHabits.find((h) => h.id === habitId);
      if (habit) openHabitFormEdit(habitId, habit);
    };

    const handleArchiveHabit = (habitId: string) => {
      habitService.archiveHabit(habitId);
    };

    return (
      <>
        <div className="flex gap-4 overflow-x-auto px-4 py-4 h-full snap-x snap-mandatory scroll-smooth">
          {groups.map((g) => (
            <GroupColumn
              key={g.key}
              label={g.label}
              color={g.color}
              habits={g.habits}
              areas={allAreas}
              onEditHabit={handleEditHabit}
              onArchiveHabit={handleArchiveHabit}
            />
          ))}
        </div>

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
