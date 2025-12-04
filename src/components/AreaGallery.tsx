"use client";

import { observer, use$ } from "@legendapp/state/react";
import { AreaService } from "@/application/services/AreaService";
import { HabitService } from "@/application/services/HabitService";
import { EmptyAreaCard } from "@/components/EmptyAreaCard";
import { HabitFormDialog } from "@/components/HabitFormDialog";
import { PlanAreaCard } from "@/components/PlanAreaCard";
import type { Area, UpdateAreaProps } from "@/domain/entities/Area";
import type {
  CreateHabitProps,
  UpdateHabitProps,
} from "@/domain/entities/Habit";
import {
  activeAreas$,
  activeHabits$,
  archivedAreas$,
} from "@/infrastructure/state/store";
import {
  habitFormState$,
  openHabitFormCreate,
  openHabitFormEdit,
} from "@/infrastructure/state/ui-store";

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

  // Group habits by area
  const habitsByArea = habits.reduce((acc, habit) => {
    if (!acc[habit.areaId]) {
      acc[habit.areaId] = [];
    }
    acc[habit.areaId].push(habit);
    return acc;
  }, {} as Record<string, typeof habits>);

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
  const handleUpdateArea = (areaId: string, updates: UpdateAreaProps) => {
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

  // Handle open create habit form
  const handleOpenCreateHabit = (areaId: string) => {
    openHabitFormCreate({ areaId });
  };

  // Handle open edit habit form
  const handleEditHabit = (habitId: string) => {
    const habit = habits.find((h) => h.id === habitId);
    if (habit) {
      openHabitFormEdit(habitId, habit);
    }
  };

  // Handle save habit (create or update based on form mode)
  const handleSaveHabit = (props: CreateHabitProps | UpdateHabitProps) => {
    const formState = habitFormState$.peek();

    if (formState.mode === "edit" && formState.editingHabitId) {
      // Update existing habit
      const result = habitService.updateHabit(formState.editingHabitId, props);

      if ("error" in result) {
        alert(`Failed to update habit: ${result.error}`);
        return;
      }
    } else {
      // Create new habit
      const areaHabits = habitsByArea[props.areaId!] || [];
      const result = habitService.createHabit({
        ...props,
        order: areaHabits.length,
      } as CreateHabitProps);

      if ("error" in result) {
        alert(`Failed to create habit: ${result.error}`);
        return;
      }
    }
  };

  // Handle delete habit (archive)
  const handleDeleteHabit = () => {
    const formState = habitFormState$.peek();

    if (!formState.editingHabitId) return;

    const result = habitService.archiveHabit(formState.editingHabitId);

    if ("error" in result) {
      alert(`Failed to archive habit: ${result.error}`);
      return;
    }
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
      <HabitFormDialog onSave={handleSaveHabit} onDelete={handleDeleteHabit} />
    </>
  );
});
