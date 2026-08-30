"use client";

import { observer, use$ } from "@legendapp/state/react";
import { Search } from "lucide-react";
import {
  type HabitGroupBy,
  type PeopleGroupBy,
  type PlantEntity,
  type PlantGroupBy,
  plantViewConfig$,
  setPlantEntity,
  setPlantFilter,
  setPlantGroupBy,
} from "@/infrastructure/state/ui-store";
import { cn } from "@/lib/utils";

const ENTITIES: { value: PlantEntity; label: string }[] = [
  { value: "habits", label: "Habits" },
  { value: "people", label: "People" },
];

const HABIT_GROUPS: { value: HabitGroupBy; label: string }[] = [
  { value: "area", label: "Area" },
  { value: "attitude", label: "Attitude" },
  { value: "phase", label: "Phase" },
  { value: "tag", label: "Tag" },
];

const PEOPLE_GROUPS: { value: PeopleGroupBy; label: string }[] = [
  { value: "category", label: "Category" },
  { value: "basePlace", label: "Place" },
  { value: "status", label: "Status" },
];

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-sm text-xs font-mono transition-colors",
        active
          ? "bg-stone-800 dark:bg-stone-200 text-stone-100 dark:text-stone-800"
          : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800",
      )}
    >
      {children}
    </button>
  );
}

export const PlantToolbar = observer(() => {
  const config = use$(plantViewConfig$);
  const groups: { value: PlantGroupBy; label: string }[] =
    config.entity === "habits" ? HABIT_GROUPS : PEOPLE_GROUPS;

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-stone-200 dark:border-stone-800">
      {/* Entity switcher */}
      <div className="flex items-center gap-0.5">
        {ENTITIES.map((e) => (
          <ChipButton
            key={e.value}
            active={config.entity === e.value}
            onClick={() => setPlantEntity(e.value)}
          >
            {e.label}
          </ChipButton>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-4 bg-stone-200 dark:bg-stone-700" />

      {/* Group by */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
          Group
        </span>
        <div className="flex items-center gap-0.5">
          {groups.map((g) => (
            <ChipButton
              key={g.value}
              active={config.groupBy === g.value}
              onClick={() => setPlantGroupBy(g.value)}
            >
              {g.label}
            </ChipButton>
          ))}
        </div>
      </div>

      {/* Separator */}
      <div className="w-px h-4 bg-stone-200 dark:bg-stone-700" />

      {/* Filter */}
      <div className="flex items-center gap-1.5 flex-1 max-w-[200px]">
        <Search className="w-3 h-3 text-stone-400 dark:text-stone-500 flex-shrink-0" />
        <input
          type="text"
          value={config.filter}
          onChange={(e) => setPlantFilter(e.target.value)}
          placeholder="Filter..."
          className="w-full bg-transparent text-xs font-mono text-stone-700 dark:text-stone-300 placeholder:text-stone-400 dark:placeholder:text-stone-500 outline-none"
        />
      </div>
    </div>
  );
});
