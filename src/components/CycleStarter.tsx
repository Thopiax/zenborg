"use client";

import { useValue } from "@legendapp/state/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { CycleService } from "@/application/services/CycleService";
import type { TemplateDuration } from "@/domain/services/CycleDateService";
import { cycles$ } from "@/infrastructure/state/store";
import { cycleDeckCollapsed$ } from "@/infrastructure/state/ui-store";
import { formatCycleDateRange } from "@/lib/dates";
import { CycleFormDialog } from "./CycleFormDialog";

const PRESETS: Array<{ label: string; template: TemplateDuration }> = [
  { label: "1 week", template: "week" },
  { label: "2 weeks", template: "2-week" },
  { label: "1 month", template: "month" },
];

/**
 * CycleStarter - Shown in CycleDeck slot when no cycle is active.
 *
 * Two scenarios:
 * A) Next planned cycle exists → show name + date range + "Start now"
 * B) No future cycle → show preset duration buttons for quick-create
 */
export function CycleStarter() {
  const cycleService = new CycleService();
  const isCollapsed = useValue(cycleDeckCollapsed$);
  const allCycles = useValue(cycles$);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);

  const toggleCollapsed = () =>
    cycleDeckCollapsed$.set(!cycleDeckCollapsed$.peek());

  // Find next planned (future) cycle that isn't active
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextCycle = Object.values(allCycles)
    .filter((c) => {
      const start = new Date(c.startDate);
      start.setHours(0, 0, 0, 0);
      return start >= today;
    })
    .sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    )[0] ?? null;

  const handleQuickCreate = (template: TemplateDuration) => {
    cycleService.quickCreateCycle(template);
  };

  const handleStartNext = () => {
    if (nextCycle) {
      cycleService.activateCycle(nextCycle.id);
    }
  };

  const handleCustomSave = (
    name: string,
    _templateDuration?: TemplateDuration,
    startDate?: string,
    endDate?: string | null
  ) => {
    const result = cycleService.planCycle(
      name,
      undefined,
      startDate,
      endDate ?? undefined
    );
    if (!("error" in result)) {
      cycleService.activateCycle(result.id);
    }
    setCustomDialogOpen(false);
  };

  return (
    <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex-shrink-0">
      {/* Header */}
      <div className="px-6 py-3 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
        <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 font-semibold">
          Between cycles
        </h2>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title={isCollapsed ? "Expand (p)" : "Collapse (p)"}
          aria-label={isCollapsed ? "Expand cycle starter" : "Collapse cycle starter"}
        >
          {isCollapsed ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-6 py-6 flex flex-col items-center justify-center gap-4 min-h-[120px]">
          {nextCycle ? (
            <>
              <p className="text-sm font-mono text-stone-500 dark:text-stone-400">
                Next up
              </p>
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg font-mono font-semibold text-stone-900 dark:text-stone-100">
                  {nextCycle.name}
                </span>
                <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
                  {formatCycleDateRange(nextCycle.startDate, nextCycle.endDate)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleStartNext}
                className="px-5 py-2 rounded-lg font-mono font-medium text-sm bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 hover:opacity-90 active:scale-95 transition-all"
              >
                Start now
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-mono text-stone-500 dark:text-stone-400">
                Start a new cycle
              </p>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {PRESETS.map(({ label, template }) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => handleQuickCreate(template)}
                    className="px-4 py-2 rounded-full font-mono text-sm font-medium border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 transition-all"
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomDialogOpen(true)}
                  className="px-4 py-2 rounded-full font-mono text-sm font-medium border border-dashed border-stone-300 dark:border-stone-600 text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 transition-all"
                >
                  Custom...
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Custom cycle dialog */}
      <CycleFormDialog
        open={customDialogOpen}
        mode="create"
        initialStartDate={cycleService.getDefaultStartDate()}
        onClose={() => setCustomDialogOpen(false)}
        onSave={handleCustomSave}
      />
    </div>
  );
}

