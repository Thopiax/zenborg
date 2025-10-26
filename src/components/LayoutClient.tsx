"use client";

import { use$ } from "@legendapp/state/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AreaManagementModal } from "@/components/AreaManagementModal";
import { HamburgerMenuButton } from "@/components/HamburgerMenuButton";
import { PhaseSettingsModal } from "@/components/PhaseSettingsModal";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { ToolIndicator } from "@/components/ToolIndicator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { archiveArea } from "@/domain/entities/Area";
import { areas$ } from "@/infrastructure/state/store";
import {
  archiveAreaDialogState$,
  closeArchiveAreaDialog,
} from "@/infrastructure/state/ui-store";

/**
 * LayoutClient - Client-side layout components
 *
 * Provides:
 * - Tool indicator (top-right)
 * - Hamburger menu
 * - Settings drawer
 * - Area management modal
 * - Phase settings modal
 * - Archive area dialog
 * - Global keyboard shortcuts (Cmd+1/2/3)
 */
export function LayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAreaManagementOpen, setIsAreaManagementOpen] = useState(false);
  const [isPhaseSettingsOpen, setIsPhaseSettingsOpen] = useState(false);
  const [focusAreaId, setFocusAreaId] = useState<string | undefined>(undefined);

  const archiveAreaState = use$(archiveAreaDialogState$);

  // Global keyboard shortcuts for tool navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+1/2/3 for tool navigation
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      if (e.key === "1") {
        e.preventDefault();
        router.push("/plan");
      } else if (e.key === "2") {
        e.preventDefault();
        router.push("/cultivate");
      } else if (e.key === "3") {
        e.preventDefault();
        router.push("/harvest");
      }
    }
  };

  // Register global keyboard listener
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", handleKeyDown);
    window.addEventListener("keydown", handleKeyDown);
  }

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
      {children}

      {/* Tool Indicator - Fixed top-right */}
      <div
        className="fixed z-40"
        style={{
          top: "max(1rem, env(safe-area-inset-top) + 0.5rem)",
          right: "max(5rem, env(safe-area-inset-right) + 5rem)",
        }}
      >
        <ToolIndicator />
      </div>

      {/* Hamburger Menu Button - Fixed top-right with safe area support */}
      <div
        className="fixed z-40"
        style={{
          top: "max(1.5rem, env(safe-area-inset-top) + 1rem)",
          right: "max(1.5rem, env(safe-area-inset-right) + 1rem)",
        }}
      >
        <HamburgerMenuButton
          isOpen={isSettingsOpen}
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        />
      </div>

      {/* Settings Drawer - Triggered by Mod+, or hamburger menu */}
      <SettingsDrawer
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenPhaseSettings={() => {
          setIsPhaseSettingsOpen(true);
          setIsSettingsOpen(false);
        }}
        onOpenAreaManagement={() => {
          setIsAreaManagementOpen(true);
          setIsSettingsOpen(false);
        }}
      />

      {/* Area Management Modal - Triggered by Mod+Shift+A or Settings */}
      <AreaManagementModal
        open={isAreaManagementOpen}
        onClose={() => {
          setIsAreaManagementOpen(false);
          setFocusAreaId(undefined);
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
    </>
  );
}
