/**
 * History Middleware
 *
 * Provides functions to apply and record history operations.
 * This module bridges the history domain layer with the Legend State store.
 *
 * Design:
 * - All moment/selection mutations should go through these functions
 * - Functions both apply the operation AND record it to history
 * - Supports undo/redo by applying inverse operations
 */

import type { Moment } from "@/domain/entities/Moment";
import type {
  AllocateMomentOperation,
  BulkDeleteMomentsOperation,
  ClearSelectionOperation,
  CreateMomentOperation,
  DeleteMomentOperation,
  DeselectMomentsOperation,
  DuplicateMomentOperation,
  HistoryOperation,
  MoveMomentOperation,
  ReorderMomentsOperation,
  SelectAllOperation,
  SelectMomentsOperation,
  UnallocateMomentOperation,
  UpdateMomentOperation,
} from "@/domain/entities/HistoryEntry";
import type { Phase } from "@/domain/value-objects/Phase";
import { moments$ } from "./store";
import { selectionState$ } from "./selection";
import { recordOperation } from "./history";

// ============================================================================
// Moment CRUD Operations
// ============================================================================

/**
 * Create a new moment and record to history
 */
export function createMomentWithHistory(moment: Moment) {
  // Apply: Add to store
  moments$[moment.id].set(moment);

  // Record to history
  const operation: CreateMomentOperation = {
    type: "CREATE_MOMENT",
    timestamp: Date.now(),
    moment,
  };
  recordOperation(operation);

  console.log("[History] Created moment:", moment.name);
}

/**
 * Update a moment and record to history
 */
export function updateMomentWithHistory(
  momentId: string,
  updates: Partial<Moment>
) {
  const before = moments$[momentId].peek();

  if (!before) {
    console.error("[History] Cannot update moment - not found:", momentId);
    return;
  }

  // Apply: Update in store
  moments$[momentId].set({
    ...before,
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  // Record to history
  const operation: UpdateMomentOperation = {
    type: "UPDATE_MOMENT",
    timestamp: Date.now(),
    momentId,
    before: updates, // Only store the fields that changed
    after: updates,
  };
  recordOperation(operation);

  console.log("[History] Updated moment:", momentId);
}

/**
 * Delete a moment and record to history
 */
export function deleteMomentWithHistory(momentId: string) {
  const moment = moments$[momentId].peek();

  if (!moment) {
    console.error("[History] Cannot delete moment - not found:", momentId);
    return;
  }

  // Apply: Remove from store
  const allMoments = moments$.peek();
  const updated = { ...allMoments };
  delete updated[momentId];
  moments$.set(updated);

  // Record to history
  const operation: DeleteMomentOperation = {
    type: "DELETE_MOMENT",
    timestamp: Date.now(),
    moment,
  };
  recordOperation(operation);

  console.log("[History] Deleted moment:", moment.name);
}

/**
 * Bulk delete moments and record to history
 */
export function bulkDeleteMomentsWithHistory(momentIds: string[]) {
  const allMoments = moments$.peek();
  const momentsToDelete = momentIds
    .map((id) => allMoments[id])
    .filter(Boolean);

  if (momentsToDelete.length === 0) {
    console.error("[History] No moments to delete");
    return;
  }

  // Apply: Remove all from store
  const updated = { ...allMoments };
  for (const id of momentIds) {
    delete updated[id];
  }
  moments$.set(updated);

  // Record to history
  const operation: BulkDeleteMomentsOperation = {
    type: "BULK_DELETE_MOMENTS",
    timestamp: Date.now(),
    moments: momentsToDelete,
  };
  recordOperation(operation);

  console.log("[History] Bulk deleted", momentsToDelete.length, "moments");
}

// ============================================================================
// Allocation Operations
// ============================================================================

/**
 * Allocate a moment to a day/phase and record to history
 */
export function allocateMomentWithHistory(
  momentId: string,
  day: string,
  phase: Phase,
  order: number
) {
  const moment = moments$[momentId].peek();

  if (!moment) {
    console.error("[History] Cannot allocate moment - not found:", momentId);
    return;
  }

  // Apply: Update in store
  moments$[momentId].set({
    ...moment,
    day,
    phase,
    order,
    updatedAt: new Date().toISOString(),
  });

  // Record to history
  const operation: AllocateMomentOperation = {
    type: "ALLOCATE_MOMENT",
    timestamp: Date.now(),
    momentId,
    day,
    phase,
    order,
  };
  recordOperation(operation);

  console.log("[History] Allocated moment:", momentId, "to", day, phase);
}

/**
 * Unallocate a moment (return to drawing board) and record to history
 */
export function unallocateMomentWithHistory(momentId: string) {
  const moment = moments$[momentId].peek();

  if (!moment) {
    console.error("[History] Cannot unallocate moment - not found:", momentId);
    return;
  }

  if (!moment.day || !moment.phase) {
    console.warn("[History] Moment already unallocated:", momentId);
    return;
  }

  const previousDay = moment.day;
  const previousPhase = moment.phase;
  const previousOrder = moment.order;

  // Apply: Update in store
  moments$[momentId].set({
    ...moment,
    day: null,
    phase: null,
    order: 0,
    updatedAt: new Date().toISOString(),
  });

  // Record to history
  const operation: UnallocateMomentOperation = {
    type: "UNALLOCATE_MOMENT",
    timestamp: Date.now(),
    momentId,
    previousDay,
    previousPhase,
    previousOrder,
  };
  recordOperation(operation);

  console.log("[History] Unallocated moment:", momentId);
}

/**
 * Move a moment (combined unallocate + allocate) and record to history
 * This is the primary operation for drag & drop
 */
export function moveMomentWithHistory(
  momentId: string,
  toDay: string | null,
  toPhase: Phase | null,
  toOrder: number,
  reorders?: Array<{ momentId: string; fromOrder: number; toOrder: number }>
) {
  const moment = moments$[momentId].peek();

  if (!moment) {
    console.error("[History] Cannot move moment - not found:", momentId);
    return;
  }

  const fromDay = moment.day;
  const fromPhase = moment.phase;
  const fromOrder = moment.order;

  // Apply: Update in store
  moments$[momentId].set({
    ...moment,
    day: toDay,
    phase: toPhase,
    order: toOrder,
    updatedAt: new Date().toISOString(),
  });

  // Apply reorders if provided
  if (reorders) {
    for (const reorder of reorders) {
      moments$[reorder.momentId].order.set(reorder.toOrder);
      moments$[reorder.momentId].updatedAt.set(new Date().toISOString());
    }
  }

  // Record to history
  const operation: MoveMomentOperation = {
    type: "MOVE_MOMENT",
    timestamp: Date.now(),
    momentId,
    fromDay,
    fromPhase,
    fromOrder,
    toDay,
    toPhase,
    toOrder,
    reorders,
  };
  recordOperation(operation);

  console.log("[History] Moved moment:", momentId, "from", fromDay, fromPhase, "to", toDay, toPhase);
}

/**
 * Duplicate a moment and record to history
 */
export function duplicateMomentWithHistory(
  originalMomentId: string,
  targetDay: string | null,
  targetPhase: Phase | null,
  targetOrder: number
): string {
  const originalMoment = moments$[originalMomentId].peek();

  if (!originalMoment) {
    console.error("[History] Cannot duplicate moment - not found:", originalMomentId);
    return "";
  }

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();

  const duplicatedMoment: Moment = {
    ...originalMoment,
    id: newId,
    day: targetDay,
    phase: targetPhase,
    order: targetOrder,
    createdAt: now,
    updatedAt: now,
  };

  // Apply: Add to store
  moments$[newId].set(duplicatedMoment);

  // Record to history
  const operation: DuplicateMomentOperation = {
    type: "DUPLICATE_MOMENT",
    timestamp: Date.now(),
    originalMomentId,
    duplicatedMoment,
  };
  recordOperation(operation);

  console.log("[History] Duplicated moment:", originalMoment.name, "->", newId);

  return newId;
}

/**
 * Reorder moments within the same cell and record to history
 */
export function reorderMomentsWithHistory(
  day: string,
  phase: Phase,
  reorders: Array<{ momentId: string; fromOrder: number; toOrder: number }>
) {
  // Apply: Update orders in store
  for (const reorder of reorders) {
    moments$[reorder.momentId].order.set(reorder.toOrder);
    moments$[reorder.momentId].updatedAt.set(new Date().toISOString());
  }

  // Record to history
  const operation: ReorderMomentsOperation = {
    type: "REORDER_MOMENTS",
    timestamp: Date.now(),
    day,
    phase,
    reorders,
  };
  recordOperation(operation);

  console.log("[History] Reordered", reorders.length, "moments in", day, phase);
}

// ============================================================================
// Selection Operations
// ============================================================================

/**
 * Select moments and record to history
 */
export function selectMomentsWithHistory(momentIds: string[]) {
  const previousSelection = selectionState$.selectedMomentIds.peek();

  // Apply: Update selection in store
  selectionState$.selectedMomentIds.set(momentIds);
  if (momentIds.length > 0) {
    selectionState$.lastSelectedId.set(momentIds[momentIds.length - 1]);
  }
  selectionState$.editingMomentId.set(null);

  // Record to history
  const operation: SelectMomentsOperation = {
    type: "SELECT_MOMENTS",
    timestamp: Date.now(),
    momentIds,
    previousSelection,
  };
  recordOperation(operation);

  console.log("[History] Selected", momentIds.length, "moments");
}

/**
 * Deselect moments and record to history
 */
export function deselectMomentsWithHistory(momentIds: string[]) {
  const previousSelection = selectionState$.selectedMomentIds.peek();
  const newSelection = previousSelection.filter((id) => !momentIds.includes(id));

  // Apply: Update selection in store
  selectionState$.selectedMomentIds.set(newSelection);

  // Record to history
  const operation: DeselectMomentsOperation = {
    type: "DESELECT_MOMENTS",
    timestamp: Date.now(),
    momentIds,
    previousSelection,
  };
  recordOperation(operation);

  console.log("[History] Deselected", momentIds.length, "moments");
}

/**
 * Clear selection and record to history
 */
export function clearSelectionWithHistory() {
  const previousSelection = selectionState$.selectedMomentIds.peek();

  if (previousSelection.length === 0) {
    return; // Nothing to clear
  }

  // Apply: Clear selection in store
  selectionState$.selectedMomentIds.set([]);

  // Record to history
  const operation: ClearSelectionOperation = {
    type: "CLEAR_SELECTION",
    timestamp: Date.now(),
    previousSelection,
  };
  recordOperation(operation);

  console.log("[History] Cleared selection");
}

/**
 * Select all moments and record to history
 */
export function selectAllWithHistory(momentIds: string[]) {
  const previousSelection = selectionState$.selectedMomentIds.peek();

  // Apply: Update selection in store
  selectionState$.selectedMomentIds.set(momentIds);
  if (momentIds.length > 0) {
    selectionState$.lastSelectedId.set(momentIds[momentIds.length - 1]);
  }
  selectionState$.editingMomentId.set(null);

  // Record to history
  const operation: SelectAllOperation = {
    type: "SELECT_ALL",
    timestamp: Date.now(),
    momentIds,
    previousSelection,
  };
  recordOperation(operation);

  console.log("[History] Selected all", momentIds.length, "moments");
}

// ============================================================================
// Undo/Redo Application
// ============================================================================

/**
 * Apply a history operation (for redo)
 */
export function applyOperation(operation: HistoryOperation) {
  console.log("[History] Applying operation:", operation.type);

  switch (operation.type) {
    case "CREATE_MOMENT":
      moments$[operation.moment.id].set(operation.moment);
      break;

    case "DELETE_MOMENT":
      {
        const allMoments = moments$.peek();
        const updated = { ...allMoments };
        delete updated[operation.moment.id];
        moments$.set(updated);
      }
      break;

    case "BULK_DELETE_MOMENTS":
      {
        const allMoments = moments$.peek();
        const updated = { ...allMoments };
        for (const moment of operation.moments) {
          delete updated[moment.id];
        }
        moments$.set(updated);
      }
      break;

    case "UPDATE_MOMENT":
      {
        const moment = moments$[operation.momentId].peek();
        if (moment) {
          moments$[operation.momentId].set({
            ...moment,
            ...operation.after,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      break;

    case "ALLOCATE_MOMENT":
      {
        const moment = moments$[operation.momentId].peek();
        if (moment) {
          moments$[operation.momentId].set({
            ...moment,
            day: operation.day,
            phase: operation.phase,
            order: operation.order,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      break;

    case "UNALLOCATE_MOMENT":
      {
        const moment = moments$[operation.momentId].peek();
        if (moment) {
          moments$[operation.momentId].set({
            ...moment,
            day: null,
            phase: null,
            order: 0,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      break;

    case "MOVE_MOMENT":
      {
        const moment = moments$[operation.momentId].peek();
        if (moment) {
          moments$[operation.momentId].set({
            ...moment,
            day: operation.toDay,
            phase: operation.toPhase,
            order: operation.toOrder,
            updatedAt: new Date().toISOString(),
          });

          // Apply reorders
          if (operation.reorders) {
            for (const reorder of operation.reorders) {
              moments$[reorder.momentId].order.set(reorder.toOrder);
              moments$[reorder.momentId].updatedAt.set(new Date().toISOString());
            }
          }
        }
      }
      break;

    case "DUPLICATE_MOMENT":
      moments$[operation.duplicatedMoment.id].set(operation.duplicatedMoment);
      break;

    case "REORDER_MOMENTS":
      for (const reorder of operation.reorders) {
        moments$[reorder.momentId].order.set(reorder.toOrder);
        moments$[reorder.momentId].updatedAt.set(new Date().toISOString());
      }
      break;

    case "SELECT_MOMENTS":
      selectionState$.selectedMomentIds.set(operation.momentIds);
      if (operation.momentIds.length > 0) {
        selectionState$.lastSelectedId.set(
          operation.momentIds[operation.momentIds.length - 1]
        );
      }
      break;

    case "DESELECT_MOMENTS":
      {
        const current = selectionState$.selectedMomentIds.peek();
        const newSelection = current.filter(
          (id) => !operation.momentIds.includes(id)
        );
        selectionState$.selectedMomentIds.set(newSelection);
      }
      break;

    case "CLEAR_SELECTION":
      selectionState$.selectedMomentIds.set([]);
      break;

    case "SELECT_ALL":
      selectionState$.selectedMomentIds.set(operation.momentIds);
      if (operation.momentIds.length > 0) {
        selectionState$.lastSelectedId.set(
          operation.momentIds[operation.momentIds.length - 1]
        );
      }
      break;

    default:
      console.warn("[History] Unknown operation type:", (operation as any).type);
  }
}

/**
 * Apply inverse of a history operation (for undo)
 */
export function applyInverseOperation(operation: HistoryOperation) {
  console.log("[History] Applying inverse operation:", operation.type);

  switch (operation.type) {
    case "CREATE_MOMENT":
      // Undo create = delete
      {
        const allMoments = moments$.peek();
        const updated = { ...allMoments };
        delete updated[operation.moment.id];
        moments$.set(updated);
      }
      break;

    case "DELETE_MOMENT":
      // Undo delete = create
      moments$[operation.moment.id].set(operation.moment);
      break;

    case "BULK_DELETE_MOMENTS":
      // Undo bulk delete = recreate all
      for (const moment of operation.moments) {
        moments$[moment.id].set(moment);
      }
      break;

    case "UPDATE_MOMENT":
      // Undo update = apply before state
      {
        const moment = moments$[operation.momentId].peek();
        if (moment) {
          moments$[operation.momentId].set({
            ...moment,
            ...operation.before,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      break;

    case "ALLOCATE_MOMENT":
      // Undo allocate = unallocate
      {
        const moment = moments$[operation.momentId].peek();
        if (moment) {
          moments$[operation.momentId].set({
            ...moment,
            day: null,
            phase: null,
            order: 0,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      break;

    case "UNALLOCATE_MOMENT":
      // Undo unallocate = allocate
      {
        const moment = moments$[operation.momentId].peek();
        if (moment) {
          moments$[operation.momentId].set({
            ...moment,
            day: operation.previousDay,
            phase: operation.previousPhase,
            order: operation.previousOrder,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      break;

    case "MOVE_MOMENT":
      // Undo move = move back
      {
        const moment = moments$[operation.momentId].peek();
        if (moment) {
          moments$[operation.momentId].set({
            ...moment,
            day: operation.fromDay,
            phase: operation.fromPhase,
            order: operation.fromOrder,
            updatedAt: new Date().toISOString(),
          });

          // Undo reorders
          if (operation.reorders) {
            for (const reorder of operation.reorders) {
              moments$[reorder.momentId].order.set(reorder.fromOrder);
              moments$[reorder.momentId].updatedAt.set(new Date().toISOString());
            }
          }
        }
      }
      break;

    case "DUPLICATE_MOMENT":
      // Undo duplicate = delete the duplicate
      {
        const allMoments = moments$.peek();
        const updated = { ...allMoments };
        delete updated[operation.duplicatedMoment.id];
        moments$.set(updated);
      }
      break;

    case "REORDER_MOMENTS":
      // Undo reorder = apply fromOrder
      for (const reorder of operation.reorders) {
        moments$[reorder.momentId].order.set(reorder.fromOrder);
        moments$[reorder.momentId].updatedAt.set(new Date().toISOString());
      }
      break;

    case "SELECT_MOMENTS":
      // Undo select = restore previous selection
      selectionState$.selectedMomentIds.set(operation.previousSelection);
      if (operation.previousSelection.length > 0) {
        selectionState$.lastSelectedId.set(
          operation.previousSelection[operation.previousSelection.length - 1]
        );
      }
      break;

    case "DESELECT_MOMENTS":
      // Undo deselect = restore previous selection
      selectionState$.selectedMomentIds.set(operation.previousSelection);
      if (operation.previousSelection.length > 0) {
        selectionState$.lastSelectedId.set(
          operation.previousSelection[operation.previousSelection.length - 1]
        );
      }
      break;

    case "CLEAR_SELECTION":
      // Undo clear = restore previous selection
      selectionState$.selectedMomentIds.set(operation.previousSelection);
      if (operation.previousSelection.length > 0) {
        selectionState$.lastSelectedId.set(
          operation.previousSelection[operation.previousSelection.length - 1]
        );
      }
      break;

    case "SELECT_ALL":
      // Undo select all = restore previous selection
      selectionState$.selectedMomentIds.set(operation.previousSelection);
      if (operation.previousSelection.length > 0) {
        selectionState$.lastSelectedId.set(
          operation.previousSelection[operation.previousSelection.length - 1]
        );
      }
      break;

    default:
      console.warn(
        "[History] Unknown operation type for inverse:",
        (operation as any).type
      );
  }
}
