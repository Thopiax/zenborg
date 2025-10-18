"use client";

import { use$ } from "@legendapp/state/react";
import { Package } from "lucide-react";
import { useState } from "react";
import { AreaSelector } from "@/components/AreaSelector";
import { DnDProvider } from "@/components/DnDProvider";
import { DrawingBoard } from "@/components/DrawingBoard";
import { MomentModal } from "@/components/MomentModal";
import { ResetButton } from "@/components/ResetButton";
import { Timeline } from "@/components/Timeline";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { MomentManagerProvider } from "@/contexts/MomentManagerContext";
import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import { useGlobalSelection } from "@/hooks/useGlobalSelection";
import { moments$, unallocatedMoments$ } from "@/infrastructure/state/store";

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

  // Drawer state for drawing board
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Get unallocated moments count for badge
  const unallocated = use$(unallocatedMoments$);
  const unallocatedCount = unallocated.length;

  return (
    <MomentManagerProvider
      handleOpenCreateModal={handleOpenCreateModal}
      handleOpenEditModal={handleOpenEditModal}
    >
      <DnDProvider>
        <div className="min-h-screen bg-background transition-colors flex flex-col items-center justify-center">
          {/* Header */}
          {/* <header className="border-b border-border bg-surface">
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
      </header> */}

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
            {/* Timeline takes full width now */}
            <Timeline />
          </main>

          {/* Reset Button - Fixed top-right */}
          <ResetButton />

          {/* Drawing Board Drawer - Fixed Button */}
          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerTrigger asChild>
              <button
                type="button"
                className="fixed bottom-6 right-6 z-40 rounded-full bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 shadow-lg hover:shadow-xl transition-all p-4 hover:scale-105"
                aria-label="Open drawing board"
              >
                <Package className="w-6 h-6" />
                {unallocatedCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {unallocatedCount}
                  </span>
                )}
              </button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85vh]">
              <DrawerHeader>
                <DrawerTitle>Drawing Board</DrawerTitle>
                <DrawerDescription>
                  Unallocated moments ready to be scheduled
                </DrawerDescription>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-8">
                <DrawingBoard />
              </div>
            </DrawerContent>
          </Drawer>

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
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
          />
        </div>
      </DnDProvider>
    </MomentManagerProvider>
  );
}
