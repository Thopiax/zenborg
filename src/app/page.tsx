"use client";

import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import { VimModeIndicator } from "@/components/VimModeIndicator";
import { CommandLine } from "@/components/CommandLine";
import { Timeline } from "@/components/Timeline";
import { DrawingBoard } from "@/components/DrawingBoard";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Zenborg - Intention Compass
 *
 * Main planning view with:
 * - 3x3 Timeline grid (Yesterday, Today, Tomorrow × Morning, Afternoon, Evening)
 * - Drawing Board for unallocated moments
 * - Vim-style keyboard navigation
 */
export default function HomePage() {
  // Enable global keyboard shortcuts
  useGlobalKeyboard();

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground font-mono">
                Zenborg
              </h1>
              <p className="text-sm text-text-secondary">
                Where will you place your consciousness today?
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* Timeline (3x3 grid on desktop, single-day on mobile) */}
          <div>
            <Timeline />
          </div>

          {/* Drawing Board (sidebar on desktop, below on mobile) */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <DrawingBoard />
          </aside>
        </div>
      </main>

      {/* Vim Mode Indicator - bottom right */}
      <VimModeIndicator />

      {/* Command Line - bottom bar (appears in COMMAND mode) */}
      <CommandLine />
    </div>
  );
}
