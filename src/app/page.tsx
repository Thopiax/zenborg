"use client";

import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import { VimModeIndicator } from "@/components/VimModeIndicator";
import { CommandLine } from "@/components/CommandLine";

export default function HomePage() {
  // Enable global keyboard shortcuts
  useGlobalKeyboard();

  return (
    <div className="min-h-screen bg-stone-50 p-8">
      <h1 className="text-4xl font-bold mb-2 text-stone-900">Zenborg</h1>
      <p className="text-stone-600 mb-8">
        Phase 3: Vim Mode State Machine
      </p>

      <div className="bg-white rounded-lg border border-stone-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-4">
            <kbd className="px-2 py-1 bg-stone-100 rounded border border-stone-300 font-mono text-xs">
              i
            </kbd>
            <span className="text-stone-600">Enter INSERT mode</span>
          </div>
          <div className="flex items-center gap-4">
            <kbd className="px-2 py-1 bg-stone-100 rounded border border-stone-300 font-mono text-xs">
              :
            </kbd>
            <span className="text-stone-600">Enter COMMAND mode</span>
          </div>
          <div className="flex items-center gap-4">
            <kbd className="px-2 py-1 bg-stone-100 rounded border border-stone-300 font-mono text-xs">
              Esc
            </kbd>
            <span className="text-stone-600">Return to NORMAL mode</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Command Examples</h2>
        <div className="space-y-2 text-sm font-mono">
          <div className="flex items-center gap-4">
            <code className="text-purple-600">:ty1</code>
            <span className="text-stone-600">Allocate to Today Morning</span>
          </div>
          <div className="flex items-center gap-4">
            <code className="text-purple-600">:wy3</code>
            <span className="text-stone-600">Allocate to Tomorrow Evening</span>
          </div>
          <div className="flex items-center gap-4">
            <code className="text-purple-600">:yy2</code>
            <span className="text-stone-600">Allocate to Yesterday Afternoon</span>
          </div>
          <div className="flex items-center gap-4">
            <code className="text-purple-600">:d</code>
            <span className="text-stone-600">Unallocate (return to drawing board)</span>
          </div>
          <div className="flex items-center gap-4">
            <code className="text-purple-600">:area</code>
            <span className="text-stone-600">Open area management</span>
          </div>
          <div className="flex items-center gap-4">
            <code className="text-purple-600">:settings</code>
            <span className="text-stone-600">Open phase settings</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold mb-2">🧪 Testing Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-stone-700">
          <li>Press <kbd className="px-1 py-0.5 bg-white rounded border text-xs font-mono">i</kbd> - mode indicator should show "-- INSERT --" (blue)</li>
          <li>Press <kbd className="px-1 py-0.5 bg-white rounded border text-xs font-mono">Esc</kbd> - should return to "-- NORMAL --" (gray)</li>
          <li>Press <kbd className="px-1 py-0.5 bg-white rounded border text-xs font-mono">:</kbd> - mode indicator should show "-- COMMAND --" (purple)</li>
          <li>Command line should appear at bottom with cursor</li>
          <li>Type <code className="px-1 py-0.5 bg-white rounded border text-xs font-mono">ty1</code> - should show in command line</li>
          <li>Press <kbd className="px-1 py-0.5 bg-white rounded border text-xs font-mono">Enter</kbd> - should execute command (check console)</li>
          <li>Should return to "-- NORMAL --" mode</li>
          <li>Open DevTools Console to see command execution logs</li>
        </ol>
      </div>

      {/* Mode indicator - bottom right */}
      <VimModeIndicator />

      {/* Command line - bottom bar */}
      <CommandLine />
    </div>
  );
}
