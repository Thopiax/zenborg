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
import { useRef, useState } from "react";
import {
  type ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { AreaService } from "@/application/services/AreaService";
import { CycleService } from "@/application/services/CycleService";
import { HabitService } from "@/application/services/HabitService";
import { AreaGallery } from "@/components/AreaGallery";
import { CyclePane } from "@/components/CyclePane";
import { DraggableHabitItem } from "@/components/DraggableHabitItem";
import { LandscapePrompt } from "@/components/LandscapePrompt";
import {
  activeAreas$,
  activeHabits$,
  areas$,
} from "@/infrastructure/state/store";

const CYCLE_PANEL_MIN_SIZE = 5; // Minimum size percentage when collapsed
const CYCLE_PANEL_DEFAULT_SIZE = 40; // Default size percentage when expanded

/**
 * Plant Page - Habit Design & Cycle Planning
 *
 * Layout:
 * - Top: Area gallery (areas with habits)
 * - Bottom: Cycle planning (cycle tabs + habits library + cycle deck)
 *
 * Features:
 * - Drag habits from area gallery to cycle deck to budget them
 * - Reorder areas within the gallery
 */
const PlantPage = observer(() => {
  const areaService = new AreaService();
  const cycleService = new CycleService();
  const habitService = new HabitService();
  const areas = use$(activeAreas$);
  const habits = use$(activeHabits$);

  // Track active drag item for overlay
  const [activeId, setActiveId] = useState<string | null>(null);

  // Cycle panel ref for programmatic resizing
  const cyclePanelRef = useRef<ImperativePanelHandle>(null);

  // Handle cycle pane collapse/expand
  const handleCyclePaneCollapse = (isCollapsed: boolean) => {
    if (cyclePanelRef.current) {
      // When collapsed, resize to minimum (15%), when expanded, resize to default (40%)
      cyclePanelRef.current.resize(
        isCollapsed ? CYCLE_PANEL_MIN_SIZE : CYCLE_PANEL_DEFAULT_SIZE
      );
    }
  };

  // Custom collision detection - prioritize area drops over habit reordering
  const customCollisionDetection = (args: any) => {
    const { active } = args;
    const activeData = active?.data?.current;

    // If dragging a habit (not an area)
    if (activeData?.type === "habit") {
      // Check if pointer is within an area card (for cross-area drops)
      const pointerCollisions = pointerWithin(args);
      const areaCollisions = pointerCollisions.filter((collision: any) =>
        collision.id.toString().startsWith("area-")
      );

      // If hovering over an area, use that
      if (areaCollisions.length > 0) {
        return areaCollisions;
      }

      // Otherwise, use rect intersection for habit reordering
      return rectIntersection(args);
    }

    // For area reordering or cycle drops, use closest center
    return closestCenter(args);
  };

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

  // Handle drag start - track active item for overlay
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end - supports:
  // 1. Habit reordering within same area
  // 2. Habit dragging to different area (changes habit's areaId)
  // 3. Habit dragging to cycle deck (budgets to cycle)
  // 4. Area reordering (via SortableContext in AreaGallery)
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
      cycleId?: string;
      targetType?: string;
      targetAreaId?: string;
      type?: string;
    };

    // Case 1: Reordering habits within same area
    if (
      dragData?.type === "habit" &&
      dropData?.type === "habit" &&
      dragData.sourceAreaId === dropData.sourceAreaId &&
      active.id !== over.id
    ) {
      const areaId = dragData.sourceAreaId;
      if (!areaId) return;

      // Get habits in this area, sorted by order
      const areaHabits = habits
        .filter((h) => h.areaId === areaId)
        .sort((a, b) => a.order - b.order);

      const oldIndex = areaHabits.findIndex((h) => h.id === active.id);
      const newIndex = areaHabits.findIndex((h) => h.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Reorder habits
      const reordered = arrayMove(areaHabits, oldIndex, newIndex);

      // Update order property for all habits in this area
      reordered.forEach((habit, index) => {
        const result = habitService.updateHabit(habit.id, { order: index });
        if ("error" in result) {
          console.error(`Failed to update habit order: ${result.error}`);
        }
      });
      return;
    }

    // Case 2: Dragging habit to different area
    if (dragData?.type === "habit" && dropData?.targetType === "area") {
      const habitId = dragData.habitId;
      const sourceAreaId = dragData.sourceAreaId;
      const targetAreaId = dropData.targetAreaId;

      // Don't do anything if dropping on same area
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

    // Case 3: Dragging habit to cycle deck
    if (dragData?.habitId && dropData?.targetType === "cycle-deck") {
      const habitId = dragData.habitId;
      const cycleId = dropData.cycleId;

      if (!cycleId) return;

      // Get current cycle plans to find existing budget count
      const allCyclePlans = cycleService.getAllCyclePlans();
      const existingPlan = allCyclePlans.find(
        (plan) => plan.cycleId === cycleId && plan.habitId === habitId
      );

      const newCount = existingPlan
        ? (existingPlan as { budgetedCount: number }).budgetedCount + 1
        : 1;

      // Budget habit to cycle (this will materialize moments)
      const result = cycleService.budgetHabitToCycle(
        cycleId,
        habitId,
        newCount
      );

      if ("error" in result) {
        alert(`Failed to budget habit: ${result.error}`);
      }
      return;
    }

    // Case 4: Area reordering (no type discrimination, just check if both are areas)
    if (!dragData?.type && !dropData?.targetType) {
      // This is likely an area reordering operation
      const sortedAreas = [...areas].sort((a, b) => a.order - b.order);
      const oldIndex = sortedAreas.findIndex((area) => area.id === active.id);
      const newIndex = sortedAreas.findIndex((area) => area.id === over.id);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      // Reorder areas
      const reordered = arrayMove(sortedAreas, oldIndex, newIndex);

      // Update order property for all areas
      reordered.forEach((area, index) => {
        const updated = areaService.updateArea(area.id, { order: index });
        if ("error" in updated) return;
        areas$[area.id].set(updated);
      });
      return;
    }
  };

  return (
    <>
      {/* Landscape Prompt - Shows on mobile portrait mode only */}
      <LandscapePrompt />

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        autoScroll={{
          threshold: {
            x: 0.05, // 5% from horizontal edge (default 0.2) — prevents premature scroll
            y: 0.05, // 5% from vertical edge — stops Areas panel scrolling during drag
          },
          acceleration: 5, // Lower acceleration (default 10) for smoother, less aggressive scroll
        }}
      >
        <div className="h-dvh bg-background transition-colors">
          <PanelGroup direction="vertical" autoSaveId="plant-layout">
            {/* Top Panel: Area Gallery - Resizable */}
            <Panel defaultSize={60} minSize={30}>
              <div className="h-full overflow-y-auto p-6 pt-16 pb-6">
                <div className="mb-8">
                  <h1 className="text-2xl font-mono font-bold text-stone-900 dark:text-stone-100 mb-2">
                    Areas
                  </h1>
                  <p className="text-sm text-stone-500 dark:text-stone-400 font-mono">
                    Map out the areas of your life
                  </p>
                </div>

                <AreaGallery />
              </div>
            </Panel>

            {/* Resize Handle - Draggable divider */}
            <PanelResizeHandle className="h-1 bg-stone-300 dark:bg-stone-600 hover:bg-stone-400 dark:hover:bg-stone-500 transition-colors relative group">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 flex items-center justify-center">
                <div className="w-12 h-1 rounded-full bg-stone-400 dark:bg-stone-500 group-hover:bg-stone-500 dark:group-hover:bg-stone-400 transition-colors" />
              </div>
            </PanelResizeHandle>

            {/* Bottom Panel: Cycles - Resizable */}
            <Panel ref={cyclePanelRef} defaultSize={40} minSize={5}>
              <div className="h-full overflow-y-auto bg-stone-50 dark:bg-stone-900">
                <CyclePane onCollapsedChange={handleCyclePaneCollapse} />
              </div>
            </Panel>
          </PanelGroup>
        </div>

        {/* Drag Overlay - renders dragged item outside overflow containers */}
        <DragOverlay>
          {activeId
            ? (() => {
                // Only render overlay for habits (not areas)
                const activeHabit = habits.find((h) => h.id === activeId);
                if (!activeHabit) return null;

                const area = areas.find((a) => a.id === activeHabit.areaId);
                if (!area) {
                  console.error("Habit area not found:", activeHabit.areaId);
                  return null;
                }
                if (!area.color) {
                  console.error("Area missing color property:", area);
                  return null;
                }

                return (
                  <DraggableHabitItem
                    habit={activeHabit}
                    areaColor={area.color}
                    onEdit={() => {}}
                  />
                );
              })()
            : null}
        </DragOverlay>
      </DndContext>
    </>
  );
});

export default PlantPage;
