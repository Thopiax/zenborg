"use client";

import { keyboardShortcuts } from "@/lib/design-tokens";

/**
 * Keyboard Shortcuts Help - Read-only reference
 * - Displays all Vim shortcuts organized by category
 * - Monochromatic design with monospace font for shortcuts
 * - Compact, scannable layout
 */
export function KeyboardShortcutsHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-2">
          Keyboard Shortcuts
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Vim-inspired keyboard shortcuts for efficient navigation and control.
        </p>
      </div>

      {/* Navigation */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
          Navigation
        </h4>
        <div className="space-y-2">
          {Object.entries(keyboardShortcuts.navigation).map(([key, description]) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <kbd className="px-2 py-1 text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded">
                {key}
              </kbd>
              <span className="text-xs text-stone-600 dark:text-stone-400 flex-1 text-right">
                {description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Modes */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
          Modes
        </h4>
        <div className="space-y-2">
          {Object.entries(keyboardShortcuts.modes).map(([key, description]) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <kbd className="px-2 py-1 text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded">
                {key}
              </kbd>
              <span className="text-xs text-stone-600 dark:text-stone-400 flex-1 text-right">
                {description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
          Actions
        </h4>
        <div className="space-y-2">
          {Object.entries(keyboardShortcuts.actions).map(([key, description]) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <kbd className="px-2 py-1 text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded">
                {key}
              </kbd>
              <span className="text-xs text-stone-600 dark:text-stone-400 flex-1 text-right">
                {description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Commands */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
          Commands
        </h4>
        <div className="space-y-2">
          {Object.entries(keyboardShortcuts.commands).map(([key, description]) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <kbd className="px-2 py-1 text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded">
                {key}
              </kbd>
              <span className="text-xs text-stone-600 dark:text-stone-400 flex-1 text-right">
                {description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* View */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
          View
        </h4>
        <div className="space-y-2">
          {Object.entries(keyboardShortcuts.view).map(([key, description]) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <kbd className="px-2 py-1 text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded">
                {key}
              </kbd>
              <span className="text-xs text-stone-600 dark:text-stone-400 flex-1 text-right">
                {description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="pt-4 border-t border-stone-200 dark:border-stone-700">
        <p className="text-xs text-stone-500 dark:text-stone-400 italic">
          Tip: Press <kbd className="px-1 text-xs font-mono bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded">Esc</kbd> anytime to return to NORMAL mode
        </p>
      </div>
    </div>
  );
}
