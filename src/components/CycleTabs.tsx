"use client";

import { Pencil } from "lucide-react";
import { CycleService } from "@/application/services/CycleService";
import type { Cycle } from "@/domain/entities/Cycle";
import { formatCycleDateRange } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * CycleTabs - Horizontal cycle selector
 *
 * Features:
 * - Shows cycle names with countdown timers
 * - "ends in X days" for active cycles
 * - "starts in X days" for upcoming cycles
 * - + button to create new cycle
 */
interface CycleTabsProps {
  selectedCycleId: string | null;
  onSelectCycle: (cycleId: string) => void;
  onCreateCycle: () => void;
  onEditCycle?: (cycle: Cycle) => void;
}

export function CycleTabs({
  selectedCycleId,
  onSelectCycle,
  onCreateCycle,
  onEditCycle,
}: CycleTabsProps) {
  const cycleService = new CycleService();

  // Get current and future cycles from service (already filtered and sorted)
  const activeCycles = cycleService.getCurrentAndFutureCycles();

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {/* Active & Future Cycle Tabs */}
      {activeCycles.map((cycle) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: <explanation>
        // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
        <div
          key={cycle.id}
          className={cn(
            "group flex-shrink-0 px-4 py-2 rounded-lg font-mono text-sm transition-colors cursor-pointer",
            selectedCycleId === cycle.id
              ? "bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 font-medium"
              : "bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-300 dark:hover:bg-stone-700"
          )}
          onClick={() => onSelectCycle(cycle.id)}
        >
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-start">
              <span>{cycle.name}</span>
              <span className="text-xs opacity-70">
                {formatCycleDateRange(cycle.startDate, cycle.endDate)}
              </span>
            </div>
            {onEditCycle && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditCycle(cycle);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-stone-700/20 dark:hover:bg-stone-300/20"
                title="Edit cycle"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Create Cycle Button */}
      <button
        type="button"
        onClick={onCreateCycle}
        className="flex-shrink-0 px-4 py-2 rounded-lg bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-300 dark:hover:bg-stone-700 font-mono text-sm transition-colors"
        title="Create new cycle"
      >
        +
      </button>
    </div>
  );
}
