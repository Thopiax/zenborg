"use client";

import { observer, use$ } from "@legendapp/state/react";
import {
  Eye,
  EyeOff,
  Grid3X3,
  Hash,
  Heart,
  MapPin,
  Search,
  Sprout,
  SunMoon,
  Tag,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
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

const ENTITIES: { value: PlantEntity; label: string; icon: ReactNode }[] = [
  { value: "habits", label: "Habits", icon: <Sprout className="w-3.5 h-3.5" /> },
  { value: "people", label: "People", icon: <Users className="w-3.5 h-3.5" /> },
];

const HABIT_GROUPS: { value: HabitGroupBy; label: string; icon: ReactNode }[] = [
  { value: "area", label: "Area", icon: <Grid3X3 className="w-3 h-3" /> },
  { value: "attitude", label: "Attitude", icon: <Heart className="w-3 h-3" /> },
  { value: "phase", label: "Phase", icon: <SunMoon className="w-3 h-3" /> },
  { value: "tag", label: "Tag", icon: <Tag className="w-3 h-3" /> },
];

const PEOPLE_GROUPS: { value: PeopleGroupBy; label: string; icon: ReactNode }[] = [
  { value: "category", label: "Category", icon: <Hash className="w-3 h-3" /> },
  { value: "basePlace", label: "Place", icon: <MapPin className="w-3 h-3" /> },
  { value: "status", label: "Status", icon: <Eye className="w-3 h-3" /> },
];

function ChipButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-mono transition-colors",
        active
          ? "bg-stone-800 dark:bg-stone-200 text-stone-100 dark:text-stone-800"
          : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800",
      )}
    >
      {children}
    </button>
  );
}

export const PlantToolbar = observer(
  ({
    showEmpty,
    onToggleEmpty,
  }: {
    showEmpty: boolean;
    onToggleEmpty: () => void;
  }) => {
    const config = use$(plantViewConfig$);
    const groups = config.entity === "habits" ? HABIT_GROUPS : PEOPLE_GROUPS;

    return (
      <div className="flex items-center gap-2 px-4 py-1.5 border-t border-stone-200 dark:border-stone-800">
        {/* Entity switcher */}
        <div className="flex items-center gap-0.5">
          {ENTITIES.map((e) => (
            <ChipButton
              key={e.value}
              active={config.entity === e.value}
              onClick={() => setPlantEntity(e.value)}
              title={e.label}
            >
              {e.icon}
              <span>{e.label}</span>
            </ChipButton>
          ))}
        </div>

        <div className="w-px h-4 bg-stone-200 dark:bg-stone-700" />

        {/* Group by */}
        <div className="flex items-center gap-0.5">
          {groups.map((g) => (
            <ChipButton
              key={g.value}
              active={config.groupBy === g.value}
              onClick={() => setPlantGroupBy(g.value)}
              title={`Group by ${g.label}`}
            >
              {g.icon}
              <span className="hidden md:inline">{g.label}</span>
            </ChipButton>
          ))}
        </div>

        <div className="w-px h-4 bg-stone-200 dark:bg-stone-700" />

        {/* Show/hide empty */}
        <button
          type="button"
          onClick={onToggleEmpty}
          title={showEmpty ? "Hide empty columns" : "Show empty columns"}
          className="p-1 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
        >
          {showEmpty ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Filter — pushed right */}
        <div className="flex items-center gap-1.5 ml-auto max-w-[200px]">
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
  },
);
