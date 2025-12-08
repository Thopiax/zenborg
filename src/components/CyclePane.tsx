"use client";

import { observer } from "@legendapp/state/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { TemplateDuration } from "@/application/services/CycleService";
import { CycleService } from "@/application/services/CycleService";
import { CycleDeckBuilder } from "@/components/CycleDeckBuilder";
import { CycleFormDialog } from "@/components/CycleFormDialog";
import { CycleTabs } from "@/components/CycleTabs";
import type { Cycle } from "@/domain/entities/Cycle";
import { cn } from "@/lib/utils";

/**
 * CyclePane - Bottom pane for cycle planning
 *
 * Features:
 * - Cycle selector tabs (Current, Next, +)
 * - Cycle deck builder (drop target for habits from area gallery)
 * - Budget management
 * - Smart default start dates (tomorrow or after latest cycle)
 */

interface CyclePaneProps {
  onCollapsedChange?: (isCollapsed: boolean) => void;
}

const CollapsedCyclePane = ({
  onExpand,
  cycles,
}: {
  onExpand: () => void;
  cycles: Cycle[];
}) => {
  return (
    <button
      className="px-6 py-4 flex items-center w-full justify-between bg-stone-100 dark:bg-stone-800 border-t border-stone-200 dark:border-stone-700 cursor-pointer"
      type="button"
      onClick={onExpand}
    >
      <span className="text-sm font-mono text-stone-700 dark:text-stone-300 grow">
        {cycles.length} {cycles.length === 1 ? "cycle" : "cycles"}
      </span>
      <ChevronUp className="w-4 h-4 text-stone-500 dark:text-stone-400" />
    </button>
  );
};

export const CyclePane = observer(
  ({ onCollapsedChange }: CyclePaneProps = {}) => {
    const cycleService = new CycleService();

    // UI state
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
    const [cycleToEdit, setCycleToEdit] = useState<Cycle | null>(null);
    const [defaultStartDate, setDefaultStartDate] = useState<string>("");
    const [groupBy, setGroupBy] = useState<"area" | "attitude">("area");

    // Get current and future cycles (sorted chronologically)
    const cyclesList = cycleService.getCurrentAndFutureCycles();

    // Default to current cycle (the one containing today), fallback to active cycle
    const currentCycle = cycleService.getCurrentCycle();
    const activeCycle = cycleService.getActiveCycle();

    // Use current cycle if available, otherwise active cycle, only if in the list
    const defaultCycle = currentCycle || activeCycle;
    const defaultCycleInList = defaultCycle && cyclesList.find(c => c.id === defaultCycle.id);
    const effectiveSelectedCycleId = selectedCycleId || defaultCycleInList?.id || null;

    // Open create dialog
    const openCreateDialog = () => {
      setDialogMode("create");
      setCycleToEdit(null);
      // Get default start date from service (business logic)
      const defaultDate = cycleService.getDefaultStartDate();
      setDefaultStartDate(defaultDate);
      setDialogOpen(true);
    };

    // Open edit dialog
    const openEditDialog = (cycle: Cycle) => {
      setDialogMode("edit");
      setCycleToEdit(cycle);
      setDialogOpen(true);
    };

    // Close dialog
    const closeDialog = () => {
      setDialogOpen(false);
      setCycleToEdit(null);
    };

    // Handle save (create mode)
    const handleSave = (
      name: string,
      templateDuration?: TemplateDuration,
      startDate?: string,
      endDate?: string | null
    ) => {
      const result = cycleService.planCycle(
        name,
        templateDuration,
        startDate,
        endDate ?? undefined
      );

      if ("error" in result) {
        alert(`Failed to create cycle: ${result.error}`);
        return;
      }

      setSelectedCycleId(result.id);
    };

    // Handle update (edit mode)
    const handleUpdate = (
      cycleId: string,
      updates: { name?: string; startDate?: string; endDate?: string | null }
    ) => {
      const result = cycleService.updateCycle(cycleId, updates);

      if ("error" in result) {
        alert(`Failed to update cycle: ${result.error}`);
        return;
      }
    };

    // Handle delete
    const handleDelete = (cycleId: string) => {
      const result = cycleService.deleteCycle(cycleId);

      if ("error" in result) {
        alert(`Failed to delete cycle: ${result.error}`);
        return;
      }

      // Clear selection if deleted cycle was selected
      if (selectedCycleId === cycleId) {
        setSelectedCycleId(null);
      }
    };

    // Calculate days remaining in cycle
    const getDaysRemaining = (cycle: Cycle): string => {
      if (!cycle.endDate) {
        return "ongoing";
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(cycle.endDate);
      endDate.setHours(0, 0, 0, 0);

      const diffMs = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return "ended";
      }
      if (diffDays === 0) {
        return "ends today";
      }
      if (diffDays === 1) {
        return "1 day left";
      }
      return `${diffDays} days left`;
    };

    if (isCollapsed) {
      return (
        <CollapsedCyclePane
          onExpand={() => {
            setIsCollapsed(false);
            onCollapsedChange?.(false);
          }}
          cycles={cyclesList}
        />
      );
    }

    return (
      <>
        {/* Page Title - Always visible */}
        {!isCollapsed && (
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-xl font-mono font-bold text-stone-900 dark:text-stone-100 mb-1">
              Cycles
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 font-mono">
              Budget habits to time periods
            </p>
          </div>
        )}

        {/* Header with Collapse Button */}
        <div
          className={cn(
            "px-6 flex items-center justify-between transition-all",
            isCollapsed ? "h-14 py-3" : "pt-0 pb-2"
          )}
        >
          <div className="flex-1">
            {!isCollapsed ? (
              <CycleTabs
                selectedCycleId={effectiveSelectedCycleId}
                onSelectCycle={setSelectedCycleId}
                onCreateCycle={openCreateDialog}
                onEditCycle={openEditDialog}
              />
            ) : (
              <div className="flex items-center gap-3 overflow-x-auto">
                {cyclesList.length > 0 ? (
                  cyclesList.map((cycle) => (
                    <button
                      key={cycle.id}
                      type="button"
                      onClick={() => {
                        setSelectedCycleId(cycle.id);
                        setIsCollapsed(false);
                      }}
                      className="flex-shrink-0 px-3 py-1.5 rounded-md bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors"
                    >
                      <span className="text-xs font-mono text-stone-700 dark:text-stone-300">
                        {cycle.name}
                      </span>
                    </button>
                  ))
                ) : (
                  <span className="text-xs font-mono text-stone-500 dark:text-stone-400">
                    No cycles
                  </span>
                )}
                <button
                  type="button"
                  onClick={openCreateDialog}
                  className="flex-shrink-0 px-3 py-1 rounded-md bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 font-mono text-xs transition-colors"
                >
                  +
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              const newCollapsed = !isCollapsed;
              setIsCollapsed(newCollapsed);
              onCollapsedChange?.(newCollapsed);
            }}
            className="p-1.5 hover:bg-stone-200 dark:hover:bg-stone-700 rounded transition-colors"
            aria-label={isCollapsed ? "Expand cycles" : "Collapse cycles"}
          >
            {isCollapsed ? (
              <ChevronUp className="w-4 h-4 text-stone-500 dark:text-stone-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-stone-500 dark:text-stone-400" />
            )}
          </button>
        </div>

        {/* Collapsible Content */}
        {!isCollapsed && (
          <>
            {effectiveSelectedCycleId ? (
              <div className="pb-4">
                {/* Cycle Header */}
                {(() => {
                  const selectedCycle = cyclesList.find(
                    (c) => c.id === effectiveSelectedCycleId
                  );
                  if (!selectedCycle) return null;

                  return (
                    <div className="px-6 pb-4 flex items-baseline justify-between border-b border-stone-200 dark:border-stone-700">
                      <h2 className="text-lg font-mono font-medium text-stone-900 dark:text-stone-100">
                        {selectedCycle.name}
                      </h2>
                      <span className="text-sm font-mono text-stone-500 dark:text-stone-400">
                        {getDaysRemaining(selectedCycle)}
                      </span>
                    </div>
                  );
                })()}

                {/* Grouping Selector */}
                <div className="px-6 pt-4 pb-3 flex items-center gap-2">
                  <span className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Group
                  </span>
                  <div className="flex items-center gap-0.5 p-0.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-sm">
                    <button
                      type="button"
                      onClick={() => setGroupBy("area")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                        groupBy === "area"
                          ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm"
                          : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700"
                      )}
                    >
                      Area
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupBy("attitude")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                        groupBy === "attitude"
                          ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm"
                          : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700"
                      )}
                    >
                      Attitude
                    </button>
                  </div>
                </div>

                <CycleDeckBuilder
                  cycleId={effectiveSelectedCycleId}
                  groupBy={groupBy}
                />
              </div>
            ) : (
              <div className="px-6 pb-6 text-center py-12">
                <p className="text-sm text-stone-500 dark:text-stone-400 font-mono mb-4">
                  No cycles yet
                </p>
                <button
                  type="button"
                  onClick={openCreateDialog}
                  className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-900 text-stone-50 dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 font-mono text-sm transition-colors"
                >
                  Create Your First Cycle
                </button>
              </div>
            )}
          </>
        )}

        {/* Cycle Form Dialog */}
        <CycleFormDialog
          open={dialogOpen}
          mode={dialogMode}
          cycleId={cycleToEdit?.id}
          initialName={cycleToEdit?.name}
          initialStartDate={
            dialogMode === "create" ? defaultStartDate : cycleToEdit?.startDate
          }
          initialEndDate={cycleToEdit?.endDate}
          onClose={closeDialog}
          onSave={handleSave}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      </>
    );
  }
);
