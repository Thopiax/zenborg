"use client";

import { Pencil } from "lucide-react";
import { CycleService } from "@/application/services/CycleService";
import { cn } from "@/lib/utils";
import type { Cycle } from "@/domain/entities/Cycle";

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

/**
 * Calculate days until/since a date
 * Returns positive for future dates, negative for past dates
 */
function getDaysUntil(dateStr: string): number {
  const targetDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffMs = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Format date to readable string (e.g., "15 Jan")
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "short" });
  return `${day} ${month}`;
}

/**
 * Get date range label for a cycle
 */
function getDateRangeLabel(cycle: Cycle): string {
  const startDate = formatDate(cycle.startDate);

  if (!cycle.endDate) {
    // Check if cycle is currently active
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cycleStart = new Date(cycle.startDate);
    cycleStart.setHours(0, 0, 0, 0);

    // If today is >= start date, it's ongoing
    if (today >= cycleStart) {
      return `${startDate} - ongoing`;
    }
    // If it's a future cycle, just show start date
    return `${startDate}`;
  }

  const endDate = formatDate(cycle.endDate);
  return `${startDate} - ${endDate}`;
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
                {getDateRangeLabel(cycle)}
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
