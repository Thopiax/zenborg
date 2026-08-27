import { useHotkeys } from "react-hotkeys-hook";
import { useSelection } from "./useSelection.ts";

/**
 * Global keyboard shortcuts for selection
 *
 * - Cmd/Ctrl+A: Select all moments in current view
 * - Escape: Clear selection
 */
export function useGlobalSelection(allMomentIds: string[]) {
  const {
    selectAll,
    clearSelection,
    deleteSelected,
    editingMomentId,
    hasAnySelected,
  } = useSelection();

  // Cmd/Ctrl+A to select all moments
  useHotkeys(
    "mod+a",
    (e) => {
      e.preventDefault();
      // Only select all if we're not currently editing
      if (!editingMomentId && allMomentIds.length > 0) {
        selectAll(allMomentIds);
      }
    },
    { enableOnFormTags: false },
    [allMomentIds, editingMomentId],
  );

  // Escape to clear selection
  useHotkeys(
    "escape",
    (e) => {
      if (hasAnySelected && !editingMomentId) {
        e.preventDefault();
        clearSelection();
      }
    },
    { enableOnFormTags: false },
    [hasAnySelected, editingMomentId],
  );

  // Backspace / Delete to remove selected moments
  useHotkeys(
    "backspace,delete",
    (e) => {
      if (hasAnySelected && !editingMomentId) {
        e.preventDefault();
        deleteSelected();
      }
    },
    { enableOnFormTags: false },
    [hasAnySelected, editingMomentId],
  );
}
