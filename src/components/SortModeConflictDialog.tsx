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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch to Manual Sorting?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            The drawing board is currently using automatic sorting (by order and
            creation date). To manually reorder moments with drag and drop,
            switch to manual sorting mode.
          </p>
          <div className="space-y-2">
            <p className="text-xs text-stone-500 dark:text-stone-500 font-mono">
              Manual mode: You control the exact order
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-500 font-mono">
              Auto mode: Always sorted by order → newest first
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleKeepAutoSort}
              className="px-4 py-2 rounded-lg font-mono text-sm bg-stone-200 hover:bg-stone-300 text-stone-900 dark:bg-stone-700 dark:hover:bg-stone-600 dark:text-stone-100 transition-colors"
            >
              Keep Auto Sort
            </button>
            <button
              type="button"
              onClick={handleSwitchToManual}
              className="px-4 py-2 rounded-lg font-mono text-sm bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-200 dark:hover:bg-stone-300 dark:text-stone-900 transition-colors"
            >
              Switch to Manual
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
