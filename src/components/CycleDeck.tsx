"use client";

import { useValue } from "@legendapp/state/react";
import { ChevronDown, ChevronUp, Flag, Plus } from "lucide-react";
import { useState } from "react";
import { CycleService } from "@/application/services/CycleService";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import {
  activeCycle$,
  areas$,
  cycles$,
  habits$,
  storeHydrated$,
} from "@/infrastructure/state/store";
import {
  cycleDeckCollapsed$,
  cycleDeckSelectedCycleId$,
} from "@/infrastructure/state/ui-store";
import { useHabitHealth } from "@/hooks/useHabitHealth";
import { formatCycleSubtitle } from "@/lib/dates";
import { columnWidth } from "@/lib/design-tokens";
import { healthEmojiClass } from "@/lib/health-style";
import { cn } from "@/lib/utils";
import { CycleDeckHeatmap } from "./banded-heatmap/CycleDeckHeatmap";
import { CycleCalendarDialog } from "./CycleCalendarDialog";

function CycleHabitRow({ habit }: { habit: Habit }) {
  const { health, daysSinceLast } = useHabitHealth(habit.id);

  const showDays =
    health === "wilting" && daysSinceLast !== null && daysSinceLast > 0;

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={cn("text-sm shrink-0", healthEmojiClass(health))}>
        {habit.emoji || "·"}
      </span>
      <span className="text-xs font-mono text-stone-700 dark:text-stone-300 truncate flex-1 min-w-0">
        {habit.name}
      </span>
      {showDays && (
        <span className="text-xs font-mono text-stone-400 shrink-0">
          {daysSinceLast}d
        </span>
      )}
    </div>
  );
}

export function CycleDeck() {
  const cycleService = new CycleService();

  const activeCycle = useValue(() => activeCycle$.get());
  const isCollapsed = useValue(cycleDeckCollapsed$);
  const selectedCycleId = useValue(cycleDeckSelectedCycleId$);
  const allCyclesMap = useValue(() => cycles$.get());
  const habitsMap = useValue(() => habits$.get());
  const areasMap = useValue(() => areas$.get());
  const isHydrated = useValue(storeHydrated$);

  const toggleCollapsed = () =>
    cycleDeckCollapsed$.set(!cycleDeckCollapsed$.peek());

  const effectiveCycleId = selectedCycleId || activeCycle?.id || null;
  const effectiveCycle = effectiveCycleId
    ? allCyclesMap[effectiveCycleId] || null
    : null;

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // End cycle popover
  const [endPopoverOpen, setEndPopoverOpen] = useState(false);
  const [endDateInput, setEndDateInput] = useState("");
  const [endCycleError, setEndCycleError] = useState<string | null>(null);

  const resetEndCycleState = () => {
    setEndPopoverOpen(false);
    setEndDateInput("");
    setEndCycleError(null);
  };

  const handleEndCycle = (explicitEndDate?: string) => {
    if (!effectiveCycleId) return;
    const result = cycleService.endCycle(effectiveCycleId, explicitEndDate);
    if ("error" in result) {
      setEndCycleError(result.error);
      return;
    }
    resetEndCycleState();
  };

  // No active cycle
  if (!activeCycle) {
    if (!isHydrated) return null;
    return (
      <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex-shrink-0">
        <div className="px-6 py-4 text-center text-xs font-mono text-stone-400 dark:text-stone-500">
          no active cycle ·{" "}
          <button
            type="button"
            onClick={() => setCreateDialogOpen(true)}
            className="underline underline-offset-2 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
          >
            plan one
          </button>
        </div>
        <CycleDeckHeatmap />
        <CycleCalendarDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
        />
      </div>
    );
  }

  // Habits grouped by area
  const habitsByArea: Array<{ area: Area; habits: Habit[] }> = (() => {
    const activeHabits = Object.values(habitsMap).filter(
      (h) => !h.isArchived,
    );
    const byArea = new Map<string, Habit[]>();
    for (const h of activeHabits) {
      const list = byArea.get(h.areaId) ?? [];
      list.push(h);
      byArea.set(h.areaId, list);
    }
    return Array.from(byArea.entries())
      .map(([areaId, habits]) => ({
        area: areasMap[areaId],
        habits: habits.sort((a, b) => a.order - b.order),
      }))
      .filter(({ area }) => Boolean(area))
      .sort((a, b) => a.area.order - b.area.order);
  })();

  const isEffectiveCycleActive = effectiveCycle?.id === activeCycle?.id;
  const deckSubtitle = effectiveCycle
    ? formatCycleSubtitle(
        effectiveCycle.startDate,
        effectiveCycle.endDate,
        isEffectiveCycleActive,
      )
    : "";

  const header = (
    <div className="px-6 py-2.5 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between cursor-default select-none">
      <div className="min-w-0">
        <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 font-semibold truncate leading-tight">
          {effectiveCycle?.name ?? "Pick a cycle"}
        </h2>
        {deckSubtitle && (
          <p className="text-xs font-mono text-stone-500 dark:text-stone-400 truncate leading-tight">
            {deckSubtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {!isCollapsed && effectiveCycle && (
          <Popover
            open={endPopoverOpen}
            onOpenChange={(open) => {
              if (open) {
                setEndCycleError(null);
                setEndDateInput(effectiveCycle.endDate ?? "");
              }
              setEndPopoverOpen(open);
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-1.5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                title={
                  effectiveCycle.endDate ? "Adjust end date" : "End this cycle"
                }
                aria-label={
                  effectiveCycle.endDate ? "Adjust end date" : "End this cycle"
                }
              >
                <Flag className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-64 p-3 flex flex-col gap-3 font-mono"
            >
              <div>
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  {effectiveCycle.endDate ? "Cycle end date" : "End cycle"}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  {effectiveCycle.endDate
                    ? `Adjust when "${effectiveCycle.name}" ended.`
                    : `Close "${effectiveCycle.name}". Defaults to today, capped before the next cycle.`}
                </p>
              </div>
              {!effectiveCycle.endDate && (
                <button
                  type="button"
                  onClick={() => handleEndCycle()}
                  className="w-full px-3 py-2 rounded-md bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 text-xs font-medium hover:opacity-90 active:scale-95 transition-all"
                >
                  End today
                </button>
              )}
              <div className="flex flex-col gap-2">
                <input
                  type="date"
                  value={endDateInput}
                  min={effectiveCycle.startDate}
                  onChange={(e) => {
                    setEndDateInput(e.target.value);
                    setEndCycleError(null);
                  }}
                  className="w-full px-2 py-1.5 border border-stone-300 dark:border-stone-600 rounded-md bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400"
                  aria-label="End date"
                />
                <button
                  type="button"
                  disabled={!endDateInput}
                  onClick={() => handleEndCycle(endDateInput)}
                  className="w-full px-3 py-1.5 rounded-md text-xs font-medium border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {effectiveCycle.endDate
                    ? "Save end date"
                    : "End on this date"}
                </button>
              </div>
              {endCycleError && (
                <p
                  className="text-xs text-red-600 dark:text-red-400"
                  role="alert"
                >
                  {endCycleError}
                </p>
              )}
            </PopoverContent>
          </Popover>
        )}
        {!isCollapsed && (
          <button
            type="button"
            onClick={() => setCreateDialogOpen(true)}
            className="p-1.5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            title="Plan new cycle"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="p-1.5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          title={isCollapsed ? "Expand cycle deck" : "Collapse cycle deck"}
        >
          {isCollapsed ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex-shrink-0">
      {header}

      {!isCollapsed && (
        <div>
          {effectiveCycle?.intention && (
            <p className="px-6 py-2 text-xs font-mono text-stone-500 dark:text-stone-400 italic border-b border-stone-200/50 dark:border-stone-700/50">
              {effectiveCycle.intention}
            </p>
          )}

          <div className="flex gap-4 overflow-x-auto px-6 py-2 snap-x snap-mandatory scroll-smooth">
            {habitsByArea.map(({ area, habits }) => (
              <div
                key={area.id}
                className={cn(
                  "flex flex-col snap-start",
                  columnWidth.scrollableClassName,
                )}
              >
                <div className="flex items-center gap-2 py-1">
                  {area.emoji && (
                    <span className="text-sm">{area.emoji}</span>
                  )}
                  <span className="text-xs font-mono font-semibold text-stone-600 dark:text-stone-400 truncate">
                    {area.name}
                  </span>
                </div>
                <div
                  className="h-[2px] mb-1"
                  style={{ backgroundColor: area.color }}
                />
                <div className="flex flex-col">
                  {habits.map((h) => (
                    <CycleHabitRow key={h.id} habit={h} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CycleDeckHeatmap />
      <CycleCalendarDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </div>
  );
}
