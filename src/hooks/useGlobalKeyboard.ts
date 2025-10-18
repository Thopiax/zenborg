import { useHotkeys } from "react-hotkeys-hook";
import { VimMode, setYankBuffer } from "@/infrastructure/state/vim-mode";
import { useVimMode } from "./useVimMode";
import { useFocusManager } from "./useFocusManager";
import { moments$ } from "@/infrastructure/state/store";
import { createMoment } from "@/domain/entities/Moment";

/**
 * Global keyboard shortcuts for Vim-style interaction
 *
 * NORMAL mode shortcuts:
 * - Navigation: j/k (↓/↑), w/b (next/prev), gg/G (first/last)
 * - Actions: dd (delete), yy (yank), p (paste), x (quick delete), i (insert)
 * - Allocation: Enter (allocate), Backspace (unallocate)
 * - Modes: : (command), i (insert)
 *
 * INSERT/COMMAND modes:
 * - Escape → NORMAL mode
 */
export function useGlobalKeyboard() {
  const {
    mode,
    commandInput,
    yankBuffer,
    enterInsertMode,
    enterCommandMode,
    enterNormalMode,
    executeCommand,
  } = useVimMode();

  const {
    focusedMomentId,
    focusMoment,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
  } = useFocusManager();

  const isNormal = mode === VimMode.NORMAL;
  const isCommand = mode === VimMode.COMMAND;

  // ==================== GLOBAL (ALL MODES) ====================

  // Escape - always return to NORMAL mode
  useHotkeys(
    "escape",
    (e) => {
      e.preventDefault();
      enterNormalMode();
    },
    { enableOnFormTags: true }
  );

  // Ctrl+C - return to NORMAL mode (Vim convention)
  useHotkeys(
    "ctrl+c",
    (e) => {
      e.preventDefault();
      enterNormalMode();
    },
    { enableOnFormTags: true }
  );

  // ==================== NORMAL MODE - NAVIGATION ====================

  // j / ↓ - next moment
  useHotkeys("j, down", () => focusNext(), { enabled: isNormal });

  // k / ↑ - previous moment
  useHotkeys("k, up", () => focusPrevious(), { enabled: isNormal });

  // w - next moment (word forward)
  useHotkeys("w", () => focusNext(), { enabled: isNormal });

  // b - previous moment (word backward)
  useHotkeys("b", () => focusPrevious(), { enabled: isNormal });

  // gg - first moment
  useHotkeys("g g", () => focusFirst(), { enabled: isNormal });

  // G (Shift+g) - last moment
  useHotkeys("shift+g", () => focusLast(), { enabled: isNormal });

  // ==================== NORMAL MODE - MODE SWITCHING ====================

  // i - enter INSERT mode (edit focused moment or create new)
  useHotkeys(
    "i",
    () => {
      if (focusedMomentId) {
        enterInsertMode(focusedMomentId);
      } else {
        enterInsertMode();
      }
    },
    { enabled: isNormal }
  );

  // : - enter COMMAND mode
  useHotkeys(
    "shift+;",
    (e) => {
      e.preventDefault();
      enterCommandMode();
    },
    { enabled: isNormal }
  );

  // ==================== NORMAL MODE - QUICK ACTIONS ====================

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
    { enabled: isNormal }
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
    { enabled: isNormal }
  );

  // yy - yank (copy) focused moment
  useHotkeys(
    "y y",
    () => {
      if (!focusedMomentId) return;

      const moment = moments$[focusedMomentId].peek();
      if (moment) {
        setYankBuffer(moment);
        // TODO: Show visual feedback (toast?)
      }
    },
    { enabled: isNormal }
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
    { enabled: isNormal }
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
    { enabled: isNormal }
  );

  // ==================== COMMAND MODE ====================

  // Enter - execute command
  useHotkeys(
    "enter",
    (e) => {
      e.preventDefault();
      executeCommand(commandInput);
      enterNormalMode();
    },
    { enabled: isCommand, enableOnFormTags: true }
  );
}
