"use client";

import { useVimMode } from "@/hooks/useVimMode";
import { VimMode } from "@/infrastructure/state/vim-mode";

/**
 * Command Line
 *
 * Bottom bar that appears in COMMAND mode
 * Shows colon prefix and accepts command input
 */
export function CommandLine() {
  const { mode, commandInput, updateCommandInput } = useVimMode();

  if (mode !== VimMode.COMMAND) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-stone-800 text-stone-50 p-2 flex items-center gap-2 font-mono text-sm z-50">
      <span className="text-purple-400">:</span>
      <input
        value={commandInput}
        onChange={(e) => updateCommandInput(e.target.value)}
        className="flex-1 bg-transparent outline-none"
        autoFocus
        placeholder="ty1, wy3, d, area, settings"
      />
    </div>
  );
}
