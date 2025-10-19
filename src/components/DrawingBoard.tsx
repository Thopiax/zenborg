/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useAriaPropsSupportedByRole: <explanation> */
"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { use$ } from "@legendapp/state/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMomentManager } from "@/contexts/MomentManagerContext";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import { areas$, unallocatedMoments$ } from "@/infrastructure/state/store";
import {
  type DrawingBoardGroupBy,
  drawingBoardExpanded$,
  drawingBoardGroupBy$,
  isDuplicateMode$,
} from "@/infrastructure/state/ui-store";
import { groupByArea, groupByCreated, groupByCycle } from "@/lib/grouping";
import { cn } from "@/lib/utils";
import type { DropTargetType } from "@/types/dnd";
import { DrawingBoardColumn } from "./DrawingBoardColumn";
import { MomentCard } from "./MomentCard";

/**
 * DrawingBoard - Collapsible container for unallocated moments
 *
 * Features:
 * - Displays all moments that haven't been allocated to a day/phase
 * - Use global N to create new moments
 * - Collapsible to save space
 * - Supports drag and drop to/from timeline
 */
export function DrawingBoard() {
  const isExpanded = use$(drawingBoardExpanded$);
  const unallocated = use$(unallocatedMoments$);
  const allAreas = use$(areas$);
  const groupBy = use$(drawingBoardGroupBy$);
  const { handleOpenCreateModal } = useMomentManager();

  // Droppable configuration (only for flat "none" view)
  const { setNodeRef, isOver } = useDroppable({
    id: "drawing-board",
    data: {
      targetType: "drawing-board" as DropTargetType,
    },
  });

  // Group moments based on current groupBy setting
  const groups =
    groupBy === "area"
      ? groupByArea(unallocated, allAreas)
      : groupBy === "created"
      ? groupByCreated(unallocated)
      : groupBy === "cycle"
      ? groupByCycle(unallocated)
      : null;

  const handleGroupByChange = (value: DrawingBoardGroupBy) => {
    drawingBoardGroupBy$.set(value);
  };

  const handleCreateFromColumn = (areaId?: string, cycle?: string) => {
    // Open create modal with pre-filled properties
    handleOpenCreateModal(undefined, undefined, areaId, cycle);
  };

  const label = "Planning (P)";

  // Collapsed state - sticky banner at bottom
  if (!isExpanded) {
    return (
      <div className="fixed bottom-0 left-0 right-0 w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 z-30">
        <button
          type="button"
          onClick={() => drawingBoardExpanded$.set(true)}
          className="w-full px-6 py-3 flex items-center justify-between hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 uppercase tracking-wider font-semibold">
            {label}
          </h2>
          <ChevronUp className="h-4 w-4 text-stone-500" />
        </button>
      </div>
    );
  }

  // Expanded state - full DrawingBoard
  return (
    <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900">
      {/* Header - Fully clickable to close */}
      <button
        type="button"
        onClick={() => drawingBoardExpanded$.set(false)}
        className="flex w-full items-center justify-between px-6 py-3 border-b border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
      >
        <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 uppercase tracking-wider font-semibold">
          {label}
        </h2>
        <ChevronDown className="h-4 w-4 text-stone-500" />
      </button>

      {/* Content Area */}
      <div className="bg-white dark:bg-stone-950">
        {/* Group by selector inside content area */}
        <div className="flex items-center gap-2 px-6 pt-6 pb-3">
          <span className="text-xs text-stone-500 font-mono">Group by:</span>
          <Select value={groupBy} onValueChange={handleGroupByChange}>
            <SelectTrigger className="h-7 w-[140px] text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="area">Area</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="cycle">Cycle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grouped or Flat Layout */}
        {groups ? (
          <div>
            <div className="flex gap-4 overflow-x-auto px-6 py-8 snap-x snap-mandatory scroll-smooth">
              {groups.map((group) => (
                <DrawingBoardColumn
                  key={group.groupId}
                  group={group}
                  groupBy={groupBy}
                  onCreateMoment={handleCreateFromColumn}
                />
              ))}
            </div>
          </div>
        ) : (
          /* Flat Layout (no grouping) */
          <div
            ref={setNodeRef}
            className={cn(
              "bg-white dark:bg-stone-950 p-8",
              "transition-all duration-200 relative",
              "min-h-[400px] w-full",
              isOver && "bg-stone-100/30 dark:bg-stone-800/30"
            )}
          >
            {/* Drop Zone Indicator - Only visible when dragging over */}
            {isOver && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="border-4 border-dashed border-stone-400 dark:border-stone-500 rounded-xl absolute inset-4 bg-stone-100/20 dark:bg-stone-800/20 animate-pulse">
                  <div className="flex items-center justify-center h-full">
                    <div className="bg-stone-800/90 dark:bg-stone-200/90 text-white dark:text-stone-900 px-6 py-3 rounded-lg shadow-lg">
                      <p className="text-lg font-bold font-mono">
                        Drop here to unallocate
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Unallocated moments */}
            {unallocated.length === 0 ? (
              <div className="min-h-[350px] flex flex-col items-center justify-center gap-3">
                <p className="text-stone-400 text-sm font-mono text-center">
                  No unallocated moments yet
                </p>
                <p className="text-xs text-stone-500 font-mono">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700">
                    N
                  </kbd>{" "}
                  to create your first moment
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 items-start content-start min-h-[350px]">
                {unallocated.map((moment) => {
                  const area = allAreas[moment.areaId];
                  if (!area) return null;

                  return (
                    <DraggableMomentCard
                      key={moment.id}
                      moment={moment}
                      area={area}
                      contextMomentIds={unallocated.map((m) => m.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * DraggableMomentCard - Wrapper for drawing board moments
 *
 * Wraps MomentCard with useDraggable to enable:
 * - Dragging to timeline cells
 */
interface DraggableMomentCardProps {
  moment: Moment;
  area: Area;
  contextMomentIds?: string[];
}

function DraggableMomentCard({
  moment,
  area,
  contextMomentIds,
}: DraggableMomentCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: moment.id,
      data: {
        momentId: moment.id,
        sourceType: "drawing-board" as const,
      },
    });

  const isDuplicateMode = use$(isDuplicateMode$);

  const style = {
    // Don't apply transform when dragging in duplicate mode - original should stay put
    transform:
      isDragging && isDuplicateMode
        ? "translate3d(0, 0, 0)"
        : transform
        ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
        : undefined,
    // Keep original visible when in duplicate mode
    opacity: isDragging && !isDuplicateMode ? 0.5 : 1,
    width: "300px",
    flexShrink: 0,
    // Prevent browser scroll/pan interference during touch drag
    touchAction: "none",
    // Cursor feedback for trackpad/mouse users (iPad with trackpad)
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <MomentCard
        moment={moment}
        area={area}
        contextMomentIds={contextMomentIds}
      />
    </div>
  );
}
