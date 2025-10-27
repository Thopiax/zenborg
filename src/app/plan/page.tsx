"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { observer, use$ } from "@legendapp/state/react";
import { useState } from "react";
import { HabitService } from "@/application/services/HabitService";
import { EmptyAreaCard } from "@/components/EmptyAreaCard";
import { HabitFormDialog } from "@/components/HabitFormDialog";
import { LandscapePrompt } from "@/components/LandscapePrompt";
import { SortableAreaCard } from "@/components/SortableAreaCard";
import type { Area } from "@/domain/entities/Area";
import { archiveArea, canDeleteArchivedArea, createArea, unarchiveArea, updateArea } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import {
  activeAreas$,
  activeHabits$,
  archivedAreas$,
  areas$,
  moments$,
} from "@/infrastructure/state/store";

/**
 * Plan Tool - Habit Design Interface
 *
 * Features:
 * - Grid of area cards with habits
 * - Editable area properties (emoji, name, color)
 * - Create/edit/archive habits
 * - Habits grouped by area
 */
const PlanPage = observer(() => {
  const habitService = new HabitService();

  // Enable global keyboard shortcuts (including Cmd+K for command palette)
  useGlobalKeyboard();

  // Get active areas and habits
  const areas = use$(activeAreas$);
  const habits = use$(activeHabits$);
  const archivedAreas = use$(archivedAreas$);

  // Sort areas by order property (ascending)
  const sortedAreas = [...areas].sort((a, b) => a.order - b.order);

  // Configure sensors for drag interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4, // 4px drag threshold
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 150ms hold for touch
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // UI state
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false);
  const [deleteConfirmAreaId, setDeleteConfirmAreaId] = useState<string | null>(null);

  // Habit form state
  const [habitFormOpen, setHabitFormOpen] = useState(false);
  const [habitFormMode, setHabitFormMode] = useState<"create" | "edit">(
    "create"
  );
  const [editingHabitId, setEditingHabitId] = useState<string | undefined>();
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  // Get editing habit data
  const editingHabit = editingHabitId
    ? habits.find((h) => h.id === editingHabitId)
    : undefined;

  // Group habits by area
  const habitsByArea = habits.reduce((acc, habit) => {
    if (!acc[habit.areaId]) {
      acc[habit.areaId] = [];
    }
    acc[habit.areaId].push(habit);
    return acc;
  }, {} as Record<string, Habit[]>);

  // Handle create area
  const handleCreateArea = (name: string, emoji: string, color: string) => {
    // Calculate next order (max order + 1)
    const maxOrder = areas.length > 0
      ? Math.max(...areas.map((a) => a.order))
      : -1;
    const order = maxOrder + 1;

    const result = createArea({
      name,
      emoji,
      color,
      tags: [],
      attitude: null,
      order,
    });

    if ("error" in result) {
      console.error("Failed to create area:", result.error);
      return;
    }

    areas$[result.id].set(result);
  };

  // Handle update area
  const handleUpdateArea = (areaId: string, updates: Partial<Area>) => {
    const area = areas$.get()[areaId];
    if (!area) return;

    const result = updateArea(area, updates);
    if ("error" in result) {
      console.error("Failed to update area:", result.error);
      return;
    }

    areas$[areaId].set(result);
  };

  // Handle archive area
  const handleArchiveArea = (areaId: string) => {
    const area = areas$.get()[areaId];
    if (!area) return;

    const archivedArea = archiveArea(area);
    areas$[areaId].set(archivedArea);
  };

  // Handle unarchive area
  const handleUnarchiveArea = (areaId: string) => {
    const area = areas$.get()[areaId];
    if (!area) return;

    const unarchivedArea = unarchiveArea(area);
    areas$[areaId].set(unarchivedArea);
  };

  // Handle delete archived area (with confirmation)
  const handleDeleteArea = (areaId: string) => {
    const area = areas$.get()[areaId];
    if (!area) return;

    const allMoments = Object.values(moments$.get());

    // Check if deletion is allowed
    if (!canDeleteArchivedArea(area, allMoments)) {
      alert("Cannot delete area: it has moments assigned to it or is not archived.");
      return;
    }

    // Delete from store
    areas$[areaId].delete();
    setDeleteConfirmAreaId(null);
  };

  // Handle create habit
  const handleCreateHabit = (areaId: string) => {
    setSelectedAreaId(areaId);
    setHabitFormMode("create");
    setEditingHabitId(undefined);
    setHabitFormOpen(true);
  };

  // Handle edit habit
  const handleEditHabit = (habitId: string) => {
    const habit = habits.find((h) => h.id === habitId);
    if (habit) {
      setSelectedAreaId(habit.areaId);
      setHabitFormMode("edit");
      setEditingHabitId(habitId);
      setHabitFormOpen(true);
    }
  };

  // Handle archive habit
  const handleArchiveHabit = (habitId: string) => {
    habitService.archiveHabit(habitId);
  };

  // Handle save habit (create or update)
  const handleSaveHabit = (
    name: string,
    areaId: string,
    emoji: string,
    tags: string[]
  ) => {
    if (habitFormMode === "create") {
      habitService.createHabit({
        name,
        areaId,
        emoji,
        tags,
        attitude: null,
        order: 0,
      });
    } else if (editingHabitId) {
      habitService.updateHabit(editingHabitId, {
        name,
        emoji,
        tags,
      });
    }
    setHabitFormOpen(false);
  };

  // Handle quick habit creation (inline input)
  const handleQuickCreateHabit = (name: string, areaId: string) => {
    // Get area to use its emoji
    const area = areas.find((a) => a.id === areaId);
    const emoji = area?.emoji || "⭐";

    // Calculate next order (max order + 1 for habits in this area)
    const areaHabits = habitsByArea[areaId] || [];
    const maxOrder = areaHabits.length > 0
      ? Math.max(...areaHabits.map((h) => h.order))
      : -1;
    const order = maxOrder + 1;

    habitService.createHabit({
      name,
      areaId,
      emoji,
      tags: [],
      attitude: null,
      order,
    });
  };

  // Handle delete habit (from edit form)
  const handleDeleteHabit = () => {
    if (editingHabitId) {
      habitService.archiveHabit(editingHabitId);
      setHabitFormOpen(false);
    }
  };

  // Handle area drag end
  function handleAreaDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = sortedAreas.findIndex((a) => a.id === active.id);
    const newIndex = sortedAreas.findIndex((a) => a.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Reorder the array
    const reordered = arrayMove(sortedAreas, oldIndex, newIndex);

    // Update order property for all areas
    for (const [index, area] of reordered.entries()) {
      if (area.order !== index) {
        areas$[area.id].order.set(index);
        areas$[area.id].updatedAt.set(new Date().toISOString());
      }
    }
  }

  return (
    <>
      {/* Landscape Prompt - Shows on mobile portrait mode only */}
      <LandscapePrompt />

      <div className="min-h-dvh h-dvh md:h-auto bg-background transition-colors flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-mono font-medium text-stone-900 dark:text-stone-100">
              Plan
            </h1>
            <p className="text-sm font-mono text-stone-500 dark:text-stone-400 mt-1">
              Design your habit system
            </p>
          </div>

          {/* Area Cards Grid - Sortable */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleAreaDragEnd}
          >
            <SortableContext
              items={sortedAreas.map((a) => a.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedAreas.map((area) => (
                  <SortableAreaCard
                    key={area.id}
                    area={area}
                    habits={habitsByArea[area.id] || []}
                    onEditHabit={handleEditHabit}
                    onArchiveHabit={handleArchiveHabit}
                    onUpdateArea={handleUpdateArea}
                    onArchiveArea={handleArchiveArea}
                    onQuickCreateHabit={handleQuickCreateHabit}
                  />
                ))}

                {/* Empty card always at the end */}
                <EmptyAreaCard onCreateArea={handleCreateArea} />
              </div>
            </SortableContext>
          </DndContext>

          {/* Archived Areas Section */}
          {archivedAreas.length > 0 && (
            <div className="mt-12">
              <button
                type="button"
                onClick={() => setArchivedSectionOpen(!archivedSectionOpen)}
                className="flex items-center gap-2 text-sm font-mono text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 transition-colors mb-4"
              >
                <span>{archivedSectionOpen ? "▼" : "▶"}</span>
                <span>Archived Areas ({archivedAreas.length})</span>
              </button>

              {archivedSectionOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {archivedAreas.map((area) => (
                    <div
                      key={area.id}
                      className="flex flex-col border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden opacity-60"
                      style={{
                        backgroundColor: area.color + "08",
                      }}
                    >
                      {/* Area Header */}
                      <div
                        className="group px-4 py-3 border-b border-stone-200 dark:border-stone-700"
                        style={{
                          borderLeftColor: area.color,
                          borderLeftWidth: "4px",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{area.emoji}</span>
                          <span className="flex-1 text-sm font-mono font-medium text-stone-900 dark:text-stone-100">
                            {area.name}
                          </span>

                          {/* Action Buttons - Always visible on touch devices */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity">
                            {/* Unarchive Button */}
                            <button
                              type="button"
                              onClick={() => handleUnarchiveArea(area.id)}
                              className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors"
                              title="Unarchive area"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-stone-500 dark:text-stone-400"
                              >
                                <path d="M3 3h18v5H3z" />
                                <path d="M3 8h18v13H3z" />
                                <path d="M12 12v5" />
                                <path d="m9 15 3-3 3 3" />
                              </svg>
                            </button>

                            {/* Delete Button - Only if area has no moments */}
                            {(() => {
                              const allMoments = Object.values(moments$.get());
                              const canDelete = canDeleteArchivedArea(area, allMoments);
                              return canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmAreaId(area.id)}
                                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                                  title="Delete area permanently"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-red-600 dark:text-red-400"
                                  >
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                  </svg>
                                </button>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Habits Count */}
                      <div className="p-4 text-xs text-stone-500 dark:text-stone-400 font-mono">
                        {(habitsByArea[area.id] || []).length} habit
                        {(habitsByArea[area.id] || []).length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Habit Form Dialog */}
        <HabitFormDialog
          open={habitFormOpen}
          mode={habitFormMode}
          habitId={editingHabitId}
          initialName={editingHabit?.name || ""}
          initialAreaId={selectedAreaId}
          initialEmoji={editingHabit?.emoji || "⭐"}
          initialTags={editingHabit?.tags || []}
          onClose={() => setHabitFormOpen(false)}
          onSave={handleSaveHabit}
          onDelete={habitFormMode === "edit" ? handleDeleteHabit : undefined}
        />

        {/* Delete Area Confirmation Dialog */}
        {deleteConfirmAreaId && (() => {
          const area = areas$.get()[deleteConfirmAreaId];
          return area ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
                <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
                  Delete Area?
                </h3>
                <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">
                  Are you sure you want to permanently delete "{area.name}"? This action cannot be undone.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmAreaId(null)}
                    className="px-4 py-2 rounded-lg font-mono text-sm bg-stone-200 hover:bg-stone-300 text-stone-900 dark:bg-stone-700 dark:hover:bg-stone-600 dark:text-stone-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteArea(deleteConfirmAreaId)}
                    className="px-4 py-2 rounded-lg font-mono text-sm bg-red-600 hover:bg-red-700 text-white transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ) : null;
        })()}
      </div>
    </>
  );
});

export default PlanPage;
