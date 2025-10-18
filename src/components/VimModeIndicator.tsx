"use client";

import { useVimMode } from "@/hooks/useVimMode";
import { VimMode } from "@/infrastructure/state/vim-mode";

/**
 * Vim Mode Indicator
 *
 * Fixed bottom-right indicator showing current Vim mode
 * Styled with monospace font and mode-specific colors
 */
export function VimModeIndicator() {
  const { mode } = useVimMode();

  const getModeDisplay = () => {
    switch (mode) {
      case VimMode.NORMAL:
        return "-- NORMAL --";
      case VimMode.INSERT:
        return "-- INSERT --";
      case VimMode.COMMAND:
        return "-- COMMAND --";
      default:
        return "-- NORMAL --";
    }
  };

  const getModeColor = () => {
    switch (mode) {
      case VimMode.NORMAL:
        return "bg-stone-800 text-stone-50";
      case VimMode.INSERT:
        return "bg-blue-600 text-white";
      case VimMode.COMMAND:
        return "bg-purple-600 text-white";
      default:
        return "bg-stone-800 text-stone-50";
    }
  };

  return (
    <div
      className={`fixed bottom-4 right-4 px-3 py-1 rounded-full text-xs font-mono ${getModeColor()}`}
    >
      {getModeDisplay()}
    </div>
  );
}
