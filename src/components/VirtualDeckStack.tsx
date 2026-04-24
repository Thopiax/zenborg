"use client";

import { useDraggable } from "@dnd-kit/core";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import { cn } from "@/lib/utils";
import type { DraggableData } from "@/types/dnd";
import { VirtualDeckCard } from "./VirtualDeckCard";

interface VirtualDeckStackProps {
  cycleId: string;
  habit: Habit;
  area: Area;
  /** Number of virtual ghost slots (budgetedCount minus allocatedCount). */
  count: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onRemove?: () => void;
}

/**
 * VirtualDeckStack — one draggable stack representing N virtual ghosts.
 *
 * Mirrors MomentStack's visual language (stacked layers behind the top card,
 * counter badge with +/- controls) but is backed by a habit template instead
 * of materialized moments. One drop allocates one ghost via `allocateFromPlan`.
 */
export function VirtualDeckStack({
  cycleId,
  habit,
  area,
  count,
  onIncrement,
  onDecrement,
  onRemove,
}: VirtualDeckStackProps) {
  const behindLayerCount = Math.min(Math.max(count - 1, 0), 2);
  const showLayers = count > 1;
  // Always show the counter so count=0 stacks read as "fully allocated",
  // not as identical to count=1.
  const showBadge = true;

  const dragData: DraggableData = {
    type: "deck-card",
    cycleId,
    habitId: habit.id,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `deck-stack-${cycleId}-${habit.id}`,
    data: dragData,
    disabled: count === 0,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid="deck-stack"
      data-habit-id={habit.id}
      data-cycle-id={cycleId}
      className="relative transition-opacity duration-150 w-full"
      style={{
        opacity: isDragging ? 0.5 : count === 0 ? 0.5 : 1,
        cursor: count === 0 ? "default" : isDragging ? "grabbing" : "grab",
        paddingTop: showLayers ? `${behindLayerCount * 4}px` : 0,
      }}
    >
      {/* Stack layers behind the top card */}
      {showLayers &&
        Array.from({ length: behindLayerCount }).map((_, i) => {
          const scale = 1 - (i + 1) * 0.05;
          const yOffset = -(i + 1) * 2;
          const opacity = 0.5 - (i + 1) * 0.1;
          const zIndex = behindLayerCount - i;
          return (
            <div
              key={`${habit.id}-layer-${i}`}
              data-testid="deck-stack-layer"
              className="absolute left-1/2 -translate-x-1/2 rounded-lg"
              style={{
                width: `${scale * 100}%`,
                height: "64px",
                bottom: `${yOffset}px`,
                zIndex,
                backgroundColor: area.color,
                opacity,
              }}
            />
          );
        })}

      {/* Top card + counter badge */}
      <div className="relative" style={{ zIndex: behindLayerCount + 1 }}>
        <VirtualDeckCard
          cycleId={cycleId}
          habit={habit}
          area={area}
          slotIndex={0}
          asPresentational
        />

        {showBadge && (
          <div
            data-testid="deck-stack-counter"
            className={cn(
              "absolute -top-2 -right-2 rounded-md bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-xs font-mono font-medium shadow-sm",
              "flex items-center gap-0.5 px-1 py-0.5",
            )}
            style={{ zIndex: behindLayerCount + 2 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {count <= 1 && onRemove ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="p-0.5 rounded hover:bg-red-600 dark:hover:bg-red-400 transition-colors"
                title="Remove from cycle"
              >
                <X className="h-3 w-3" />
              </button>
            ) : count > 1 && onDecrement ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDecrement();
                }}
                className="p-0.5 rounded hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
                title="Decrease count"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            ) : null}

            <span className="px-1">x{count}</span>

            {onIncrement && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrement();
                }}
                className="p-0.5 rounded hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
                title="Increase count"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
