/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useAriaPropsSupportedByRole: <explanation> */
"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { use$ } from "@legendapp/state/react";
import { Archive, Edit, MoreVertical } from "lucide-react";
import { useState } from "react";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import { areas$ } from "@/infrastructure/state/store";
import type { DrawingBoardGroupBy } from "@/infrastructure/state/ui-store";
import {
  isDuplicateMode$,
  openArchiveAreaDialog,
} from "@/infrastructure/state/ui-store";
import type { MomentGroup } from "@/lib/grouping";
import { cn } from "@/lib/utils";
import { EmptyMomentCard } from "./EmptyMomentCard";
import { MomentCard } from "./MomentCard";

interface DrawingBoardColumnProps {
  group: MomentGroup;
  groupBy: DrawingBoardGroupBy;
  isOnlyColumn?: boolean; // True when there's only one column (skip horizontal layout)
  onCreateMoment?: (areaId?: string, horizon?: string) => void;
  onEditArea?: (areaId: string) => void; // Open area management modal focused on this area
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
  onEditArea,
}: DrawingBoardColumnProps) {
  const allAreas = use$(areas$);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    } else if (groupBy === "horizon") {
      // Create with this horizon pre-selected
      const horizonValue = group.groupId.replace("horizon-", "");
      onCreateMoment(undefined, horizonValue === "unset" ? "" : horizonValue);
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

        {/* Area menu (only for area grouping) */}
        {groupBy === "area" && onEditArea && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
              aria-label="Area options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsMenuOpen(false)}
                  aria-hidden="true"
                />

                {/* Dropdown menu */}
                <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg min-w-[160px] py-1">
                  <button
                    type="button"
                    onClick={() => {
                      onEditArea(group.groupId);
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Area
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openArchiveAreaDialog(group.groupId, group.groupLabel);
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors flex items-center gap-2"
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </button>
                </div>
              </>
            )}
          </div>
        )}
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
          {/* Empty state for area grouping when no moments */}
          {groupBy === "area" && group.moments.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[240px] gap-3 py-8">
              <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                <span className="text-2xl" aria-hidden="true">
                  {group.emoji || "📝"}
                </span>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-stone-600 dark:text-stone-400">
                  No {group.groupLabel} moments yet
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-500">
                  Click below to add your first
                </p>
              </div>
            </div>
          )}

          {/* Existing moments */}
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
                groupBy === "area" ? `add to ${group.groupLabel}` : "add moment"
              }
            />
          )}

          {/* Show message if no creation allowed (for read-only groupings) */}
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
      <MomentCard
        moment={moment}
        area={area}
        contextMomentIds={contextMomentIds}
      />
    </div>
  );
}
