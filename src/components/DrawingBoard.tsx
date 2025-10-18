"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { use$ } from "@legendapp/state/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import { cn } from "@/lib/utils";
import type { DropTargetType } from "@/types/dnd";
import { areas$, unallocatedMoments$ } from "@/infrastructure/state/store";
import { MomentCard } from "./MomentCard";

/**
 * DrawingBoard - Collapsible container for unallocated moments
 *
 * Features:
 * - Displays all moments that haven't been allocated to a day/phase
 * - Use global Shift+M to create new moments
 * - Collapsible to save space
 * - Supports drag and drop to/from timeline
 */
export function DrawingBoard() {
  const [isExpanded, setIsExpanded] = useState(true);
  const unallocated = use$(unallocatedMoments$);
  const allAreas = use$(areas$);

  // Droppable configuration
  const { setNodeRef, isOver } = useDroppable({
    id: "drawing-board",
    data: {
      targetType: "drawing-board" as DropTargetType,
    },
  });

  return (
    <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-6 py-3 text-left hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 uppercase tracking-wider font-semibold">
            Drawing Board
          </h2>
          <span className="rounded-full bg-stone-200 dark:bg-stone-700 px-2.5 py-0.5 text-xs font-medium text-stone-700 dark:text-stone-300">
            {unallocated.length}
          </span>
          <p className="text-xs text-stone-400 font-mono hidden sm:block">
            Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700">
              Shift+M
            </kbd>{" "}
            to create
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-stone-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-stone-500" />
        )}
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div
          ref={setNodeRef}
          className={cn(
            "border-t border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 p-8",
            "transition-all",
            "min-h-[400px]", // Huge droppable area
            isOver
              ? "bg-stone-100/50 dark:bg-stone-800/50 border-2 border-dashed border-stone-400"
              : ""
          )}
        >
          {/* Unallocated moments */}
          {unallocated.length === 0 ? (
            <div className="min-h-[350px] flex flex-col items-center justify-center gap-3">
              <p className="text-stone-400 text-sm font-mono text-center">
                No unallocated moments yet
              </p>
              <p className="text-xs text-stone-500 font-mono">
                Press{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700">
                  Shift+M
                </kbd>{" "}
                to create your first moment
              </p>
            </div>
          ) : (
            <SortableContext items={unallocated.map((m) => m.id)}>
              <div className="flex flex-wrap gap-3 items-start content-start min-h-[350px]">
                {unallocated.map((moment) => {
                  const area = allAreas[moment.areaId];
                  if (!area) return null;

                  return (
                    <SortableMomentCard
                      key={moment.id}
                      moment={moment}
                      area={area}
                    />
                  );
                })}
              </div>
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * SortableMomentCard - Wrapper for drawing board moments
 *
 * Wraps MomentCard with useSortable to enable:
 * - Dragging to timeline cells
 * - Reordering within drawing board
 */
interface SortableMomentCardProps {
  moment: Moment;
  area: Area;
}

function SortableMomentCard({ moment, area }: SortableMomentCardProps) {
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
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: "200px",
    flexShrink: 0,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <MomentCard moment={moment} area={area} />
    </div>
  );
}
