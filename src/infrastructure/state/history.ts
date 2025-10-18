import { observable } from "@legendapp/state";
import type {
  HistoryEntry,
  HistoryOperation,
  HistoryState,
} from "@/domain/entities/HistoryEntry";
import {
  createHistoryEntry,
  getInverseOperation,
} from "@/domain/entities/HistoryEntry";

/**
 * History State Observable
 *
 * Manages undo/redo functionality with:
 * - Past stack (undo operations)
 * - Future stack (redo operations)
 * - Batching support for grouping multiple operations
 *
 * Design:
 * - Session-only (not persisted to IndexedDB)
 * - Limited to 50 entries to prevent memory bloat
 * - Operations are grouped into transactions for better UX
 */

const MAX_HISTORY_SIZE = 50;

const initialHistoryState: HistoryState = {
  past: [],
  future: [],
  currentBatch: [],
  isBatching: false,
};

/**
 * Global history state observable
 */
export const history$ = observable<HistoryState>(initialHistoryState);

/**
 * Start batching operations
 * All operations until endBatch() will be grouped into a single history entry
 */
export function startBatch() {
  console.log("[History] Starting batch");
  history$.isBatching.set(true);
  history$.currentBatch.set([]);
}

/**
 * End batching and create a history entry from all batched operations
 * @param description Optional custom description for the history entry
 */
export function endBatch(description?: string) {
  const batch = history$.currentBatch.peek();
  const isBatching = history$.isBatching.peek();

  if (!isBatching) {
    console.warn("[History] endBatch called without startBatch");
    return;
  }

  console.log("[History] Ending batch with", batch.length, "operations");

  if (batch.length > 0) {
    const entry = createHistoryEntry(batch, description);
    pushToHistory(entry);
  }

  history$.isBatching.set(false);
  history$.currentBatch.set([]);
}

/**
 * Record a history operation
 * If batching is active, adds to current batch
 * Otherwise, creates an immediate history entry
 *
 * @param operation The operation to record
 * @param description Optional custom description
 */
export function recordOperation(
  operation: HistoryOperation,
  description?: string
) {
  const isBatching = history$.isBatching.peek();

  if (isBatching) {
    // Add to current batch
    const batch = history$.currentBatch.peek();
    history$.currentBatch.set([...batch, operation]);
    console.log(
      "[History] Added operation to batch:",
      operation.type,
      "| Batch size:",
      batch.length + 1
    );
  } else {
    // Create immediate history entry
    const entry = createHistoryEntry(operation, description);
    pushToHistory(entry);
    console.log("[History] Created immediate entry:", operation.type);
  }
}

/**
 * Push a history entry to the past stack
 * Clears the future stack (standard undo/redo UX)
 * Limits history size to MAX_HISTORY_SIZE
 */
function pushToHistory(entry: HistoryEntry) {
  const past = history$.past.peek();

  // Add to past stack
  const newPast = [...past, entry];

  // Limit history size (remove oldest if needed)
  if (newPast.length > MAX_HISTORY_SIZE) {
    newPast.shift(); // Remove oldest entry
  }

  history$.past.set(newPast);

  // Clear future stack (new operation invalidates redo)
  history$.future.set([]);

  console.log(
    `[History] Pushed entry: "${entry.description}" | Past: ${newPast.length}, Future: 0`
  );
}

/**
 * Undo the last operation
 * Pops from past, applies inverse, pushes to future
 *
 * @returns The undone history entry, or null if nothing to undo
 */
export function undo(): HistoryEntry | null {
  const past = history$.past.peek();

  if (past.length === 0) {
    console.log("[History] Nothing to undo");
    return null;
  }

  const entry = past[past.length - 1];
  console.log(`[History] Undoing: "${entry.description}"`);

  // Remove from past
  history$.past.set(past.slice(0, -1));

  // Add to future
  const future = history$.future.peek();
  history$.future.set([...future, entry]);

  return entry;
}

/**
 * Redo the last undone operation
 * Pops from future, applies operation, pushes to past
 *
 * @returns The redone history entry, or null if nothing to redo
 */
export function redo(): HistoryEntry | null {
  const future = history$.future.peek();

  if (future.length === 0) {
    console.log("[History] Nothing to redo");
    return null;
  }

  const entry = future[future.length - 1];
  console.log(`[History] Redoing: "${entry.description}"`);

  // Remove from future
  history$.future.set(future.slice(0, -1));

  // Add to past
  const past = history$.past.peek();
  history$.past.set([...past, entry]);

  return entry;
}

/**
 * Check if undo is available
 */
export function canUndo(): boolean {
  return history$.past.peek().length > 0;
}

/**
 * Check if redo is available
 */
export function canRedo(): boolean {
  return history$.future.peek().length > 0;
}

/**
 * Clear all history
 * Useful for testing or when resetting the app
 */
export function clearHistory() {
  console.log("[History] Clearing all history");
  history$.past.set([]);
  history$.future.set([]);
  history$.currentBatch.set([]);
  history$.isBatching.set(false);
}

/**
 * Get history stats (for debugging/testing)
 */
export function getHistoryStats() {
  const past = history$.past.peek();
  const future = history$.future.peek();

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    pastCount: past.length,
    futureCount: future.length,
    isBatching: history$.isBatching.peek(),
    currentBatchSize: history$.currentBatch.peek().length,
  };
}

/**
 * Helper for executing a function within a batch context
 * Automatically starts and ends batch
 *
 * @param fn Function to execute within batch
 * @param description Optional custom description for the batch
 */
export async function withBatch<T>(
  fn: () => T | Promise<T>,
  description?: string
): Promise<T> {
  startBatch();
  try {
    const result = await fn();
    endBatch(description);
    return result;
  } catch (error) {
    // If error occurs, still end batch but don't record
    history$.isBatching.set(false);
    history$.currentBatch.set([]);
    throw error;
  }
}
