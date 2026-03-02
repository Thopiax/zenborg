"use client";

import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { observer, use$ } from "@legendapp/state/react";
import { AreaService } from "@/application/services/AreaService";
import { HabitService } from "@/application/services/HabitService";
import { AreaBoardColumn } from "@/components/AreaBoardColumn";
import { EmptyAreaColumn } from "@/components/EmptyAreaColumn";
import { HabitFormDialog } from "@/components/HabitFormDialog";
import type { Area, UpdateAreaProps } from "@/domain/entities/Area";
import type { CreateHabitProps, UpdateHabitProps } from "@/domain/entities/Habit";
import { activeAreas$, activeHabits$ } from "@/infrastructure/state/store";
import {
  habitFormState$,
  openHabitFormCreate,
  openHabitFormEdit,
} from "@/infrastructure/state/ui-store";

export const AreaBoardBuilder = observer(() => {
  const areaService = new AreaService();
  const habitService = new HabitService();

  const areas = use$(activeAreas$);
  const habits = use$(activeHabits$);

  const sortedAreas = [...areas].sort((a, b) => a.order - b.order);

  // Group habits by area
  const habitsByArea: Record<string, typeof habits> = {};
  for (const habit of habits) {
    if (!habitsByArea[habit.areaId]) {
      habitsByArea[habit.areaId] = [];
    }
    habitsByArea[habit.areaId].push(habit);
  }

  // Area CRUD
  const handleCreateArea = (name: string, emoji: string, color: string) => {
    const result = areaService.createArea({
      name,
      emoji,
      color,
      order: areas.length,
    });
    if ("error" in result) {
      alert(`Failed to create area: ${result.error}`);
    }
  };

  const handleUpdateArea = (areaId: string, updates: UpdateAreaProps) => {
    const result = areaService.updateArea(areaId, updates);
    if ("error" in result) {
      alert(`Failed to update area: ${result.error}`);
    }
  };

  const handleArchiveArea = (areaId: string) => {
    const result = areaService.archiveArea(areaId);
    if ("error" in result) {
      alert(`Failed to archive area: ${result.error}`);
    }
  };

  // Habit CRUD
  const handleOpenCreateHabit = (areaId: string) => {
    openHabitFormCreate({ areaId });
  };

  const handleEditHabit = (habitId: string) => {
    const habit = habits.find((h) => h.id === habitId);
    if (habit) {
      openHabitFormEdit(habitId, habit);
    }
  };

  const handleArchiveHabit = (habitId: string) => {
    const result = habitService.archiveHabit(habitId);
    if ("error" in result) {
      alert(`Failed to archive habit: ${result.error}`);
    }
  };

  const handleSaveHabit = (props: CreateHabitProps | UpdateHabitProps) => {
    const formState = habitFormState$.peek();

    if (formState.mode === "edit" && formState.editingHabitId) {
      const result = habitService.updateHabit(formState.editingHabitId, props);
      if ("error" in result) {
        alert(`Failed to update habit: ${result.error}`);
      }
    } else {
      const areaHabits = habitsByArea[props.areaId!] || [];
      const result = habitService.createHabit({
        ...props,
        order: areaHabits.length,
      } as CreateHabitProps);
      if ("error" in result) {
        alert(`Failed to create habit: ${result.error}`);
      }
    }
  };

  const handleDeleteHabit = () => {
    const formState = habitFormState$.peek();
    if (!formState.editingHabitId) return;

    const result = habitService.archiveHabit(formState.editingHabitId);
    if ("error" in result) {
      alert(`Failed to archive habit: ${result.error}`);
    }
  };

  return (
    <>
      <SortableContext
        items={sortedAreas.map((a) => a.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="flex gap-4 overflow-x-auto px-4 py-4 h-full snap-x snap-mandatory scroll-smooth">
          {sortedAreas.map((area: Area) => (
            <AreaBoardColumn
              key={area.id}
              area={area}
              habits={habitsByArea[area.id] || []}
              onUpdateArea={handleUpdateArea}
              onArchiveArea={handleArchiveArea}
              onEditHabit={handleEditHabit}
              onArchiveHabit={handleArchiveHabit}
              onCreateHabit={() => handleOpenCreateHabit(area.id)}
            />
          ))}

          <EmptyAreaColumn onCreateArea={handleCreateArea} />
        </div>
      </SortableContext>

      <HabitFormDialog onSave={handleSaveHabit} onDelete={handleDeleteHabit} />
    </>
  );
});
