import { observable } from "@legendapp/state";
import { endBatch, startBatch } from "./history";
import {
  bulkDeleteMomentsWithHistory,
  clearSelectionWithHistory,
  selectMomentsWithHistory,
} from "./history-middleware";
import { moments$ } from "./store";

/**
 * Selection State - Manages moment selection for editing and bulk operations
 *
 * Design:
 * - Single click → Edit mode (if not already editing)
 * - Cmd/Ctrl + click → Toggle selection for bulk operations
 * - Shift + click → Select range from last selected to clicked
 * - Cmd/Ctrl + A → Select all visible moments
 * - Selected moments can be moved together
 * - Clear separation from Vim mode complexity
 */
export interface SelectionState {
  editingMomentId: string | null; // Currently being edited (inline)
  selectedMomentIds: string[]; // Multi-selected for bulk operations
  lastSelectedId: string | null; // For range selection with Shift+click
}

const initialSelectionState: SelectionState = {
  editingMomentId: null,
  selectedMomentIds: [],
  lastSelectedId: null,
};

/**
 * Global selection state observable
 */
export const selectionState$ = observable<SelectionState>(
  initialSelectionState
);

/**
 * Start editing a moment
 * Clears multi-selection when entering edit mode
 */
export function startEditing(momentId: string) {
  selectionState$.editingMomentId.set(momentId);
  selectionState$.selectedMomentIds.set([]);
}

/**
 * Stop editing (save or cancel handled by caller)
 */
export function stopEditing() {
  selectionState$.editingMomentId.set(null);
}

/**
 * Toggle a moment in the multi-selection array
 * Used for Cmd/Ctrl + click
 */
export function toggleSelection(momentId: string) {
  const current = selectionState$.selectedMomentIds.get();
  const index = current.indexOf(momentId);

  console.log(
    "[toggleSelection] Toggle moment:",
    momentId,
    "current selection:",
    current
  );

  if (index >= 0) {
    // Remove if already selected
    const newSelection = current.filter((id) => id !== momentId);
    console.log(
      "[toggleSelection] Removing from selection, new:",
      newSelection
    );
    selectionState$.selectedMomentIds.set(newSelection);
  } else {
    // Add if not selected
    const newSelection = [...current, momentId];
    console.log("[toggleSelection] Adding to selection, new:", newSelection);
    selectionState$.selectedMomentIds.set(newSelection);
  }

  selectionState$.lastSelectedId.set(momentId);
  // Clear editing when selecting multiple
  selectionState$.editingMomentId.set(null);
}

/**
 * Select multiple moments (for range selection with Shift+click)
 */
export function selectMultiple(momentIds: string[]) {
  selectionState$.selectedMomentIds.set(momentIds);
  if (momentIds.length > 0) {
    selectionState$.lastSelectedId.set(momentIds[momentIds.length - 1]);
  }
  selectionState$.editingMomentId.set(null);
}

/**
 * Select all moments from a list (for Cmd/Ctrl+A)
 */
export function selectAll(momentIds: string[]) {
  selectionState$.selectedMomentIds.set(momentIds);
  if (momentIds.length > 0) {
    selectionState$.lastSelectedId.set(momentIds[momentIds.length - 1]);
  }
  selectionState$.editingMomentId.set(null);
}

/**
 * Select range from last selected to clicked moment
 * Used for Shift + click
 */
export function selectRange(momentId: string, allMomentIds: string[]) {
  const lastId = selectionState$.lastSelectedId.get();

  if (!lastId) {
    // No previous selection, just select this one
    toggleSelection(momentId);
    return;
  }

  const lastIndex = allMomentIds.indexOf(lastId);
  const currentIndex = allMomentIds.indexOf(momentId);

  if (lastIndex === -1 || currentIndex === -1) {
    // One of the moments not found in the list, just toggle
    toggleSelection(momentId);
    return;
  }

  // Select all moments between last and current (inclusive)
  const start = Math.min(lastIndex, currentIndex);
  const end = Math.max(lastIndex, currentIndex);
  const rangeIds = allMomentIds.slice(start, end + 1);

  // Merge range with existing selection (don't replace)
  const current = selectionState$.selectedMomentIds.get();
  const merged = Array.from(new Set([...current, ...rangeIds]));

  selectionState$.selectedMomentIds.set(merged);
  selectionState$.lastSelectedId.set(momentId);
  selectionState$.editingMomentId.set(null);
}

/**
 * Clear all selections
 */
export function clearSelection() {
  selectionState$.selectedMomentIds.set([]);
}

/**
 * Check if a moment is selected
 */
export function isSelected(momentId: string): boolean {
  return selectionState$.selectedMomentIds.get().includes(momentId);
}

/**
 * Check if a moment is being edited
 */
export function isEditing(momentId: string): boolean {
  return selectionState$.editingMomentId.get() === momentId;
}

/**
 * Get all selected moment IDs as array
 */
export function getSelectedMomentIds(): string[] {
  return selectionState$.selectedMomentIds.get();
}

/**
 * Check if multiple moments are selected
 */
export function hasMultipleSelected(): boolean {
  return selectionState$.selectedMomentIds.get().length > 1;
}

/**
 * Delete all selected moments
 * Permanently removes them from the store and clears selection
 * Groups selection + deletion into a single history entry
 */
export function deleteSelected() {
  const selectedIds = selectionState$.selectedMomentIds.get();

  console.log("[deleteSelected] Called with selectedIds:", selectedIds);

  if (selectedIds.length === 0) {
    console.log("[deleteSelected] No moments selected, aborting");
    return;
  }

  // Batch selection state + deletion together
  startBatch();

  // Delete with history
  bulkDeleteMomentsWithHistory(selectedIds);

  // Clear selection with history
  clearSelectionWithHistory();

  endBatch(
    `Deleted ${selectedIds.length} moment${selectedIds.length > 1 ? "s" : ""}`
  );

  console.log("[deleteSelected] Deletion complete, selection cleared");
}
