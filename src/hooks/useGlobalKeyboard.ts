import { useEffect } from "react";
import { VimMode } from "@/infrastructure/state/vim-mode";
import { useVimMode } from "./useVimMode";

/**
 * Global keyboard event handler for Vim mode
 *
 * Listens for keyboard events and triggers mode transitions:
 * - i (Normal) → INSERT mode
 * - : (Normal) → COMMAND mode
 * - Esc (any mode) → NORMAL mode
 * - Ctrl+C (any mode) → NORMAL mode
 * - Enter (Command) → Execute command and return to NORMAL
 *
 * Note: Navigation keys (hjkl, dd, yy, etc.) will be added in Phase 4
 */
export function useGlobalKeyboard() {
  const {
    mode,
    commandInput,
    enterInsertMode,
    enterCommandMode,
    enterNormalMode,
    executeCommand,
  } = useVimMode();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept if typing in an input (except in COMMAND mode)
      // In COMMAND mode, we want to intercept Enter and Escape
      if (e.target instanceof HTMLInputElement && mode !== VimMode.COMMAND) {
        return;
      }

      // Don't intercept if typing in a textarea
      if (e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Escape - always return to NORMAL mode
      if (e.key === "Escape") {
        e.preventDefault();
        enterNormalMode();
        return;
      }

      // Ctrl+C - always return to NORMAL mode (Vim convention)
      if (e.ctrlKey && e.key === "c") {
        e.preventDefault();
        enterNormalMode();
        return;
      }

      // Mode-specific handlers
      if (mode === VimMode.NORMAL) {
        // i - enter INSERT mode
        if (e.key === "i") {
          e.preventDefault();
          enterInsertMode();
          return;
        }

        // : - enter COMMAND mode
        if (e.key === ":") {
          e.preventDefault();
          enterCommandMode();
          return;
        }

        // Navigation keys (hjkl, gg, G, w, b) will be added in Phase 4
        // Quick actions (dd, yy, x, p) will be added in Phase 4
      }

      if (mode === VimMode.COMMAND) {
        // Enter - execute command
        if (e.key === "Enter") {
          e.preventDefault();
          executeCommand(commandInput);
          enterNormalMode();
          return;
        }

        // Don't prevent other keys - let the input handle them
      }

      // INSERT mode - let the form inputs handle everything
      // We only intercept Escape and Ctrl+C (handled above)
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    mode,
    commandInput,
    enterInsertMode,
    enterCommandMode,
    enterNormalMode,
    executeCommand,
  ]);
}
