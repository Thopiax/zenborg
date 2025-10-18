import { useHotkeys } from "react-hotkeys-hook";
import { useSelection } from "./useSelection";

/**
 * Global keyboard shortcuts for selection
 *
 * - Cmd/Ctrl+A: Select all moments in current view
 * - Escape: Clear selection
 */
export function useGlobalSelection(allMomentIds: string[]) {
  const { selectAll, clearSelection, editingMomentId, hasAnySelected } =
    useSelection();

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
    [allMomentIds, editingMomentId]
  );

  // Escape to clear selection
  useHotkeys(
    "escape",
    (e) => {
      // Only clear selection if we have something selected and we're not editing
      if (hasAnySelected && !editingMomentId) {
        e.preventDefault();
        clearSelection();
      }
    },
    { enableOnFormTags: false },
    [hasAnySelected, editingMomentId]
  );
}
