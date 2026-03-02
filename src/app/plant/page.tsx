"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { observer, use$ } from "@legendapp/state/react";
import { useState } from "react";
import { AreaService } from "@/application/services/AreaService";
import { HabitService } from "@/application/services/HabitService";
import { AreaBoardBuilder } from "@/components/AreaBoardBuilder";
import { DraggableHabitItem } from "@/components/DraggableHabitItem";
import { LandscapePrompt } from "@/components/LandscapePrompt";
import {
  activeAreas$,
  activeHabits$,
  areas$,
} from "@/infrastructure/state/store";

const PlantPage = observer(() => {
  const areaService = new AreaService();
  const habitService = new HabitService();
  const areas = use$(activeAreas$);
  const habits = use$(activeHabits$);

  const [activeId, setActiveId] = useState<string | null>(null);

  // Custom collision detection
  const customCollisionDetection = (args: any) => {
    const { active } = args;
    const activeData = active?.data?.current;

    if (activeData?.type === "habit") {
      const pointerCollisions = pointerWithin(args);
      const areaCollisions = pointerCollisions.filter((collision: any) =>
        collision.id.toString().startsWith("area-"),
      );
      if (areaCollisions.length > 0) {
        return areaCollisions;
      }
      return rectIntersection(args);
    }

    return closestCenter(args);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current as {
      habitId?: string;
      sourceAreaId?: string;
      type?: string;
    };
    const dropData = over.data.current as {
      habitId?: string;
      sourceAreaId?: string;
      targetType?: string;
      targetAreaId?: string;
      type?: string;
    };

    // Case 1: Reorder habits within same area
    if (
      dragData?.type === "habit" &&
      dropData?.type === "habit" &&
      dragData.sourceAreaId === dropData.sourceAreaId &&
      active.id !== over.id
    ) {
      const areaId = dragData.sourceAreaId;
      if (!areaId) return;

      const areaHabits = habits
        .filter((h) => h.areaId === areaId)
        .sort((a, b) => a.order - b.order);

      const oldIndex = areaHabits.findIndex((h) => h.id === active.id);
      const newIndex = areaHabits.findIndex((h) => h.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(areaHabits, oldIndex, newIndex);
      for (const [index, habit] of reordered.entries()) {
        const result = habitService.updateHabit(habit.id, { order: index });
        if ("error" in result) {
          console.error(`Failed to update habit order: ${result.error}`);
        }
      }
      return;
    }

    // Case 2: Drag habit to different area
    if (dragData?.type === "habit" && dropData?.targetType === "area") {
      const habitId = dragData.habitId;
      const sourceAreaId = dragData.sourceAreaId;
      const targetAreaId = dropData.targetAreaId;

      if (habitId && targetAreaId && sourceAreaId !== targetAreaId) {
        const result = habitService.updateHabit(habitId, {
          areaId: targetAreaId,
        });
        if ("error" in result) {
          alert(`Failed to move habit: ${result.error}`);
        }
      }
      return;
    }

    // Case 3: Area reordering
    if (
      dragData?.type === "area" &&
      (dropData?.type === "area" || !dropData?.type)
    ) {
      const sortedAreas = [...areas].sort((a, b) => a.order - b.order);
      const oldIndex = sortedAreas.findIndex((area) => area.id === active.id);
      const newIndex = sortedAreas.findIndex((area) => area.id === over.id);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(sortedAreas, oldIndex, newIndex);
      for (const [index, area] of reordered.entries()) {
        const updated = areaService.updateArea(area.id, { order: index });
        if ("error" in updated) return;
        areas$[area.id].set(updated);
      }
      return;
    }
  };

  return (
    <>
      <LandscapePrompt />

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        autoScroll={{
          threshold: { x: 0.05, y: 0.05 },
          acceleration: 5,
        }}
      >
        <div className="h-dvh bg-background transition-colors">
          <AreaBoardBuilder />
        </div>

        <DragOverlay>
          {activeId
            ? (() => {
                // Check if dragging a habit
                const activeHabit = habits.find((h) => h.id === activeId);
                if (activeHabit) {
                  const area = areas.find((a) => a.id === activeHabit.areaId);
                  return (
                    <DraggableHabitItem
                      habit={activeHabit}
                      areaColor={area?.color}
                      onEdit={() => {}}
                    />
                  );
                }

                // Check if dragging an area column
                const activeArea = areas.find((a) => a.id === activeId);
                if (activeArea) {
                  const areaHabits = habits.filter(
                    (h) => h.areaId === activeArea.id,
                  );
                  return (
                    <div className="w-[22.5rem] rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 shadow-lg opacity-90">
                      <div className="px-4 py-3 flex items-center gap-2">
                        <span className="text-xl">{activeArea.emoji}</span>
                        <span className="text-sm font-mono font-medium text-stone-700 dark:text-stone-300">
                          {activeArea.name}
                        </span>
                        <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
                          {areaHabits.length}
                        </span>
                      </div>
                      <div
                        className="h-[3px] mx-4"
                        style={{ backgroundColor: activeArea.color }}
                      />
                    </div>
                  );
                }

                return null;
              })()
            : null}
        </DragOverlay>
      </DndContext>
    </>
  );
});

export default PlantPage;
