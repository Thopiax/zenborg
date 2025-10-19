"use client";

import { use$ } from "@legendapp/state/react";
import { useEffect, useState } from "react";
import { AreaManagementModal } from "@/components/AreaManagementModal";
import { ConfirmableAction } from "@/components/ConfirmableAction";
import { DnDProvider } from "@/components/DnDProvider";
import { DrawingBoard } from "@/components/DrawingBoard";
import { HamburgerMenuButton } from "@/components/HamburgerMenuButton";
import { HomeScreen } from "@/components/HomeScreen";
import { LandscapePrompt } from "@/components/LandscapePrompt";
import { MomentFormDialog } from "@/components/MomentFormDialog";
import { PhaseSettingsModal } from "@/components/PhaseSettingsModal";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { Timeline } from "@/components/Timeline";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MomentManagerProvider } from "@/contexts/MomentManagerContext";
import { archiveArea, hasAreaMoments } from "@/domain/entities/Area";
import type { Horizon } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";
import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import { useGlobalSelection } from "@/hooks/useGlobalSelection";
import { useSelection } from "@/hooks/useSelection";
import { areas$, moments$ } from "@/infrastructure/state/store";
import {
  momentFormState$,
  archiveAreaDialogState$,
  closeArchiveAreaDialog,
} from "@/infrastructure/state/ui-store";
import { isPWA } from "@/lib/pwa-utils";
import { cn } from "@/lib/utils";

/**
 * Zenborg - Intention Compass
 *
 * Main planning view with:
 * - 3x3 Timeline grid (Yesterday, Today, Tomorrow × Morning, Afternoon, Evening)
 * - Drawing Board for unallocated moments
 * - Simple keyboard shortcuts: M (create), A (area), Enter (edit), Delete
 *
 * Shows HomeScreen if not installed as PWA
 */
export default function HomePage() {
  // Check if app is installed as PWA
  const [isInstalledPWA, setIsInstalledPWA] = useState<boolean | null>(null);
  const [isLandscape, setIsLandscape] = useState<boolean | null>(null);

  useEffect(() => {
    // Check PWA status
    const checkPWAStatus = () => {
      setIsInstalledPWA(isPWA());
    };

    // Check orientation
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    checkPWAStatus();
    checkOrientation();

    // Listen for display mode changes (e.g., when user installs PWA)
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => checkPWAStatus();

    mediaQuery.addEventListener("change", handleDisplayModeChange);

    // Listen for orientation changes
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);
  // Enable global keyboard shortcuts and get state for modals
  const {
    handleCreateMoment,
    handleOpenCreateModal,
    handleSaveEdit,
    handleDeleteEdit,
    handleOpenEditModal,
    isAreaManagementOpen,
    setIsAreaManagementOpen,
    isSettingsOpen,
    setIsSettingsOpen,
  } = useGlobalKeyboard();

  // Unified save handler that works for both create and edit modes
  const handleMomentFormSave = (
    name: string,
    areaId: string,
    horizon: Horizon | null,
    phase: Phase | null,
    createMore?: boolean
  ) => {
    // The hook handlers will check the mode from the store
    const mode = momentFormState$.mode.peek();
    if (mode === "create") {
      handleCreateMoment(name, areaId, horizon, phase, createMore);
    } else {
      handleSaveEdit(name, areaId, horizon, phase);
    }
  };

  // Get the focused moment's current area
  const allMoments = use$(moments$);

  useGlobalSelection(Object.keys(allMoments));

  // Import clearSelection from useSelection hook
  const { clearSelection, hasAnySelected } = useSelection();

  // Phase settings modal state
  const [isPhaseSettingsOpen, setIsPhaseSettingsOpen] = useState(false);

  // Area management state for DrawingBoard
  const [focusAreaId, setFocusAreaId] = useState<string | undefined>(undefined);
  const archiveAreaState = use$(archiveAreaDialogState$);

  // Handle edit area from DrawingBoard
  const handleEditArea = (areaId: string) => {
    setFocusAreaId(areaId);
    setIsAreaManagementOpen(true);
  };

  // Archive area (simple, no double confirmation)
  const handleConfirmArchiveArea = () => {
    if (!archiveAreaState.areaId) return;

    const area = areas$.get()[archiveAreaState.areaId];
    if (!area) {
      closeArchiveAreaDialog();
      return;
    }

    // Archive the area (soft delete) - this preserves data integrity
    const archivedArea = archiveArea(area);
    areas$[archiveAreaState.areaId].set(archivedArea);

    closeArchiveAreaDialog();
  };

  // Handle click on background to clear selection
  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Clear selection if clicking outside of moment cards
    // Check if the click target is not a button (moment cards are buttons)
    // or any child of a button
    const target = e.target as HTMLElement;
    const isClickOnMoment = target.closest("button[data-moment-id]");
    const isClickOnInteractive = target.closest(
      "button, a, input, select, textarea"
    );

    if (!isClickOnMoment && !isClickOnInteractive && hasAnySelected) {
      clearSelection();
    }
  };

  // Show nothing while checking status (avoid flash)
  if (isInstalledPWA === null || isLandscape === null) {
    return null;
  }

  // Show home screen ONLY if not installed as PWA AND in portrait mode
  // Once they rotate to landscape, let them try the app
  if (!isInstalledPWA && !isLandscape) {
    return <HomeScreen />;
  }

  return (
    <MomentManagerProvider
      handleOpenCreateModal={handleOpenCreateModal}
      handleOpenEditModal={handleOpenEditModal}
    >
      <DnDProvider>
        {/* Landscape Prompt - Shows on mobile portrait mode only */}
        <LandscapePrompt />

        {/* biome-ignore lint/a11y/noStaticElementInteractions: Background click to clear selection */}
        <div
          className="min-h-screen h-screen md:h-auto bg-background transition-colors flex flex-col overflow-hidden"
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
              <DrawingBoard onEditArea={handleEditArea} />
            </div>
          </main>

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

          {/* Moment Form Dialog - Reads state from UI store */}
          <MomentFormDialog
            onSave={handleMomentFormSave}
            onDelete={handleDeleteEdit}
          />

          {/* Area Management Modal - Triggered by Mod+Shift+A or DrawingBoard edit */}
          <AreaManagementModal
            open={isAreaManagementOpen}
            onClose={() => {
              setIsAreaManagementOpen(false);
              setFocusAreaId(undefined);
            }}
            focusAreaId={focusAreaId}
          />

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

          {/* Phase Settings Modal - Opened from Settings Drawer */}
          <PhaseSettingsModal
            open={isPhaseSettingsOpen}
            onClose={() => setIsPhaseSettingsOpen(false)}
          />

          {/* PWA Install Prompt - Shows on mobile landscape when not installed */}
          <PWAInstallPrompt />

          {/* Archive Area Confirmation - Simple Dialog */}
          {archiveAreaState.open && archiveAreaState.areaName && (
            <Dialog open={true} onOpenChange={closeArchiveAreaDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Archive {archiveAreaState.areaName}?</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-stone-600 dark:text-stone-400">
                    This area will be hidden from selectors, but all moments
                    assigned to it will remain intact. You can unarchive it
                    later from Area Management.
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
        </div>
      </DnDProvider>
    </MomentManagerProvider>
  );
}
