import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { Moment } from "@/domain/entities/Moment";
import { createMoment } from "@/domain/entities/Moment";
import { selectionState$ } from "@/infrastructure/state/selection";
import {
  moments$,
  updateMomentWithHistory,
  createMomentWithHistory,
  deleteMomentWithHistory,
  allocateMomentWithHistory,
  unallocateMomentWithHistory,
} from "@/infrastructure/state/store";
import { drawingBoardExpanded$ } from "@/infrastructure/state/ui-store";
import { useFocusManager } from "./useFocusManager";
import { useHistory } from "./useHistory";
import { useSelection } from "./useSelection";

/**
 * Global keyboard shortcuts - Linear style
 *
 * CRUD (Linear-style, always active):
 * - N: Create new moment
 * - Shift+A: Change area for focused moment
 * - Mod+Shift+A: Open area management
 * - Enter: Edit focused moment
 * - Delete: Delete focused moment
 * - Mod+Backspace: Delete all selected moments
 * - D: Duplicate all selected moments
 *
 * Moment Form (when creating/editing):
 * - A: Open area selector (1-9 to quick select)
 * - P: Open phase selector (M/A/E for Morning/Afternoon/Evening)
 * - C: Open cycle selector (1-7 to quick select)
 * - Tab: Cycle through areas
 * - Enter: Save moment
 *
 * Selection:
 * - Shift+click / Cmd+click: Toggle moment selection
 * - Mod+A: Select all moments
 * - Escape: Clear selection
 *
 * History (Undo/Redo):
 * - Mod+Z: Undo last operation
 * - Mod+Shift+Z / Mod+Y: Redo last undone operation
 *
 * Navigation:
 * - j/k (↓/↑): Navigate moments vertically
 * - h/l (←/→): Navigate moments horizontally
 * - w/b: Next/previous moment
 * - gg/G: First/last moment
 *
 * Views:
 * - P: Toggle Planning (Drawing Board) (when no form open)
 *
 * Clipboard:
 * - yy: Yank (copy) moment
 * - Shift+P: Paste yanked moment
 * - dd: Delete focused moment
 * - x: Quick delete (unallocated moments only)
 * - Backspace: Unallocate focused moment (return to drawing board)
 */
export function useGlobalKeyboard() {
  const {
    focusedMomentId,
    focusMoment,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
  } = useFocusManager();

  const { deleteSelected, duplicateSelected } = useSelection();
  const { undo, redo, canUndo, canRedo } = useHistory();

  // UI state for CRUD operations
  const [isAreaSelectorOpen, setIsAreaSelectorOpen] = useState(false);
  const [areaSelectorMomentId, setAreaSelectorMomentId] = useState<
    string | null
  >(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [prefilledDay, setPrefilledDay] = useState<string | undefined>();
  const [prefilledPhase, setPrefilledPhase] = useState<string | undefined>();
  const [prefilledAreaId, setPrefilledAreaId] = useState<string | undefined>();
  const [prefilledCycle, setPrefilledCycle] = useState<string | undefined>();
  const [isEditCardOpen, setIsEditCardOpen] = useState(false);
  const [editingMomentId, setEditingMomentId] = useState<string | null>(null);
  const [isAreaManagementOpen, setIsAreaManagementOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Yank buffer for copy/paste
  const [yankBuffer, setYankBuffer] = useState<Moment | null>(null);

  // Disable global shortcuts when any modal is open to allow typing
  const globalShortcutsEnabled =
    !isEditCardOpen &&
    !isAreaSelectorOpen &&
    !isCreateModalOpen &&
    !isAreaManagementOpen &&
    !isSettingsOpen;

  // ==================== GLOBAL SHORTCUTS ====================

  // Escape - close area selector only
  // Note: Create/Edit modals handle their own Escape behavior
  useHotkeys(
    "escape",
    (e) => {
      if (isAreaSelectorOpen) {
        e.preventDefault();
        setIsAreaSelectorOpen(false);
      }
    },
    { enableOnFormTags: true, enabled: !isCreateModalOpen && !isEditCardOpen }
  );

  // ==================== CRUD SHORTCUTS (Linear-style) ====================

  // N - Create new moment
  useHotkeys(
    "n",
    (e) => {
      e.preventDefault();
      setIsCreateModalOpen(true);
    },
    { enabled: globalShortcutsEnabled, enableOnFormTags: false }
  );

  // A (Shift+a) - Open area selector for focused moment
  useHotkeys(
    "shift+a",
    (e) => {
      if (!focusedMomentId) return;
      e.preventDefault();
      setAreaSelectorMomentId(focusedMomentId);
      setIsAreaSelectorOpen(true);
    },
    { enabled: globalShortcutsEnabled }
  );

  // Mod+Shift+A - Open area management
  useHotkeys(
    "mod+shift+a",
    (e) => {
      e.preventDefault();
      setIsAreaManagementOpen(true);
    },
    { enabled: globalShortcutsEnabled, enableOnFormTags: false }
  );

  // Mod+, - Open settings
  useHotkeys(
    "mod+comma",
    (e) => {
      e.preventDefault();
      setIsSettingsOpen(true);
    },
    { enabled: globalShortcutsEnabled, enableOnFormTags: false }
  );

  // P - Toggle Planning (Drawing Board)
  useHotkeys(
    "p",
    (e) => {
      e.preventDefault();
      drawingBoardExpanded$.set(!drawingBoardExpanded$.peek());
    },
    { enabled: globalShortcutsEnabled, enableOnFormTags: false }
  );

  // Enter - Edit focused moment
  useHotkeys(
    "enter",
    (e) => {
      if (!focusedMomentId) return;
      e.preventDefault();
      setEditingMomentId(focusedMomentId);
      setIsEditCardOpen(true);
    },
    { enabled: globalShortcutsEnabled }
  );

  // Delete - Delete focused moment
  useHotkeys(
    "delete",
    (e) => {
      if (!focusedMomentId) return;
      e.preventDefault();

      const momentToDelete = moments$[focusedMomentId].peek();
      if (momentToDelete) {
        focusNext();
        deleteMomentWithHistory(focusedMomentId);
      }
    },
    { enabled: globalShortcutsEnabled }
  );

  // Mod+Backspace - Delete selected moments
  useHotkeys(
    "mod+backspace",
    (e) => {
      console.log("[Mod+Backspace] Triggered");
      e.preventDefault();

      // Read the current selection state inside the callback
      const selectedIds = selectionState$.selectedMomentIds.peek();
      console.log("[Mod+Backspace] Current selection:", selectedIds);

      if (selectedIds.length === 0) {
        console.log("[Mod+Backspace] No moments selected, ignoring");
        return;
      }

      console.log("[Mod+Backspace] Calling deleteSelected");
      deleteSelected();
    },
    { enabled: globalShortcutsEnabled, enableOnFormTags: false }
  );

  // D - Duplicate selected moments
  useHotkeys(
    "d",
    (e) => {
      console.log("[D] Triggered");
      e.preventDefault();

      // Read the current selection state inside the callback
      const selectedIds = selectionState$.selectedMomentIds.peek();
      console.log("[D] Current selection:", selectedIds);

      if (selectedIds.length === 0) {
        console.log("[D] No moments selected, ignoring");
        return;
      }

      console.log("[D] Calling duplicateSelected");
      duplicateSelected();
    },
    { enabled: globalShortcutsEnabled, enableOnFormTags: false }
  );

  // ==================== HISTORY (Undo/Redo) ====================

  // Mod+Z - Undo
  useHotkeys(
    "mod+z",
    (e) => {
      if (!canUndo) return;
      e.preventDefault();
      console.log("[History] Undo triggered");
      undo();
    },
    { enabled: globalShortcutsEnabled, enableOnFormTags: false }
  );

  // Mod+Shift+Z - Redo (macOS style)
  useHotkeys(
    "mod+shift+z",
    (e) => {
      if (!canRedo) return;
      e.preventDefault();
      console.log("[History] Redo triggered (Mod+Shift+Z)");
      redo();
    },
    { enabled: globalShortcutsEnabled, enableOnFormTags: false }
  );

  // Mod+Y - Redo (Windows/Linux style)
  useHotkeys(
    "mod+y",
    (e) => {
      if (!canRedo) return;
      e.preventDefault();
      console.log("[History] Redo triggered (Mod+Y)");
      redo();
    },
    { enabled: globalShortcutsEnabled, enableOnFormTags: false }
  );

  // ==================== NORMAL MODE - NAVIGATION ====================

  // j / ↓ - next moment
  useHotkeys("j, down", () => focusNext(), { enabled: globalShortcutsEnabled });

  // k / ↑ - previous moment
  useHotkeys("k, up", () => focusPrevious(), {
    enabled: globalShortcutsEnabled,
  });

  // w - next moment (word forward)
  useHotkeys("w", () => focusNext(), { enabled: globalShortcutsEnabled });

  // b - previous moment (word backward)
  useHotkeys("b", () => focusPrevious(), { enabled: globalShortcutsEnabled });

  // gg - first moment
  useHotkeys("g g", () => focusFirst(), { enabled: globalShortcutsEnabled });

  // G (Shift+g) - last moment
  useHotkeys("shift+g", () => focusLast(), { enabled: globalShortcutsEnabled });

  // ==================== CLIPBOARD (Vim-style) ====================

  // dd - delete focused moment
  useHotkeys(
    "d d",
    () => {
      if (!focusedMomentId) return;

      const momentToDelete = moments$[focusedMomentId].peek();
      if (momentToDelete) {
        // Focus next moment before deleting
        focusNext();
        // Delete with history tracking
        deleteMomentWithHistory(focusedMomentId);
      }
    },
    { enabled: globalShortcutsEnabled }
  );

  // x - quick delete (only unallocated moments)
  useHotkeys(
    "x",
    () => {
      if (!focusedMomentId) return;

      const moment = moments$[focusedMomentId].peek();
      if (moment && moment.day === null) {
        focusNext();
        // Delete with history tracking
        deleteMomentWithHistory(focusedMomentId);
      }
    },
    { enabled: globalShortcutsEnabled }
  );

  // yy - yank (copy) focused moment
  useHotkeys(
    "y y",
    () => {
      if (!focusedMomentId) return;

      const moment = moments$[focusedMomentId].peek();
      if (moment) {
        setYankBuffer(moment);
        // TODO: Show visual feedback (toast or subtle indicator)
      }
    },
    { enabled: globalShortcutsEnabled }
  );

  // Shift+P - put (paste) yanked moment
  useHotkeys(
    "shift+p",
    () => {
      if (!yankBuffer) return;

      const result = createMoment(
        yankBuffer.name,
        yankBuffer.areaId,
        yankBuffer.cycle
      );
      if (!("error" in result)) {
        createMomentWithHistory(result);
        focusMoment(result.id);
      }
    },
    { enabled: globalShortcutsEnabled }
  );

  // Backspace - unallocate focused moment (return to drawing board)
  useHotkeys(
    "backspace",
    () => {
      if (!focusedMomentId) return;

      const moment = moments$[focusedMomentId].peek();
      if (moment && moment.day !== null) {
        unallocateMomentWithHistory(focusedMomentId);
      }
    },
    { enabled: globalShortcutsEnabled }
  );

  // ==================== HELPER FUNCTIONS ====================

  const updateMomentArea = (momentId: string, newAreaId: string) => {
    updateMomentWithHistory(momentId, { areaId: newAreaId });
    setIsAreaSelectorOpen(false);
    setAreaSelectorMomentId(null);
  };

  const handleCreateMoment = (
    name: string,
    areaId: string,
    cycle: import("@/domain/entities/Moment").Cycle | null,
    phase: import("@/domain/value-objects/Phase").Phase | null,
    createMore?: boolean
  ) => {
    // Create new moment with cycle
    const result = createMoment(name, areaId, cycle);
    if (!("error" in result)) {
      // Create moment with history tracking
      createMomentWithHistory(result);

      // If day/phase were prefilled from timeline click, allocate the moment
      if (prefilledDay && prefilledPhase) {
        allocateMomentWithHistory(
          result.id,
          prefilledDay,
          prefilledPhase as any, // Type assertion needed
          0 // Will be adjusted by DnD
        );
      }

      focusMoment(result.id);
    }

    // Only close modal if "create more" is not enabled
    if (!createMore) {
      setIsCreateModalOpen(false);
      setPrefilledDay(undefined);
      setPrefilledPhase(undefined);
    }
    // If createMore is true, keep modal open and form will reset itself
  };

  const handleCancelCreate = () => {
    setIsCreateModalOpen(false);
    setPrefilledDay(undefined);
    setPrefilledPhase(undefined);
    setPrefilledAreaId(undefined);
    setPrefilledCycle(undefined);
  };

  const handleOpenCreateModal = (
    day?: string,
    phase?: string,
    areaId?: string,
    cycle?: string
  ) => {
    setPrefilledDay(day);
    setPrefilledPhase(phase);
    setPrefilledAreaId(areaId);
    setPrefilledCycle(cycle);
    setIsCreateModalOpen(true);
  };

  const handleSaveEdit = (
    name: string,
    areaId: string,
    cycle: import("@/domain/entities/Moment").Cycle | null,
    phase: import("@/domain/value-objects/Phase").Phase | null
  ) => {
    if (editingMomentId) {
      // Update existing moment with history tracking
      updateMomentWithHistory(editingMomentId, {
        name,
        areaId,
        cycle,
        // Note: phase is not directly updated here, it's part of allocation
      });
    }
    setIsEditCardOpen(false);
    setEditingMomentId(null);
  };

  const handleCancelEdit = () => {
    setIsEditCardOpen(false);
    setEditingMomentId(null);
  };

  const handleDeleteEdit = () => {
    if (editingMomentId) {
      // Delete the moment with history tracking
      deleteMomentWithHistory(editingMomentId);
      setIsEditCardOpen(false);
      setEditingMomentId(null);
    }
  };

  const handleOpenEditModal = (momentId: string) => {
    setEditingMomentId(momentId);
    setIsEditCardOpen(true);
  };

  // Return state and helpers for components
  return {
    isAreaSelectorOpen,
    setIsAreaSelectorOpen,
    areaSelectorMomentId,
    updateMomentArea,
    focusedMomentId,
    // Create modal state
    isCreateModalOpen,
    prefilledDay,
    prefilledPhase,
    prefilledAreaId,
    prefilledCycle,
    handleCreateMoment,
    handleCancelCreate,
    handleOpenCreateModal,
    // Edit card state
    isEditCardOpen,
    editingMomentId,
    handleSaveEdit,
    handleCancelEdit,
    handleDeleteEdit,
    handleOpenEditModal,
    // Area management state
    isAreaManagementOpen,
    setIsAreaManagementOpen,
    // Settings state
    isSettingsOpen,
    setIsSettingsOpen,
  };
}
