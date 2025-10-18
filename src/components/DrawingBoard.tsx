"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { use$ } from "@legendapp/state/react";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import {
  areas$,
  moments$,
  unallocatedMoments$,
} from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";
import type { DropTargetType } from "@/types/dnd";
import { MomentCard } from "./MomentCard";

/**
 * DrawingBoard - Container for unallocated moments
 *
 * Features:
 * - Displays all moments that haven't been allocated to a day/phase
 * - Use global Shift+M to create new moments
 * - Desktop: sidebar, Mobile: below timeline
 */
export function DrawingBoard() {
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
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-mono text-stone-600 dark:text-stone-400 uppercase tracking-wider">
          Drawing Board
        </h2>
        <p className="text-xs text-stone-400 font-mono">
          Press{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700">
            Shift+M
          </kbd>{" "}
          to create
        </p>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "space-y-3 p-6 rounded-lg border-2 border-dashed transition-all",
          "min-h-[400px]",
          isOver
            ? "border-stone-400 bg-stone-100/50 dark:bg-stone-800/50"
            : "border-stone-200 dark:border-stone-700"
        )}
      >
        {/* Unallocated moments */}
        {unallocated.length === 0 ? (
          <div className="min-h-[200px] flex flex-col items-center justify-center gap-3">
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
          unallocated.map((moment) => {
            const area = allAreas[moment.areaId];
            if (!area) return null;

            return (
              <DraggableMomentCard
                key={moment.id}
                moment={moment}
                area={area}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * DraggableMomentCard - Wrapper for drawing board moments
 *
 * Wraps MomentCard with useDraggable to enable dragging to timeline cells.
 */
interface DraggableMomentCardProps {
  moment: Moment;
  area: Area;
}

function DraggableMomentCard({ moment, area }: DraggableMomentCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: moment.id,
      data: {
        momentId: moment.id,
        sourceType: "drawing-board" as const,
      },
    });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <MomentCard moment={moment} area={area} />
    </div>
  );
}
