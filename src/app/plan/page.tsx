"use client";

import { observer, use$ } from "@legendapp/state/react";
import { useState } from "react";
import { HabitService } from "@/application/services/HabitService";
import { EmptyAreaCard } from "@/components/EmptyAreaCard";
import { HabitFormDialog } from "@/components/HabitFormDialog";
import { LandscapePrompt } from "@/components/LandscapePrompt";
import { PlanAreaCard } from "@/components/PlanAreaCard";
import type { Area } from "@/domain/entities/Area";
import { archiveArea, createArea, unarchiveArea, updateArea } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import {
  activeAreas$,
  activeHabits$,
  archivedAreas$,
  areas$,
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

  // Get active areas and habits
  const areas = use$(activeAreas$);
  const habits = use$(activeHabits$);
  const archivedAreas = use$(archivedAreas$);

  // UI state
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false);

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

          {/* Area Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {areas.map((area) => (
              <PlanAreaCard
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

                          {/* Unarchive Button */}
                          <button
                            type="button"
                            onClick={() => handleUnarchiveArea(area.id)}
                            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors opacity-0 group-hover:opacity-100"
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
      </div>
    </>
  );
});

export default PlanPage;
