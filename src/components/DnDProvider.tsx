"use client";

/**
 * DnD Context Provider
 *
 * Wraps the application with @dnd-kit's DndContext, providing drag & drop
 * functionality throughout the component tree.
 */

import {
  closestCenter,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  getFirstCollision,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { use$ } from "@legendapp/state/react";
import { useState } from "react";
import type { Moment } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";
import { areas$, moments$ } from "@/infrastructure/state/store";
import { isDuplicateMode$ } from "@/infrastructure/state/ui-store";
import {
  calculateNextOrder,
  canDropInCell,
  reorderAfterRemoval,
} from "@/lib/drag-validation";
import type { DraggableData, DroppableData } from "@/types/dnd";
import { MomentCard } from "./MomentCard";
import {
  startBatch,
  endBatch,
} from "@/infrastructure/state/history";
import {
  moveMomentWithHistory,
  duplicateMomentWithHistory,
  reorderMomentsWithHistory,
} from "@/infrastructure/state/history-middleware";

interface DnDProviderProps {
  children: React.ReactNode;
}

export function DnDProvider({ children }: DnDProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const isDuplicateMode = use$(isDuplicateMode$);
  const allMoments = use$(moments$);
  const allAreas = use$(areas$);

  // Custom collision detection strategy
  // Use pointerWithin first (for DrawingBoard hover states), then fall back to rectIntersection
  const collisionDetectionStrategy: CollisionDetection = (args) => {
    // First try pointer-based detection (good for hover states)
    const pointerCollisions = pointerWithin(args);

    // If we found collisions with pointer, use them
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    // Otherwise fall back to rect intersection (better for touch/drag accuracy)
    return rectIntersection(args);
  };

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
    // Capture duplicate decision at drag start (locked for entire drag operation)
    // If Option/Alt is held when drag begins, we'll duplicate on drop
    // @ts-ignore - activatorEvent contains the original mouse/pointer event
    const altKeyPressed = event.activatorEvent?.altKey || false;
    isDuplicateMode$.set(altKeyPressed);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const wasDuplicateMode = isDuplicateMode;
    setActiveId(null);
    isDuplicateMode$.set(false);

    if (!over) {
      // Dropped outside any droppable zone
      return;
    }

    const dragData = active.data.current as DraggableData | undefined;
    const dropData = over.data.current as DroppableData | undefined;

    // Handle sortable reordering (when dragging over another moment, not a cell)
    if (active.id !== over.id && !dropData?.targetType) {
      const activeMoment = allMoments[active.id as string];
      const overMoment = allMoments[over.id as string];

      if (!activeMoment || !overMoment) {
        return;
      }

      // Reorder within timeline cell (both moments are allocated to same cell)
      if (
        activeMoment.day &&
        activeMoment.phase &&
        activeMoment.day === overMoment.day &&
        activeMoment.phase === overMoment.phase
      ) {
        handleSortableReorder(
          active.id as string,
          over.id as string,
          activeMoment.day,
          activeMoment.phase
        );
        return;
      }

      // Moving from timeline to drawing board (dropping on an unallocated moment)
      if (
        dragData?.sourceType === "timeline" &&
        activeMoment.day &&
        activeMoment.phase &&
        !overMoment.day &&
        !overMoment.phase
      ) {
        console.log("Moving from timeline to drawing board via moment drop");
        handleDropOnDrawingBoard(dragData);
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

    console.log("Dropping moment", momentId, "on", dropData, "from", dragData);

    // Handle different drop target types
    switch (dropData.targetType) {
      case "timeline-cell":
        handleDropOnTimelineCell(dragData, dropData, wasDuplicateMode);
        break;

      case "drawing-board":
        // Don't allow duplicating to drawing board (doesn't make sense)
        if (!wasDuplicateMode) {
          console.log("Handling drop on drawing board", dragData);
          handleDropOnDrawingBoard(dragData);
        }
        break;

      case "drawing-board-column":
        // Handle drop on a grouped column
        if (!wasDuplicateMode) {
          handleDropOnColumn(dragData, dropData);
        }
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

    // Build reorder operations for history
    const reorders = reordered.map((moment, newOrder) => ({
      momentId: moment.id,
      fromOrder: moment.order,
      toOrder: newOrder,
    }));

    // Apply with history tracking
    reorderMomentsWithHistory(day, phase, reorders);
  }

  function handleDropOnTimelineCell(
    dragData: DraggableData,
    dropData: DroppableData,
    shouldDuplicate = false
  ) {
    const { momentId, sourceDay, sourcePhase } = dragData;
    const { targetDay, targetPhase } = dropData;

    if (!targetDay || !targetPhase) {
      console.error("Timeline cell missing day/phase", dropData);
      return;
    }

    const isSameCell = sourceDay === targetDay && sourcePhase === targetPhase;

    if (isSameCell && !shouldDuplicate) {
      // Reordering within the same cell - handled by sortable
      // We don't need to do anything here, @dnd-kit/sortable handles it
      return;
    }

    // Moving/duplicating to a different cell (or duplicating in same cell)
    // Validate max-3 constraint
    const validation = canDropInCell(
      targetDay,
      targetPhase,
      allMoments,
      shouldDuplicate ? "" : momentId // Don't exclude original if duplicating
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
      shouldDuplicate ? "" : momentId
    );

    if (shouldDuplicate) {
      // Duplicate mode: create a copy of the moment in the target cell
      const originalMoment = allMoments[momentId];
      duplicateMomentWithHistory(
        momentId,
        targetDay,
        targetPhase as Phase,
        newOrder
      );
    } else {
      // Move mode: batch the move + any reorders
      startBatch();

      // Calculate reorders in source cell (if moving from timeline)
      const reorders = sourceDay && sourcePhase
        ? reorderAfterRemoval(sourceDay, sourcePhase, allMoments, momentId).map(
            ({ momentId: id, newOrder: order }) => ({
              momentId: id,
              fromOrder: allMoments[id].order,
              toOrder: order,
            })
          )
        : undefined;

      // Apply move with history
      moveMomentWithHistory(
        momentId,
        targetDay,
        targetPhase as Phase,
        newOrder,
        reorders
      );

      endBatch(`Moved moment to ${targetDay} ${targetPhase}`);
    }
  }

  function handleDropOnDrawingBoard(dragData: DraggableData) {
    const { momentId, sourceDay, sourcePhase } = dragData;

    // Only process if moment was allocated (coming from timeline)
    if (!sourceDay || !sourcePhase) {
      return; // Already unallocated
    }

    // Batch unallocate + reorders
    startBatch();

    // Calculate reorders in source cell
    const reorders = reorderAfterRemoval(
      sourceDay,
      sourcePhase,
      allMoments,
      momentId
    ).map(({ momentId: id, newOrder: order }) => ({
      momentId: id,
      fromOrder: allMoments[id].order,
      toOrder: order,
    }));

    // Apply move to drawing board (null day/phase) with history
    moveMomentWithHistory(momentId, null, null, 0, reorders);

    endBatch("Unallocated moment");
  }

  function handleDropOnColumn(dragData: DraggableData, dropData: DroppableData) {
    const { momentId } = dragData;
    const { columnId, groupBy } = dropData;

    if (!columnId || !groupBy) {
      console.warn("Missing column data", dropData);
      return;
    }

    const moment = allMoments[momentId];
    if (!moment) {
      console.error("Moment not found:", momentId);
      return;
    }

    // Only allow changing area for "area" grouping mode
    if (groupBy !== "area") {
      console.log("Ignoring drop - grouping mode is read-only:", groupBy);
      return;
    }

    // Extract area ID from column ID (format: "area-id")
    const newAreaId = columnId;

    // Don't update if already in this area
    if (moment.areaId === newAreaId) {
      return;
    }

    // Verify the area exists
    if (!allAreas[newAreaId]) {
      console.error("Target area not found:", newAreaId);
      return;
    }

    // Update moment's area
    console.log(`Moving moment ${momentId} to area ${newAreaId}`);
    moments$[momentId].areaId.set(newAreaId);
    moments$[momentId].updatedAt.set(new Date().toISOString());
  }

  function handleDragCancel() {
    setActiveId(null);
    isDuplicateMode$.set(false);
  }

  // Get active moment for drag overlay
  const activeMoment = activeId ? allMoments[activeId] : null;
  const activeArea = activeMoment ? allAreas[activeMoment.areaId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}

      {/* Drag overlay shows preview of dragged item */}
      <DragOverlay>
        {activeMoment && activeArea ? (
          <div className={isDuplicateMode ? "cursor-copy" : "cursor-grabbing"}>
            <MomentCard moment={activeMoment} area={activeArea} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
