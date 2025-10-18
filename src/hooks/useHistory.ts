import { useSelector } from "@legendapp/state/react";
import type { HistoryEntry } from "@/domain/entities/HistoryEntry";
import {
  canRedo as canRedoFn,
  canUndo as canUndoFn,
  clearHistory as clearHistoryFn,
  endBatch,
  getHistoryStats,
  history$,
  redo as redoFn,
  startBatch,
  undo as undoFn,
  withBatch as withBatchFn,
} from "@/infrastructure/state/history";
import {
  applyInverseOperation,
  applyOperation,
} from "@/infrastructure/state/history-middleware";

/**
 * React hook for history (undo/redo) functionality
 *
 * Provides:
 * - undo() / redo() functions
 * - canUndo / canRedo boolean flags
 * - withBatch() helper for grouping operations
 * - clearHistory() for testing/reset
 *
 * Usage:
 * ```tsx
 * const { undo, redo, canUndo, canRedo, withBatch } = useHistory();
 *
 * // Simple undo/redo
 * <button onClick={undo} disabled={!canUndo}>Undo</button>
 * <button onClick={redo} disabled={!canRedo}>Redo</button>
 *
 * // Batched operations
 * await withBatch(async () => {
 *   createMoment(...);
 *   allocateMoment(...);
 * }, "Create and allocate moment");
 * ```
 */
export function useHistory() {
  // Subscribe to history state for reactivity
  const canUndo = useSelector(() => history$.past.get().length > 0);
  const canRedo = useSelector(() => history$.future.get().length > 0);
  const isBatching = useSelector(() => history$.isBatching.get());

  /**
   * Undo the last operation
   */
  const undo = () => {
    const entry = undoFn();
    if (entry) {
      // Apply inverse of all operations in reverse order
      for (let i = entry.operations.length - 1; i >= 0; i--) {
        applyInverseOperation(entry.operations[i]);
      }
      console.log(`[History] Undone: "${entry.description}"`);
    }
  };

  /**
   * Redo the last undone operation
   */
  const redo = () => {
    const entry = redoFn();
    if (entry) {
      // Apply all operations in forward order
      for (const operation of entry.operations) {
        applyOperation(operation);
      }
      console.log(`[History] Redone: "${entry.description}"`);
    }
  };

  /**
   * Start batching operations
   */
  const beginBatch = () => {
    startBatch();
  };

  /**
   * End batching and create history entry
   */
  const finishBatch = (description?: string) => {
    endBatch(description);
  };

  /**
   * Execute a function within a batch context
   * Automatically starts and ends batch
   */
  const withBatch = async <T,>(
    fn: () => T | Promise<T>,
    description?: string
  ): Promise<T> => {
    return withBatchFn(fn, description);
  };

  /**
   * Clear all history (for testing/reset)
   */
  const clearHistory = () => {
    clearHistoryFn();
  };

  /**
   * Get history statistics (for debugging)
   */
  const stats = () => {
    return getHistoryStats();
  };

  return {
    // State
    canUndo,
    canRedo,
    isBatching,

    // Actions
    undo,
    redo,
    clearHistory,

    // Batching
    beginBatch,
    finishBatch,
    withBatch,

    // Debugging
    stats,
  };
}
