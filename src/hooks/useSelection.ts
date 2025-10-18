import { useSelector } from "@legendapp/state/react";
import {
  clearSelection as clearSelectionAction,
  deleteSelected as deleteSelectedAction,
  selectAll as selectAllAction,
  selectionState$,
  selectMultiple as selectMultipleAction,
  selectRange as selectRangeAction,
  startEditing as startEditingAction,
  stopEditing as stopEditingAction,
  toggleSelection as toggleSelectionAction,
} from "@/infrastructure/state/selection";

/**
 * React hook for moment selection state
 *
 * Provides clean interface for:
 * - Single-click to edit
 * - Cmd/Ctrl+click to multi-select
 * - Bulk operations on selected moments
 */
export function useSelection() {
  const editingMomentId = useSelector(() =>
    selectionState$.editingMomentId.get()
  );
  const selectedMomentIds = useSelector(() =>
    Array.from(selectionState$.selectedMomentIds.get())
  );

  const startEditing = (momentId: string) => {
    startEditingAction(momentId);
  };

  const stopEditing = () => {
    stopEditingAction();
  };

  const toggleSelection = (momentId: string) => {
    toggleSelectionAction(momentId);
  };

  const selectMultiple = (momentIds: string[]) => {
    selectMultipleAction(momentIds);
  };

  const selectAll = (momentIds: string[]) => {
    selectAllAction(momentIds);
  };

  const selectRange = (momentId: string, allMomentIds: string[]) => {
    selectRangeAction(momentId, allMomentIds);
  };

  const clearSelection = () => {
    clearSelectionAction();
  };

  const deleteSelected = () => {
    deleteSelectedAction();
  };

  const isEditing = (momentId: string) => {
    return editingMomentId === momentId;
  };

  const isSelected = (momentId: string) => {
    return selectedMomentIds.includes(momentId);
  };

  const hasMultipleSelected = selectedMomentIds.length > 1;
  const hasAnySelected = selectedMomentIds.length > 0;

  return {
    // State
    editingMomentId,
    selectedMomentIds,
    hasMultipleSelected,
    hasAnySelected,

    // Actions
    startEditing,
    stopEditing,
    toggleSelection,
    selectMultiple,
    selectAll,
    selectRange,
    clearSelection,
    deleteSelected,

    // Helpers
    isEditing,
    isSelected,
  };
}
