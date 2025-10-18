"use client";

/**
 * DnD Context Provider
 *
 * Wraps the application with @dnd-kit's DndContext, providing drag & drop
 * functionality throughout the component tree.
 */

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { use$ } from "@legendapp/state/react";
import { useState } from "react";
import type { Phase } from "@/domain/value-objects/Phase";
import { areas$, moments$ } from "@/infrastructure/state/store";
import {
  calculateNextOrder,
  canDropInCell,
  isSameLocation,
  reorderAfterRemoval,
} from "@/lib/drag-validation";
import type { DraggableData, DroppableData } from "@/types/dnd";
import { MomentCard } from "./MomentCard";
import { UnallocateZone } from "./UnallocateZone";

interface DnDProviderProps {
  children: React.ReactNode;
}

export function DnDProvider({ children }: DnDProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDraggingAllocated, setIsDraggingAllocated] = useState(false);
  const allMoments = use$(moments$);
  const allAreas = use$(areas$);

  // Configure sensors for mouse, touch, and keyboard interactions
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // 8px drag threshold to prevent accidental drags
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 150ms hold for touch to prevent scroll interference
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    setActiveId(id);

    // Check if dragging an allocated moment (to show unallocate zone)
    const dragData = event.active.data.current as DraggableData | undefined;
    if (dragData?.sourceType === "timeline") {
      setIsDraggingAllocated(true);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setIsDraggingAllocated(false);

    if (!over) {
      // Dropped outside any droppable zone
      return;
    }

    const dragData = active.data.current as DraggableData | undefined;
    const dropData = over.data.current as DroppableData | undefined;

    // Handle sortable reordering (when dragging over another moment, not a cell)
    if (
      active.id !== over.id &&
      dragData?.sourceType === "timeline" &&
      !dropData?.targetType
    ) {
      // Dragging one moment over another moment in the same cell
      const activeMoment = allMoments[active.id as string];
      const overMoment = allMoments[over.id as string];

      if (
        activeMoment &&
        overMoment &&
        activeMoment.day &&
        activeMoment.phase &&
        activeMoment.day === overMoment.day &&
        activeMoment.phase === overMoment.phase
      ) {
        // Reorder within the same cell
        handleSortableReorder(
          active.id as string,
          over.id as string,
          activeMoment.day,
          activeMoment.phase
        );
        return;
      }
    }

    if (!dragData || !dropData) {
      console.warn("Missing drag/drop data", { dragData, dropData });
      return;
    }

    const momentId = dragData.momentId;
    const moment = allMoments[momentId];

    if (!moment) {
      console.error("Moment not found:", momentId);
      return;
    }

    console.log("Dropping moment", momentId, "on", dropData);

    // Handle different drop target types
    switch (dropData.targetType) {
      case "timeline-cell":
        handleDropOnTimelineCell(dragData, dropData);
        break;

      case "drawing-board":
      case "unallocate-zone":
        handleDropOnDrawingBoard(dragData);
        break;

      default:
        console.warn("Unknown drop target type:", dropData.targetType);
    }
  }

  function handleSortableReorder(
    activeId: string,
    overId: string,
    day: string,
    phase: Phase
  ) {
    // Get all moments in this cell, sorted by current order
    const cellMoments = Object.values(allMoments)
      .filter((m) => m.day === day && m.phase === phase)
      .sort((a, b) => a.order - b.order);

    const oldIndex = cellMoments.findIndex((m) => m.id === activeId);
    const newIndex = cellMoments.findIndex((m) => m.id === overId);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Reorder the array
    const reordered = [...cellMoments];
    const [movedItem] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, movedItem);

    // Update order values in state
    for (let i = 0; i < reordered.length; i++) {
      moments$[reordered[i].id].order.set(i);
      moments$[reordered[i].id].updatedAt.set(new Date().toISOString());
    }
  }

  function handleDropOnTimelineCell(
    dragData: DraggableData,
    dropData: DroppableData
  ) {
    const { momentId, sourceDay, sourcePhase } = dragData;
    const { targetDay, targetPhase } = dropData;

    if (!targetDay || !targetPhase) {
      console.error("Timeline cell missing day/phase", dropData);
      return;
    }

    const isSameCell = sourceDay === targetDay && sourcePhase === targetPhase;

    if (isSameCell) {
      // Reordering within the same cell - handled by sortable
      // We don't need to do anything here, @dnd-kit/sortable handles it
      return;
    }

    // Moving to a different cell
    // Validate max-3 constraint
    const validation = canDropInCell(
      targetDay,
      targetPhase,
      allMoments,
      momentId
    );

    if (!validation.isValid) {
      console.warn("Cannot drop:", validation.reason);
      // TODO: Show visual feedback (red border flash)
      return;
    }

    // Calculate next available order in target cell
    const newOrder = calculateNextOrder(
      targetDay,
      targetPhase,
      allMoments,
      momentId
    );

    // Update moment with new allocation
    moments$[momentId].set({
      ...allMoments[momentId],
      day: targetDay,
      phase: targetPhase as Phase,
      order: newOrder,
      updatedAt: new Date().toISOString(),
    });

    // If moving from another timeline cell, reorder remaining moments
    if (sourceDay && sourcePhase) {
      const reorders = reorderAfterRemoval(
        sourceDay,
        sourcePhase,
        allMoments,
        momentId
      );

      for (const { momentId: id, newOrder: order } of reorders) {
        moments$[id].order.set(order);
        moments$[id].updatedAt.set(new Date().toISOString());
      }
    }
  }

  function handleDropOnDrawingBoard(dragData: DraggableData) {
    const { momentId, sourceDay, sourcePhase } = dragData;

    // Only process if moment was allocated (coming from timeline)
    if (!sourceDay || !sourcePhase) {
      return; // Already unallocated
    }

    // Unallocate moment
    moments$[momentId].set({
      ...allMoments[momentId],
      day: null,
      phase: null,
      order: 0,
      updatedAt: new Date().toISOString(),
    });

    // Reorder remaining moments in source cell
    const reorders = reorderAfterRemoval(
      sourceDay,
      sourcePhase,
      allMoments,
      momentId
    );

    for (const { momentId: id, newOrder: order } of reorders) {
      moments$[id].order.set(order);
      moments$[id].updatedAt.set(new Date().toISOString());
    }
  }

  function handleDragCancel() {
    setActiveId(null);
    setIsDraggingAllocated(false);
  }

  // Get active moment for drag overlay
  const activeMoment = activeId ? allMoments[activeId] : null;
  const activeArea = activeMoment ? allAreas[activeMoment.areaId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}

      {/* Unallocate zone - fixed viewport edge (only visible when dragging allocated moments) */}
      <UnallocateZone isVisible={isDraggingAllocated} />

      {/* Drag overlay shows preview of dragged item */}
      <DragOverlay>
        {activeMoment && activeArea ? (
          <div className="cursor-grabbing">
            <MomentCard moment={activeMoment} area={activeArea} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
