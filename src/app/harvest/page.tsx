"use client";

import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";

/**
 * Zenborg - Harvest Tool (Placeholder)
 *
 * Future: Reflection on completed cycles, allocation patterns
 */
export default function HarvestPage() {
  // Enable global keyboard shortcuts (including Cmd+K for command palette)
  useGlobalKeyboard();

  return (
    <div className="min-h-dvh h-dvh bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-6">
        <h1 className="text-2xl font-mono text-stone-900 dark:text-stone-100">
          Coming Soon
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 font-mono">
          The Harvest tool will provide reflection on completed cycles and
          allocation patterns.
        </p>
      </div>
    </div>
  );
}
