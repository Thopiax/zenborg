"use client";

import { use$ } from "@legendapp/state/react";
import { AreaSelector } from "@/components/AreaSelector";
import { DnDProvider } from "@/components/DnDProvider";
import { DrawingBoard } from "@/components/DrawingBoard";
import { MomentModal } from "@/components/MomentModal";
import { ResetButton } from "@/components/ResetButton";
import { Timeline } from "@/components/Timeline";
import { MomentManagerProvider } from "@/contexts/MomentManagerContext";
import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import { useGlobalSelection } from "@/hooks/useGlobalSelection";
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
    updateMomentArea,
    focusedMomentId,
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
    handleOpenEditModal,
  } = useGlobalKeyboard();

  // Get the focused moment's current area
  const allMoments = use$(moments$);

  useGlobalSelection(Object.keys(allMoments));

  const focusedMoment = focusedMomentId ? allMoments[focusedMomentId] : null;
  const currentAreaId = focusedMoment?.areaId || "";

  return (
    <MomentManagerProvider
      handleOpenCreateModal={handleOpenCreateModal}
      handleOpenEditModal={handleOpenEditModal}
    >
      <DnDProvider>
        <div className="min-h-screen bg-background transition-colors flex flex-col">
          {/* Main Content */}
          <main className="flex-1 flex flex-col">
            {/* Timeline */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
              <Timeline />
            </div>

            {/* Drawing Board - Collapsible below Timeline */}
            <DrawingBoard />
          </main>

          {/* Reset Button - Fixed top-right */}
          <ResetButton />

          {/* Area Selector - Modal for changing moment area (triggered by 'A' key) */}
          {focusedMomentId && (
            <AreaSelector
              open={isAreaSelectorOpen}
              selectedAreaId={currentAreaId}
              onSelectArea={(areaId) =>
                updateMomentArea(focusedMomentId, areaId)
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
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
          />
        </div>
      </DnDProvider>
    </MomentManagerProvider>
  );
}
