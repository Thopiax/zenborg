import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { Moment } from "@/domain/entities/Moment";
import { createMoment } from "@/domain/entities/Moment";
import { moments$ } from "@/infrastructure/state/store";
import { selectionState$ } from "@/infrastructure/state/selection";
import { useFocusManager } from "./useFocusManager";
import { useSelection } from "./useSelection";

/**
 * Global keyboard shortcuts - Linear style with Vim navigation
 *
 * CRUD (Linear-style, always active):
 * - M: Create new moment
 * - A: Change area for focused moment
 * - Enter: Edit focused moment
 * - Delete: Delete focused moment
 * - Mod+Backspace: Delete all selected moments
 *
 * Selection:
 * - Shift+click / Cmd+click: Toggle moment selection
 * - Mod+A: Select all moments
 * - Escape: Clear selection
 *
 * Navigation (Vim-style):
 * - j/k (↓/↑): Navigate moments vertically
 * - h/l (←/→): Navigate moments horizontally
 * - w/b: Next/previous moment
 * - gg/G: First/last moment
 *
 * Clipboard (Vim-style):
 * - yy: Yank (copy) moment
 * - p: Paste yanked moment
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

  const { deleteSelected } = useSelection();

  // UI state for CRUD operations
  const [isAreaSelectorOpen, setIsAreaSelectorOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [prefilledDay, setPrefilledDay] = useState<string | undefined>();
  const [prefilledPhase, setPrefilledPhase] = useState<string | undefined>();
  const [isEditCardOpen, setIsEditCardOpen] = useState(false);
  const [editingMomentId, setEditingMomentId] = useState<string | null>(null);

  // Yank buffer for copy/paste
  const [yankBuffer, setYankBuffer] = useState<Moment | null>(null);

  // Disable global shortcuts when any modal is open to allow typing
  const globalShortcutsEnabled =
    !isEditCardOpen && !isAreaSelectorOpen && !isCreateModalOpen;

  // ==================== GLOBAL SHORTCUTS ====================

  // Escape - close any open modals
  useHotkeys(
    "escape",
    (e) => {
      if (isCreateModalOpen) {
        e.preventDefault();
        setIsCreateModalOpen(false);
      } else if (isEditCardOpen) {
        e.preventDefault();
        setIsEditCardOpen(false);
        setEditingMomentId(null);
      } else if (isAreaSelectorOpen) {
        e.preventDefault();
        setIsAreaSelectorOpen(false);
      }
    },
    { enableOnFormTags: true }
  );

  // ==================== CRUD SHORTCUTS (Linear-style) ====================

  // M (Shift+m) - Create new moment
  useHotkeys(
    "shift+m",
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
      setIsAreaSelectorOpen(true);
    },
    { enabled: globalShortcutsEnabled }
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
        const allMoments = moments$.peek();
        const { [focusedMomentId]: _, ...rest } = allMoments;
        moments$.set(rest);
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
        // Delete from store (remove the key from the record)
        const allMoments = moments$.peek();
        const { [focusedMomentId]: _, ...rest } = allMoments;
        moments$.set(rest);
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
        // Delete from store (remove the key from the record)
        const allMoments = moments$.peek();
        const { [focusedMomentId]: _, ...rest } = allMoments;
        moments$.set(rest);
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

  // p - put (paste) yanked moment
  useHotkeys(
    "p",
    () => {
      if (!yankBuffer) return;

      const result = createMoment(yankBuffer.name, yankBuffer.areaId);
      if (!("error" in result)) {
        moments$[result.id].set(result);
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
        moments$[focusedMomentId].set({
          ...moment,
          day: null,
          phase: null,
          order: 0,
          updatedAt: new Date().toISOString(),
        });
      }
    },
    { enabled: globalShortcutsEnabled }
  );

  // ==================== HELPER FUNCTIONS ====================

  const updateMomentArea = (momentId: string, newAreaId: string) => {
    const moment = moments$[momentId].peek();
    if (moment) {
      moments$[momentId].areaId.set(newAreaId);
      moments$[momentId].updatedAt.set(new Date().toISOString());
    }
    setIsAreaSelectorOpen(false);
  };

  const handleCreateMoment = (name: string, areaId: string) => {
    // Create new moment
    const result = createMoment(name, areaId);
    if (!("error" in result)) {
      // If day/phase were prefilled, allocate the moment
      if (prefilledDay && prefilledPhase) {
        moments$[result.id].set({
          ...result,
          day: prefilledDay,
          phase: prefilledPhase as any, // Type assertion needed
          order: 0, // Will be adjusted by DnD
        });
      } else {
        moments$[result.id].set(result);
      }
      focusMoment(result.id);
    }
    setIsCreateModalOpen(false);
    setPrefilledDay(undefined);
    setPrefilledPhase(undefined);
  };

  const handleCancelCreate = () => {
    setIsCreateModalOpen(false);
    setPrefilledDay(undefined);
    setPrefilledPhase(undefined);
  };

  const handleOpenCreateModal = (day?: string, phase?: string) => {
    setPrefilledDay(day);
    setPrefilledPhase(phase);
    setIsCreateModalOpen(true);
  };

  const handleSaveEdit = (name: string, areaId: string) => {
    if (editingMomentId) {
      // Update existing moment
      const moment = moments$[editingMomentId].peek();
      if (moment) {
        moments$[editingMomentId].name.set(name);
        moments$[editingMomentId].areaId.set(areaId);
        moments$[editingMomentId].updatedAt.set(new Date().toISOString());
      }
    }
    setIsEditCardOpen(false);
    setEditingMomentId(null);
  };

  const handleCancelEdit = () => {
    setIsEditCardOpen(false);
    setEditingMomentId(null);
  };

  const handleOpenEditModal = (momentId: string) => {
    setEditingMomentId(momentId);
    setIsEditCardOpen(true);
  };

  // Return state and helpers for components
  return {
    isAreaSelectorOpen,
    setIsAreaSelectorOpen,
    updateMomentArea,
    focusedMomentId,
    // Create modal state
    isCreateModalOpen,
    handleCreateMoment,
    handleCancelCreate,
    handleOpenCreateModal,
    // Edit card state
    isEditCardOpen,
    editingMomentId,
    handleSaveEdit,
    handleCancelEdit,
    handleOpenEditModal,
  };
}
