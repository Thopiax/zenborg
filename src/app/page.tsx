"use client";

import { use$ } from "@legendapp/state/react";
import { AreaManagementModal } from "@/components/AreaManagementModal";
import { AreaSelector } from "@/components/AreaSelector";
import { DnDProvider } from "@/components/DnDProvider";
import { DrawingBoard } from "@/components/DrawingBoard";
import { MomentModal } from "@/components/MomentModal";
import { SettingsModal, SettingsButton } from "@/components/SettingsModal";
import { Timeline } from "@/components/Timeline";
import { MomentManagerProvider } from "@/contexts/MomentManagerContext";
import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import { useGlobalSelection } from "@/hooks/useGlobalSelection";
import { useSelection } from "@/hooks/useSelection";
import { moments$ } from "@/infrastructure/state/store";

/**
 * Zenborg - Intention Compass
 *
 * Main planning view with:
 * - 3x3 Timeline grid (Yesterday, Today, Tomorrow × Morning, Afternoon, Evening)
 * - Drawing Board for unallocated moments
 * - Simple keyboard shortcuts: M (create), A (area), Enter (edit), Delete
 */
export default function HomePage() {
  // Enable global keyboard shortcuts and get state for modals
  const {
    isAreaSelectorOpen,
    setIsAreaSelectorOpen,
    areaSelectorMomentId,
    updateMomentArea,
    isCreateModalOpen,
    prefilledAreaId,
    prefilledHorizon,
    handleCreateMoment,
    handleCancelCreate,
    handleOpenCreateModal,
    isEditCardOpen,
    editingMomentId,
    handleSaveEdit,
    handleCancelEdit,
    handleDeleteEdit,
    handleOpenEditModal,
    isAreaManagementOpen,
    setIsAreaManagementOpen,
    isSettingsOpen,
    setIsSettingsOpen,
  } = useGlobalKeyboard();

  // Get the focused moment's current area
  const allMoments = use$(moments$);

  useGlobalSelection(Object.keys(allMoments));

  const areaSelectorMoment = areaSelectorMomentId ? allMoments[areaSelectorMomentId] : null;
  const currentAreaId = areaSelectorMoment?.areaId || "";

  // Import clearSelection from useSelection hook
  const { clearSelection, hasAnySelected } = useSelection();

  // Handle click on background to clear selection
  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Clear selection if clicking outside of moment cards
    // Check if the click target is not a button (moment cards are buttons)
    // or any child of a button
    const target = e.target as HTMLElement;
    const isClickOnMoment = target.closest('button[data-moment-id]');
    const isClickOnInteractive = target.closest('button, a, input, select, textarea');

    if (!isClickOnMoment && !isClickOnInteractive && hasAnySelected) {
      clearSelection();
    }
  };

  return (
    <MomentManagerProvider
      handleOpenCreateModal={handleOpenCreateModal}
      handleOpenEditModal={handleOpenEditModal}
    >
      <DnDProvider>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Background click to clear selection */}
        <div
          className="min-h-screen bg-background transition-colors flex flex-col"
          onMouseDown={handleBackgroundClick}
        >
          {/* Main Content */}
          <main className="flex-1 flex flex-col">
            {/* Timeline */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
              <Timeline />
            </div>

            {/* Drawing Board - Collapsible below Timeline */}
            <DrawingBoard />
          </main>

          {/* Settings Button - Fixed top-right with safe area support */}
          <div
            className="fixed z-40"
            style={{
              top: 'max(1.5rem, env(safe-area-inset-top) + 1rem)',
              right: 'max(1.5rem, env(safe-area-inset-right) + 1rem)',
            }}
          >
            <SettingsButton onClick={() => setIsSettingsOpen(true)} />
          </div>

          {/* Area Selector - Modal for changing moment area (triggered by 'A' key) */}
          {areaSelectorMomentId && (
            <AreaSelector
              open={isAreaSelectorOpen}
              selectedAreaId={currentAreaId}
              onSelectArea={(areaId) =>
                updateMomentArea(areaSelectorMomentId, areaId)
              }
              onClose={() => setIsAreaSelectorOpen(false)}
            />
          )}

          {/* Create Modal - Triggered by Shift+M */}
          <MomentModal
            open={isCreateModalOpen}
            mode="create"
            initialAreaId={prefilledAreaId}
            initialHorizon={
              prefilledHorizon ? (prefilledHorizon as any) : null
            }
            onSave={handleCreateMoment}
            onCancel={handleCancelCreate}
          />

          {/* Edit Modal - Triggered by Enter on focused moment */}
          <MomentModal
            open={isEditCardOpen}
            mode="edit"
            initialName={
              editingMomentId ? allMoments[editingMomentId]?.name : ""
            }
            initialAreaId={
              editingMomentId ? allMoments[editingMomentId]?.areaId : ""
            }
            initialHorizon={
              editingMomentId ? allMoments[editingMomentId]?.horizon ?? null : null
            }
            isAllocated={
              editingMomentId
                ? !!(allMoments[editingMomentId]?.day && allMoments[editingMomentId]?.phase)
                : false
            }
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
            onDelete={handleDeleteEdit}
          />

          {/* Area Management Modal - Triggered by Mod+Shift+A */}
          <AreaManagementModal
            open={isAreaManagementOpen}
            onClose={() => setIsAreaManagementOpen(false)}
          />

          {/* Settings Modal - Triggered by Mod+, */}
          <SettingsModal
            open={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        </div>
      </DnDProvider>
    </MomentManagerProvider>
  );
}
