"use client";

import { useDraggable } from "@dnd-kit/core";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import React from "react";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import { cn } from "@/lib/utils";
import { MomentCard } from "./MomentCard";

interface MomentStackProps {
  moments: Moment[];
  area: Area;
  // Optional count controls for cycle planning
  onIncrement?: () => void;
  onDecrement?: () => void;
  onRemove?: () => void;
}

/**
 * MomentStack - Visual representation of multiple moment cards stacked together
 *
 * Features:
 * - Shows up to 2 visual stack layers behind the top card
 * - Displays counter badge (x{count}) when count > 1 or controls provided
 * - Optional count controls integrated in badge
 * - Renders top moment as an actual MomentCard
 * - Fully draggable via @dnd-kit
 *
 * Design:
 * - Area color with opacity for depth (50% → 40% → top card 100%)
 * - Stack layers: centered, progressively smaller cards creating pyramid effect
 * - Each layer scales down (95% → 90%) and offsets vertically (-4px, -8px)
 * - Correct z-index order: furthest back has lowest z-index
 * - Counter badge layouts:
 *   - count = 1: [×] x1 [↑] (remove, increment)
 *   - count > 1: [↓] x{count} [↑] (decrement, increment)
 */
export function MomentStack({
  moments,
  area,
  onIncrement,
  onDecrement,
  onRemove,
}: MomentStackProps) {
  // Handle empty array
  if (moments.length === 0) {
    return null;
  }

  const topMoment = moments[0];
  const count = moments.length;

  // Calculate how many visual layers to show behind the top card
  // Show count-1 layers (e.g., if count=3, show 2 layers behind)
  const behindLayerCount = Math.min(count - 1, 2); // Max 2 layers behind
  const showLayers = count > 1;
  // Show badge if count > 1 (visual stack indicator) OR if controls are provided (interaction needed)
  const showBadge = count > 1 || !!(onIncrement || onDecrement);
  const hasControls = !!(onIncrement || onDecrement || onRemove);

  // Setup draggable for the top moment
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `stack-${topMoment.id}`,
    data: {
      momentId: topMoment.id,
      sourceType: "cycle-deck",
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="relative transition-opacity duration-150 w-full"
      data-draggable="true"
      data-moment-id={topMoment.id}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? "grabbing" : "grab",
        // Reserve fixed padding when controls present (prevents jitter on count change)
        // Without controls, use dynamic padding based on actual layers
        paddingTop: hasControls
          ? "8px"
          : showLayers
            ? `${behindLayerCount * 4}px`
            : 0,
      }}
    >
      {/* Visual stack layers - rendered behind the top card, centered and scaled */}
      {showLayers &&
        Array.from({ length: behindLayerCount }).map((_, i) => {
          // Layer index (0 = first behind, 1 = second behind)
          // Calculate scale: 95% for first behind, 90% for second behind
          const scale = 1 - (i + 1) * 0.05;
          // Calculate vertical offset: stack upward from the top card
          const yOffset = -(i + 1) * 2; // 4px per layer
          // Calculate opacity: 40% for first behind, 30% for second behind
          const opacity = 0.5 - (i + 1) * 0.1;
          // Calculate z-index: reverse order so furthest back has lowest z-index
          const zIndex = behindLayerCount - i;

          return (
            <div
              key={`${topMoment.id}-layer-${i}`}
              data-testid="stack-layer"
              className="absolute left-1/2 -translate-x-1/2 rounded-lg"
              style={{
                // Center horizontally and scale down
                width: `${scale * 100}%`,
                height: "64px", // Match momentCard.minHeight
                bottom: `${yOffset}px`,
                zIndex,
                // Use area color with opacity for depth
                backgroundColor: area.color,
                opacity,
              }}
            />
          );
        })}

      {/* Top moment card - actual interactive card */}
      <div className="relative" style={{ zIndex: behindLayerCount + 1 }}>
        <MomentCard moment={topMoment} area={area} />

        {/* Counter badge with optional controls */}
        {showBadge && (
          <div
            data-testid="stack-counter"
            className={cn(
              "absolute -top-2 -right-2 rounded-md bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-xs font-mono font-medium shadow-sm",
              onIncrement || onDecrement || onRemove
                ? "flex items-center gap-0.5 px-1 py-0.5"
                : "px-2 py-0.5"
            )}
            style={{ zIndex: behindLayerCount + 2 }}
          >
            {/* Left button: X when count=1, chevron down when count>1 */}
            {count === 1 && onRemove ? (
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

            {/* Count display */}
            <span className="px-1">x{count}</span>

            {/* Chevron up (right side) */}
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
