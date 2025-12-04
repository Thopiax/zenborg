"use client";

import { observer, use$ } from "@legendapp/state/react";
import { useState } from "react";
import { AreaService } from "@/application/services/AreaService";
import { HabitService } from "@/application/services/HabitService";
import { EmptyAreaCard } from "@/components/EmptyAreaCard";
import { HabitFormDialog } from "@/components/HabitFormDialog";
import { PlanAreaCard } from "@/components/PlanAreaCard";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import {
  activeAreas$,
  activeHabits$,
  archivedAreas$,
} from "@/infrastructure/state/store";

/**
 * AreaGallery - Grid of area cards with habits
 *
 * Features:
 * - Grid of area cards with habits
 * - Editable area properties (emoji, name, color)
 * - Create/edit/archive habits
 * - Habits grouped by area
 * - Drag-and-drop reordering
 */
export const AreaGallery = observer(() => {
  const areaService = new AreaService();
  const habitService = new HabitService();

  // Get active areas and habits
  const areas = use$(activeAreas$);
  const habits = use$(activeHabits$);
  const archivedAreas = use$(archivedAreas$);

  // Sort areas by order property (ascending)
  const sortedAreas = [...areas].sort((a, b) => a.order - b.order);

  // Local state for habit form dialog
  const [habitFormOpen, setHabitFormOpen] = useState(false);
  const [habitToEdit, setHabitToEdit] = useState<Habit | null>(null);

  // Group habits by area
  const habitsByArea = habits.reduce(
    (acc, habit) => {
      if (!acc[habit.areaId]) {
        acc[habit.areaId] = [];
      }
      acc[habit.areaId].push(habit);
      return acc;
    },
    {} as Record<string, typeof habits>
  );

  // Handle create area
  const handleCreateArea = (name: string, emoji: string, color: string) => {
    const result = areaService.createArea({
      name,
      emoji,
      color,
      order: areas.length, // Add to end
    });

    if ("error" in result) {
      alert(`Failed to create area: ${result.error}`);
    }
  };

  // Handle update area
  const handleUpdateArea = (
    areaId: string,
    updates: Partial<Pick<Area, "name" | "color" | "emoji" | "order" | "attitude" | "tags">>
  ) => {
    const result = areaService.updateArea(areaId, updates);

    if ("error" in result) {
      alert(`Failed to update area: ${result.error}`);
    }
  };

  // Handle archive area
  const handleArchiveArea = (areaId: string) => {
    const result = areaService.archiveArea(areaId);

    if ("error" in result) {
      alert(`Failed to archive area: ${result.error}`);
    }
  };

  // Handle unarchive area
  const handleUnarchiveArea = (areaId: string) => {
    const result = areaService.unarchiveArea(areaId);

    if ("error" in result) {
      alert(`Failed to unarchive area: ${result.error}`);
    }
  };

  // Handle delete archived area
  const handleDeleteArchivedArea = (areaId: string) => {
    const result = areaService.deleteArchivedArea(areaId);

    if ("error" in result) {
      alert(result.error);
    }
  };

  // Handle create habit
  const handleCreateHabit = (
    name: string,
    areaId: string,
    emoji: string,
    tags: string[]
  ) => {
    const areaHabits = habitsByArea[areaId] || [];
    const result = habitService.createHabit({
      name,
      areaId,
      emoji,
      tags,
      order: areaHabits.length,
    });

    if ("error" in result) {
      alert(`Failed to create habit: ${result.error}`);
      return;
    }

    setHabitFormOpen(false);
  };

  // Handle edit habit (receives habitId, not Habit object)
  const handleEditHabit = (habitId: string) => {
    const habit = habits.find((h) => h.id === habitId);
    if (habit) {
      setHabitToEdit(habit);
      setHabitFormOpen(true);
    }
  };

  // Handle create habit (for area card)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  const handleOpenCreateHabit = (areaId: string) => {
    setSelectedAreaId(areaId);
    setHabitToEdit(null);
    setHabitFormOpen(true);
  };

  // Handle update habit
  const handleUpdateHabit = (
    habitId: string,
    updates: {
      name?: string;
      areaId?: string;
      emoji?: string;
      tags?: string[];
    }
  ) => {
    const result = habitService.updateHabit(habitId, updates);

    if ("error" in result) {
      alert(`Failed to update habit: ${result.error}`);
      return;
    }

    setHabitFormOpen(false);
    setHabitToEdit(null);
  };

  // Handle delete habit (archive)
  const handleDeleteHabit = (habitId: string) => {
    const result = habitService.archiveHabit(habitId);

    if ("error" in result) {
      alert(`Failed to archive habit: ${result.error}`);
      return;
    }

    setHabitFormOpen(false);
    setHabitToEdit(null);
  };

  // Handle archive habit
  const handleArchiveHabit = (habitId: string) => {
    const result = habitService.archiveHabit(habitId);

    if ("error" in result) {
      alert(`Failed to archive habit: ${result.error}`);
      return;
    }
  };

  // Handle unarchive habit
  const handleUnarchiveHabit = (habitId: string) => {
    const result = habitService.unarchiveHabit(habitId);

    if ("error" in result) {
      alert(`Failed to unarchive habit: ${result.error}`);
      return;
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedAreas.map((area: Area) => (
          <PlanAreaCard
            key={area.id}
            area={area}
            habits={habitsByArea[area.id] || []}
            onUpdateArea={handleUpdateArea}
            onArchiveArea={handleArchiveArea}
            onCreateHabit={() => handleOpenCreateHabit(area.id)}
            onEditHabit={handleEditHabit}
            onArchiveHabit={handleArchiveHabit}
          />
        ))}

        {/* Empty card for creating new areas */}
        <EmptyAreaCard onCreateArea={handleCreateArea} />
      </div>

      {/* Habit Form Dialog */}
      <HabitFormDialog
        open={habitFormOpen}
        mode={habitToEdit ? "edit" : "create"}
        habitId={habitToEdit?.id}
        initialName={habitToEdit?.name || ""}
        initialAreaId={habitToEdit?.areaId || selectedAreaId || ""}
        initialEmoji={habitToEdit?.emoji || "⭐"}
        initialTags={habitToEdit?.tags || []}
        onClose={() => {
          setHabitFormOpen(false);
          setHabitToEdit(null);
          setSelectedAreaId(null);
        }}
        onSave={(name, areaId, emoji, tags) => {
          if (habitToEdit) {
            handleUpdateHabit(habitToEdit.id, { name, areaId, emoji, tags });
          } else {
            handleCreateHabit(name, areaId, emoji, tags);
          }
        }}
        onDelete={
          habitToEdit
            ? () => {
                handleDeleteHabit(habitToEdit.id);
              }
            : undefined
        }
      />
    </>
  );
});
