/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useAriaPropsSupportedByRole: <explanation> */
"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { use$ } from "@legendapp/state/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useMomentManager } from "@/contexts/MomentManagerContext";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import {
  activeAreas$,
  areas$,
  unallocatedMoments$,
} from "@/infrastructure/state/store";
import {
  drawingBoardExpanded$,
  drawingBoardGroupBy$,
  drawingBoardSortMode$,
  isDuplicateMode$,
} from "@/infrastructure/state/ui-store";
import { groupByArea, groupByCreated, groupByHorizon } from "@/lib/grouping";
import { cn } from "@/lib/utils";
import type { DropTargetType } from "@/types/dnd";
import { DrawingBoardColumn } from "./DrawingBoardColumn";
import { DrawingBoardToolbar } from "./DrawingBoardToolbar";
import { MomentCard } from "./MomentCard";

interface DrawingBoardProps {
  onEditArea?: (areaId: string) => void;
}

/**
 * DrawingBoard - Collapsible container for unallocated moments
 *
 * Features:
 * - Displays all moments that haven't been allocated to a day/phase
 * - Use global N to create new moments
 * - Collapsible to save space
 * - Supports drag and drop to/from timeline
 */
export function DrawingBoard({ onEditArea }: DrawingBoardProps = {}) {
  const isExpanded = use$(drawingBoardExpanded$);
  const unallocated = use$(unallocatedMoments$);
  const allAreas = use$(areas$); // All areas including archived (for moment card display)
  const activeAreasArray = use$(activeAreas$); // Only active areas (for grouping columns)
  const groupBy = use$(drawingBoardGroupBy$);
  const sortMode = use$(drawingBoardSortMode$);
  const { handleOpenCreateModal } = useMomentManager();
  const containerRef = useRef<HTMLDivElement>(null);

  // Droppable configuration (only for flat "none" view)
  const { setNodeRef, isOver } = useDroppable({
    id: "drawing-board",
    data: {
      targetType: "drawing-board" as DropTargetType,
    },
  });

  // Smooth scroll to DrawingBoard when expanded
  useEffect(() => {
    if (isExpanded && containerRef.current) {
      // Smooth scroll to bring DrawingBoard into view
      containerRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [isExpanded]);

  // Group moments based on current groupBy setting
  // Convert activeAreasArray back to Record for groupByArea compatibility
  const activeAreasRecord = useMemo(() => {
    return activeAreasArray.reduce((acc, area) => {
      acc[area.id] = area;
      return acc;
    }, {} as Record<string, (typeof activeAreasArray)[0]>);
  }, [activeAreasArray]);

  const groups = useMemo(() => {
    switch (groupBy) {
      case "area":
        // Use activeAreasRecord so only active areas get columns
        return groupByArea(unallocated, activeAreasRecord);
      case "created":
        return groupByCreated(unallocated);
      case "horizon":
        return groupByHorizon(unallocated);
      case "none":
        return null;
      default:
        return null;
    }
  }, [groupBy, unallocated, activeAreasRecord]);

  // Sort unallocated moments for flat view
  const sortedUnallocated = useMemo(() => {
    if (sortMode === "manual") {
      // Manual mode: just sort by order (user controls the order via drag-and-drop)
      return [...unallocated].sort((a, b) => a.order - b.order);
    }

    // Auto mode: sort by order (primary) and creation date (secondary)
    return [...unallocated].sort((a, b) => {
      // Primary sort: by order
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      // Secondary sort: by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [unallocated, sortMode]);

  const handleCreateFromColumn = (areaId?: string, cycle?: string) => {
    // Open create modal with pre-filled properties
    handleOpenCreateModal(undefined, undefined, areaId, cycle);
  };

  const label = "Planning (P)";

  // Unified structure with animated expand/collapse
  return (
    <div
      ref={containerRef}
      className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex-shrink-0"
    >
      {/* Header - Toggles expand/collapse */}
      <button
        type="button"
        onClick={() => drawingBoardExpanded$.set(!isExpanded)}
        className="flex w-full items-center justify-between px-6 py-3 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all duration-fast transition-smooth"
        style={{
          borderBottom: isExpanded
            ? "1px solid var(--border)"
            : "none",
        }}
      >
        <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 uppercase tracking-wider font-semibold">
          {label}
        </h2>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-stone-500 transition-transform duration-medium transition-elastic" />
        ) : (
          <ChevronUp className="h-4 w-4 text-stone-500 transition-transform duration-medium transition-elastic" />
        )}
      </button>

      {/* Content Area - Animated with grid-rows approach */}
      <div
        className={cn(
          "bg-white dark:bg-stone-950 grid transition-all duration-medium transition-elastic overflow-hidden",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
        {/* Toolbar with grouping and sorting controls */}
        <DrawingBoardToolbar />

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
                  onEditArea={onEditArea}
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
              // Smooth transitions for drag-over states
              "transition-all duration-fast transition-smooth relative",
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
            {sortedUnallocated.length === 0 ? (
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
                {sortedUnallocated.map((moment) => {
                  const area = allAreas[moment.areaId];
                  if (!area) return null;

                  return (
                    <DraggableMomentCard
                      key={moment.id}
                      moment={moment}
                      area={area}
                      contextMomentIds={sortedUnallocated.map((m) => m.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
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
