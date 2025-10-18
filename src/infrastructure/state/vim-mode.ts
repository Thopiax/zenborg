import { observable } from "@legendapp/state";
import type { Moment } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";

/**
 * Vim Mode - Modal interaction states
 *
 * NORMAL: Default mode - navigate, select, quick actions (dd, yy, p)
 * INSERT: Create/edit moments
 * COMMAND: Execute commands (:ty1, :area, :d, etc.)
 */
export enum VimMode {
  NORMAL = "normal",
  INSERT = "insert",
  COMMAND = "command",
}

/**
 * Vim State - Global state for modal interactions
 */
export interface VimState {
  mode: VimMode;
  commandInput: string; // Current command being typed (e.g., "ty1" for ":ty1")
  focusedMomentId: string | null; // Currently focused moment
  focusedCell: { day: string; phase: Phase } | null; // Currently focused timeline cell
  yankBuffer: Moment | null; // Copied moment for yy/p (duplicate)
}

/**
 * Initial Vim state
 */
const initialVimState: VimState = {
  mode: VimMode.NORMAL,
  commandInput: "",
  focusedMomentId: null,
  focusedCell: null,
  yankBuffer: null,
};

/**
 * Global Vim state observable
 */
export const vimState$ = observable<VimState>(initialVimState);

/**
 * Enter INSERT mode
 * @param momentId - If provided, edit this moment; otherwise create new
 */
export function enterInsertMode(momentId?: string) {
  vimState$.mode.set(VimMode.INSERT);
  if (momentId) {
    vimState$.focusedMomentId.set(momentId);
  }
}

/**
 * Enter COMMAND mode
 * Clears any previous command input
 */
export function enterCommandMode() {
  vimState$.mode.set(VimMode.COMMAND);
  vimState$.commandInput.set("");
}

/**
 * Enter NORMAL mode
 * Clears command input and temporary state
 */
export function enterNormalMode() {
  vimState$.mode.set(VimMode.NORMAL);
  vimState$.commandInput.set("");
}

/**
 * Update command input
 * @param input - New command input value
 */
export function updateCommandInput(input: string) {
  vimState$.commandInput.set(input);
}

/**
 * Set focused moment
 * @param momentId - Moment to focus, or null to clear
 */
export function setFocusedMoment(momentId: string | null) {
  vimState$.focusedMomentId.set(momentId);
}

/**
 * Set focused cell
 * @param cell - Timeline cell to focus, or null to clear
 */
export function setFocusedCell(cell: { day: string; phase: Phase } | null) {
  vimState$.focusedCell.set(cell);
}

/**
 * Set yank buffer (for yy/p duplicate functionality)
 * @param moment - Moment to copy, or null to clear
 */
export function setYankBuffer(moment: Moment | null) {
  vimState$.yankBuffer.set(moment);
}

/**
 * Reset Vim state to initial values
 */
export function resetVimState() {
  vimState$.mode.set(VimMode.NORMAL);
  vimState$.commandInput.set("");
  vimState$.focusedMomentId.set(null);
  vimState$.focusedCell.set(null);
  vimState$.yankBuffer.set(null);
}
