import { useSelector } from "@legendapp/state/react";
import {
  VimMode,
  vimState$,
  enterInsertMode as enterInsertModeAction,
  enterCommandMode as enterCommandModeAction,
  enterNormalMode as enterNormalModeAction,
  updateCommandInput as updateCommandInputAction,
  setFocusedMoment,
  setFocusedCell,
  setYankBuffer,
} from "@/infrastructure/state/vim-mode";
import {
  parseCommand,
  isCommandError,
  type Command,
} from "@/infrastructure/state/command-parser";
import type { Moment } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";

/**
 * React hook for interacting with Vim mode state
 *
 * Provides reactive access to current mode and helper functions
 * for mode transitions and command execution.
 */
export function useVimMode() {
  const mode = useSelector(() => vimState$.mode.get());
  const commandInput = useSelector(() => vimState$.commandInput.get());
  const focusedMomentId = useSelector(() => vimState$.focusedMomentId.get());
  const focusedCell = useSelector(() => vimState$.focusedCell.get());
  const yankBuffer = useSelector(() => vimState$.yankBuffer.get());

  /**
   * Enter INSERT mode
   * @param momentId - If provided, edit this moment; otherwise create new
   */
  const enterInsertMode = (momentId?: string) => {
    enterInsertModeAction(momentId);
  };

  /**
   * Enter COMMAND mode
   */
  const enterCommandMode = () => {
    enterCommandModeAction();
  };

  /**
   * Enter NORMAL mode
   */
  const enterNormalMode = () => {
    enterNormalModeAction();
  };

  /**
   * Update command input
   * @param input - New command input value
   */
  const updateCommandInput = (input: string) => {
    updateCommandInputAction(input);
  };

  /**
   * Execute a command
   * @param input - Command string (without leading colon)
   */
  const executeCommand = (input: string): Command | { error: string } => {
    const result = parseCommand(input);

    if (isCommandError(result)) {
      console.error("Command error:", result.error);
      return result;
    }

    // For now, just log the command - actual execution will be wired up in Phase 7
    console.log("Executing command:", result);

    return result;
  };

  /**
   * Set focused moment
   */
  const updateFocusedMoment = (momentId: string | null) => {
    setFocusedMoment(momentId);
  };

  /**
   * Set focused cell
   */
  const updateFocusedCell = (cell: { day: string; phase: Phase } | null) => {
    setFocusedCell(cell);
  };

  /**
   * Set yank buffer
   */
  const updateYankBuffer = (moment: Moment | null) => {
    setYankBuffer(moment);
  };

  return {
    // State (unwrapped values from useSelector)
    mode,
    commandInput,
    focusedMomentId,
    focusedCell,
    yankBuffer,

    // Mode helpers
    isNormalMode: mode === VimMode.NORMAL,
    isInsertMode: mode === VimMode.INSERT,
    isCommandMode: mode === VimMode.COMMAND,

    // Actions
    enterInsertMode,
    enterCommandMode,
    enterNormalMode,
    updateCommandInput,
    executeCommand,
    updateFocusedMoment,
    updateFocusedCell,
    updateYankBuffer,
  };
}
