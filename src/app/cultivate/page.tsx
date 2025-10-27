"use client";

import { use$, useSelector } from "@legendapp/state/react";
import { CommandPalette } from "@/components/CommandPalette";
import { DnDProvider } from "@/components/DnDProvider";
import { DrawingBoard } from "@/components/DrawingBoard";
import { LandscapePrompt } from "@/components/LandscapePrompt";
import { MomentFormDialog } from "@/components/MomentFormDialog";
import { SortModeConflictDialog } from "@/components/SortModeConflictDialog";
import { Timeline } from "@/components/Timeline";
import type { Horizon } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";
import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import { useGlobalSelection } from "@/hooks/useGlobalSelection";
import { useSelection } from "@/hooks/useSelection";
import { moments$ } from "@/infrastructure/state/store";
import { momentFormState$, isCommandPaletteOpen$ } from "@/infrastructure/state/ui-store";
import { cn } from "@/lib/utils";

/**
 * Zenborg - Cultivate Tool
 *
 * Daily practice interface:
 * - Extended timeline (horizontal scroll, 5 days)
 * - Drawing Board for unallocated moments
 * - Vim-inspired keyboard shortcuts
 * - Landscape-only mode (shows prompt in portrait)
 */
export default function CultivatePage() {
  // Enable global keyboard shortcuts
  const {
    handleCreateMoment,
    handleSaveEdit,
    handleDeleteEdit,
  } = useGlobalKeyboard();

  // Unified save handler that works for both create and edit modes
  const handleMomentFormSave = (
    name: string,
    areaId: string,
    horizon: Horizon | null,
    phase: Phase | null,
    createMore?: boolean,
    attitude?: import("@/domain/value-objects/Attitude").Attitude | null,
    tags?: string[],
    customMetric?: import("@/domain/value-objects/Attitude").CustomMetric
  ) => {
    // The hook handlers will check the mode from the store
    const mode = momentFormState$.mode.peek();
    if (mode === "create") {
      handleCreateMoment(name, areaId, horizon, phase, createMore, attitude, tags, customMetric);
    } else {
      handleSaveEdit(name, areaId, horizon, phase, attitude, tags, customMetric);
    }
  };

  // Command Palette state
  const isCommandPaletteOpen = useSelector(() => isCommandPaletteOpen$.get());

  // Get all moments for selection
  const allMoments = use$(moments$);
  useGlobalSelection(Object.keys(allMoments));

  // Selection management
  const { clearSelection, hasAnySelected } = useSelection();

  // Handle click on background to clear selection
  const handleBackgroundClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isClickOnMoment = target.closest("button[data-moment-id]");
    const isClickOnInteractive = target.closest(
      "button, a, input, select, textarea"
    );

    if (!isClickOnMoment && !isClickOnInteractive && hasAnySelected) {
      clearSelection();
    }
  };

  return (
    <DnDProvider>
      {/* Landscape Prompt - Shows on mobile portrait mode only */}
      <LandscapePrompt />

      {/* biome-ignore lint/a11y/noStaticElementInteractions: Background click to clear selection */}
      <div
        className="min-h-dvh h-dvh md:h-auto bg-background transition-colors flex flex-col overflow-hidden"
        onMouseDown={handleBackgroundClick}
      >
        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline - Takes remaining space, with safe area insets */}
          <div
            className={cn(
              "flex-1 overflow-hidden",
              "flex flex-col justify-center"
            )}
            style={{
              paddingLeft: "env(safe-area-inset-left)",
              paddingTop: "env(safe-area-inset-top)",
            }}
          >
            <Timeline />
          </div>

          {/* Drawing Board - Full-width, no safe area cropping */}
          <div className="flex-shrink-0">
            <DrawingBoard />
          </div>
        </main>

        {/* Moment Form Dialog - Reads state from UI store */}
        <MomentFormDialog
          onSave={handleMomentFormSave}
          onDelete={handleDeleteEdit}
        />

        {/* Sort Mode Conflict Dialog */}
        <SortModeConflictDialog />

        {/* Command Palette */}
        <CommandPalette
          open={isCommandPaletteOpen}
          onClose={() => isCommandPaletteOpen$.set(false)}
        />
      </div>
    </DnDProvider>
  );
}
