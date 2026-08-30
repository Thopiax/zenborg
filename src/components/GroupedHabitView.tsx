"use client";

import { observer, use$ } from "@legendapp/state/react";
import type { Habit } from "@/domain/entities/Habit";
import type { Area } from "@/domain/entities/Area";
import { Attitude } from "@/domain/value-objects/Attitude";
import { Phase } from "@/domain/value-objects/Phase";
import {
  activeAreas$,
  activeHabits$,
} from "@/infrastructure/state/store";
import type { HabitGroupBy } from "@/infrastructure/state/ui-store";
import { columnWidth } from "@/lib/design-tokens";
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

function groupHabits(
  habits: Habit[],
  groupBy: HabitGroupBy,
  areas: Area[],
): { key: string; label: string; color?: string; habits: Habit[] }[] {
  const groups = new Map<string, { label: string; color?: string; habits: Habit[] }>();

  for (const habit of habits) {
    let key: string;
    let label: string;
    let color: string | undefined;

    switch (groupBy) {
      case "area": {
        const area = areas.find((a) => a.id === habit.areaId);
        key = habit.areaId;
        label = area?.name ?? "Unknown";
        color = area?.color;
        break;
      }
      case "attitude":
        key = habit.attitude ?? NONE_KEY;
        label = habit.attitude ?? NONE_LABELS.attitude;
        break;
      case "phase":
        key = habit.phase ?? NONE_KEY;
        label = habit.phase ?? NONE_LABELS.phase;
        break;
      case "tag": {
        const tag = habit.tags[0];
        key = tag ?? NONE_KEY;
        label = tag ?? NONE_LABELS.tag;
        break;
      }
    }

    if (!groups.has(key)) {
      groups.set(key, { label, color, habits: [] });
    }
    groups.get(key)!.habits.push(habit);
  }

  // Sort groups by a sensible order
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

function HabitCard({ habit, area }: { habit: Habit; area?: Area }) {
  return (
    <div
      className="group flex items-center gap-2 px-3 py-3 rounded-md transition-colors"
      style={{ backgroundColor: area?.color }}
    >
      <span className="text-lg flex-shrink-0">{habit.emoji}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-mono font-semibold truncate block text-stone-800 dark:text-stone-200">
          {habit.name}
        </span>
        {area && (
          <span className="text-xs font-mono text-stone-500 dark:text-stone-400 truncate block">
            {area.emoji} {area.name}
          </span>
        )}
      </div>
    </div>
  );
}

function GroupColumn({
  label,
  color,
  habits,
  areas,
  showArea,
}: {
  label: string;
  color?: string;
  habits: Habit[];
  areas: Area[];
  showArea: boolean;
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
            const area = showArea
              ? areas.find((a) => a.id === habit.areaId)
              : undefined;
            return <HabitCard key={habit.id} habit={habit} area={area} />;
          })
        )}
      </div>
    </div>
  );
}

export const GroupedHabitView = observer(
  ({ groupBy, filter }: { groupBy: HabitGroupBy; filter: string }) => {
    const allHabits = use$(activeHabits$);
    const allAreas = use$(activeAreas$);

    const filtered = filter
      ? allHabits.filter((h) =>
          h.name.toLowerCase().includes(filter.toLowerCase()),
        )
      : allHabits;

    const groups = groupHabits(filtered, groupBy, allAreas);
    const showArea = groupBy !== "area";

    return (
      <div className="flex gap-4 overflow-x-auto px-4 py-4 h-full snap-x snap-mandatory scroll-smooth">
        {groups.map((g) => (
          <GroupColumn
            key={g.key}
            label={g.label}
            color={g.color}
            habits={g.habits}
            areas={allAreas}
            showArea={showArea}
          />
        ))}
      </div>
    );
  },
);
