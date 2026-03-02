"use client";

import { use$, useSelector } from "@legendapp/state/react";
import { useState } from "react";
import { AreaManagementModal } from "@/components/AreaManagementModal";
import { CommandPalette } from "@/components/CommandPalette";
import { HamburgerMenuButton } from "@/components/HamburgerMenuButton";
import { ModeSelector } from "@/components/ModeSelector";
import { PhaseSettingsModal } from "@/components/PhaseSettingsModal";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { UpdateNotification } from "@/components/UpdateNotification";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { archiveArea } from "@/domain/entities/Area";
import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import { areas$ } from "@/infrastructure/state/store";
import {
  archiveAreaDialogState$,
  areaManagementFocusId$,
  closeArchiveAreaDialog,
  isAreaManagementOpen$,
  isCommandPaletteOpen$,
  resetCommandPaletteState,
} from "@/infrastructure/state/ui-store";

/**
 * LayoutClient - Client-side layout components
 *
 * Provides:
 * - Mode selector (top-center)
 * - Hamburger menu
 * - Settings drawer
 * - Area management modal
 * - Phase settings modal
 * - Archive area dialog
 * - Command palette (Cmd+K)
 * - Global keyboard shortcuts (Cmd+1/2/3)
 */
export function LayoutClient({ children }: { children: React.ReactNode }) {
  // Enable global keyboard shortcuts (Cmd+K, etc.) - registers once globally
  useGlobalKeyboard();

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPhaseSettingsOpen, setIsPhaseSettingsOpen] = useState(false);

  // Area management via observable (allows CommandPalette to trigger it)
  const isAreaManagementOpen = useSelector(() => isAreaManagementOpen$.get());
  const focusAreaId = useSelector(() => areaManagementFocusId$.get());

  const archiveAreaState = use$(archiveAreaDialogState$);

  // Command Palette state
  const isCommandPaletteOpen = useSelector(() => isCommandPaletteOpen$.get());

  // Archive area handler
  const handleConfirmArchiveArea = () => {
    if (!archiveAreaState.areaId) return;

    const area = areas$.get()[archiveAreaState.areaId];
    if (!area) {
      closeArchiveAreaDialog();
      return;
    }

    const archivedArea = archiveArea(area);
    areas$[archiveAreaState.areaId].set(archivedArea);

    closeArchiveAreaDialog();
  };

  return (
    <>
      <div className="h-dvh grid grid-rows-[auto_1fr]">
        {/* Top Bar - Unified navigation bar with mode selector and settings */}
        <div
          className="z-40 flex items-center justify-center bg-background"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top) + 0.25rem)",
            paddingBottom: "0.5rem",
            paddingLeft: "max(1rem, env(safe-area-inset-left) + 0.5rem)",
            paddingRight: "max(1rem, env(safe-area-inset-right) + 0.5rem)",
          }}
        >
          {/* Spacer for left balance */}
          <div className="w-8" />

          {/* Center: Mode Selector */}
          <ModeSelector />

          {/* Right: Settings button */}
          <div className="ml-2">
            <HamburgerMenuButton
              isOpen={isSettingsOpen}
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            />
          </div>
        </div>

        {/* Page Content - Contained below top bar */}
        <div className="overflow-hidden">
          {children}
        </div>
      </div>

      {/* Update Notification - Auto-checks on mount */}
      <UpdateNotification />

      {/* Settings Drawer - Triggered by Mod+, or hamburger menu */}
      <SettingsDrawer
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenPhaseSettings={() => {
          setIsPhaseSettingsOpen(true);
          setIsSettingsOpen(false);
        }}
        onOpenAreaManagement={() => {
          isAreaManagementOpen$.set(true);
          setIsSettingsOpen(false);
        }}
      />

      {/* Area Management Modal - Triggered by Mod+Shift+A, Settings, or CommandPalette */}
      <AreaManagementModal
        open={isAreaManagementOpen}
        onClose={() => {
          isAreaManagementOpen$.set(false);
          areaManagementFocusId$.set(undefined);
        }}
        focusAreaId={focusAreaId}
      />

      {/* Phase Settings Modal - Opened from Settings Drawer */}
      <PhaseSettingsModal
        open={isPhaseSettingsOpen}
        onClose={() => setIsPhaseSettingsOpen(false)}
      />

      {/* Archive Area Confirmation - Simple Dialog */}
      {archiveAreaState.open && archiveAreaState.areaName && (
        <Dialog open={true} onOpenChange={closeArchiveAreaDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive {archiveAreaState.areaName}?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                This area will be hidden from selectors, but all habits assigned
                to it will remain intact. You can unarchive it later from Area
                Management.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeArchiveAreaDialog}
                  className="px-4 py-2 rounded-lg font-mono text-sm bg-stone-200 hover:bg-stone-300 text-stone-900 dark:bg-stone-700 dark:hover:bg-stone-600 dark:text-stone-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmArchiveArea}
                  className="px-4 py-2 rounded-lg font-mono text-sm bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-200 dark:hover:bg-stone-300 dark:text-stone-900 transition-colors"
                >
                  Archive
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Command Palette - Global across all routes */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onClose={() => {
          isCommandPaletteOpen$.set(false);
          resetCommandPaletteState();
        }}
      />
    </>
  );
}
