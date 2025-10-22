"use client";

import { use$ } from "@legendapp/state/react";
import { startBatch, endBatch } from "@/infrastructure/state/history";
import { moments$ } from "@/infrastructure/state/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  closeSortModeConflictDialog,
  drawingBoardSortMode$,
  sortModeConflictDialogState$,
} from "@/infrastructure/state/ui-store";

/**
 * SortModeConflictDialog - Confirmation dialog for switching to manual sort mode
 *
 * Shown when user tries to manually reorder moments while in auto-sort mode.
 * Offers to switch to manual mode or keep auto-sorting.
 */
export function SortModeConflictDialog() {
  const dialogState = use$(sortModeConflictDialogState$);
  const allMoments = use$(moments$);

  const handleSwitchToManual = () => {
    drawingBoardSortMode$.set("manual");

    // Apply the pending reorder if it exists
    if (dialogState.pendingReorder) {
      const { activeId, overId } = dialogState.pendingReorder;

      // Get all unallocated moments, sorted by current order
      const unallocatedMoments = Object.values(allMoments)
        .filter((m) => !m.day && !m.phase)
        .sort((a, b) => a.order - b.order);

      const oldIndex = unallocatedMoments.findIndex((m) => m.id === activeId);
      const newIndex = unallocatedMoments.findIndex((m) => m.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Reorder the array
        const reordered = [...unallocatedMoments];
        const [movedItem] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, movedItem);

        // Update the order property for all unallocated moments
        startBatch();
        reordered.forEach((moment, index) => {
          if (moment.order !== index) {
            moments$[moment.id].order.set(index);
            moments$[moment.id].updatedAt.set(new Date().toISOString());
          }
        });
        endBatch("Switched to manual sort and reordered moments");
      }
    }

    closeSortModeConflictDialog();
  };

  const handleKeepAutoSort = () => {
    closeSortModeConflictDialog();
  };

  return (
    <Dialog open={dialogState.open} onOpenChange={closeSortModeConflictDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-stone-900 dark:text-stone-100">
            Switch to Manual Sorting?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 p-6">
          {/* Main explanation */}
          <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">
            You're trying to reorder moments, but automatic sorting is enabled.
            Switch to manual mode to control the exact order.
          </p>

          {/* Mode comparison */}
          <div className="space-y-3 py-4 px-4 rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full bg-stone-400 dark:bg-stone-500" />
              <div>
                <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-0.5">
                  Manual Mode
                </p>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  You control the exact order with drag and drop
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full bg-stone-400 dark:bg-stone-500" />
              <div>
                <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-0.5">
                  Auto Mode
                </p>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Always sorted by order, then newest first
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={handleKeepAutoSort}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700 hover:border-stone-400 dark:hover:border-stone-500 transition-all duration-fast transition-smooth"
            >
              Keep Auto
            </button>
            <button
              type="button"
              onClick={handleSwitchToManual}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 shadow-sm transition-all duration-fast transition-smooth"
            >
              Switch to Manual
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
