/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useAriaPropsSupportedByRole: <explanation> */
"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { use$ } from "@legendapp/state/react";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import { areas$ } from "@/infrastructure/state/store";
import type { DrawingBoardGroupBy } from "@/infrastructure/state/ui-store";
import { isDuplicateMode$ } from "@/infrastructure/state/ui-store";
import type { MomentGroup } from "@/lib/grouping";
import { cn } from "@/lib/utils";
import { EmptyMomentCard } from "./EmptyMomentCard";
import { MomentCard } from "./MomentCard";

interface DrawingBoardColumnProps {
  group: MomentGroup;
  groupBy: DrawingBoardGroupBy;
  isOnlyColumn?: boolean; // True when there's only one column (skip horizontal layout)
  onCreateMoment?: (areaId?: string, horizon?: string) => void;
}

/**
 * DrawingBoardColumn - Single sortable column for grouped moments
 *
 * Features:
 * - Displays moments in a vertical list
 * - Shows column header with count badge
 * - Supports drag-and-drop between columns (for area grouping)
 * - Minimal design with colored left border instead of background
 * - Click empty area to create moment with column properties
 * - Read-only grouping (created/horizon) prevents cross-column dragging
 */
export function DrawingBoardColumn({
  group,
  groupBy,
  isOnlyColumn = false,
  onCreateMoment,
}: DrawingBoardColumnProps) {
  const allAreas = use$(areas$);

  // Droppable configuration for the column
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${group.groupId}`,
    data: {
      targetType: "drawing-board-column" as const,
      columnId: group.groupId,
      groupBy,
    },
  });

  // Only allow drops for area grouping
  const canAcceptDrops = groupBy === "area";

  // Only allow click-to-create for area and horizon grouping (not created)
  const canCreateFromColumn = groupBy !== "created" && onCreateMoment;

  // Handle click on empty area
  const handleEmptyClick = () => {
    if (!canCreateFromColumn) return;

    if (groupBy === "area") {
      // Create with this area pre-selected
      onCreateMoment(group.groupId);
    } else if (groupBy === "cycle") {
      // Create with this cycle pre-selected
      const cycleValue = group.groupId.replace("cycle-", "");
      onCreateMoment(undefined, cycleValue === "unset" ? "" : cycleValue);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col transition-all rounded-lg snap-start",
        isOnlyColumn ? "min-h-[350px]" : "min-w-[280px] max-w-[320px]",
        canAcceptDrops && isOver && "bg-stone-50 dark:bg-stone-900"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {group.emoji && (
            <span className="text-base" aria-hidden="true">
              {group.emoji}
            </span>
          )}
          <h3 className="text-sm font-mono font-medium text-stone-700 dark:text-stone-300">
            {group.groupLabel}
          </h3>
          <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
            {group.moments.length}
          </span>
        </div>
      </div>

      {/* Colored Divider */}
      <div
        className="h-[3px] mx-4 mb-2"
        style={{
          backgroundColor: group.color || "#d6d3d1", // stone-300 fallback
        }}
      />

      {/* Column Content */}
      <SortableContext
        items={group.moments.map((m) => m.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-3 p-4 min-h-[300px] pb-48">
          {group.moments.map((moment) => {
            const area = allAreas[moment.areaId];
            if (!area) return null;

            return (
              <SortableMomentCard
                key={moment.id}
                moment={moment}
                area={area}
                canDragBetweenColumns={canAcceptDrops}
                contextMomentIds={group.moments.map((m) => m.id)}
              />
            );
          })}

          {/* Always show EmptyMomentCard at the end if creation is allowed */}
          {canCreateFromColumn && (
            <EmptyMomentCard
              onClick={handleEmptyClick}
              label={
                groupBy === "area"
                  ? `Add to ${group.groupLabel}`
                  : "Add moment"
              }
            />
          )}

          {/* Show message if no creation allowed */}
          {!canCreateFromColumn && group.moments.length === 0 && (
            <div className="flex items-center justify-center min-h-[200px]">
              <p className="text-xs text-stone-400 font-mono text-center">
                No moments here yet
              </p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

/**
 * SortableMomentCard - Draggable moment card within a column
 */
interface SortableMomentCardProps {
  moment: Moment;
  area: Area;
  canDragBetweenColumns: boolean;
  contextMomentIds?: string[];
}

function SortableMomentCard({
  moment,
  area,
  canDragBetweenColumns,
  contextMomentIds,
}: SortableMomentCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: moment.id,
    data: {
      momentId: moment.id,
      sourceType: "drawing-board" as const,
      canDragBetweenColumns,
    },
  });

  const isDuplicateMode = use$(isDuplicateMode$);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Don't apply transform when dragging in duplicate mode - original should stay put
    opacity: isDragging && !isDuplicateMode ? 0.5 : 1,
    // Prevent browser scroll/pan interference during touch drag
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <MomentCard moment={moment} area={area} contextMomentIds={contextMomentIds} />
    </div>
  );
}
