"use client";

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { use$ } from "@legendapp/state/react";
import { MomentCard } from "./MomentCard";
import type { Moment } from "@/domain/entities/Moment";
import type { Area } from "@/domain/entities/Area";

interface MomentStackProps {
  moments: Moment[];
  area: Area;
}

/**
 * MomentStack - Visual representation of multiple moment cards stacked together
 *
 * Features:
 * - Shows up to 3 visual stack layers (for depth perception)
 * - Displays counter badge (x{count}) when count > 1
 * - Renders top moment as an actual MomentCard
 * - Designed for drag & drop (future: draggable top card)
 *
 * Design:
 * - Stone monochrome base colors (following design system)
 * - Stack layers: subtle offset to create depth
 * - Counter badge: top-right corner, dark background
 */
export function MomentStack({ moments, area }: MomentStackProps) {
  // Handle empty array
  if (moments.length === 0) {
    return null;
  }

  const topMoment = moments[0];
  const count = moments.length;

  // Calculate how many visual layers to show (max 3)
  const layerCount = Math.min(count, 3);
  const showLayers = count > 1;
  const showBadge = count > 1;

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
      className="relative transition-opacity duration-150"
      data-draggable="true"
      data-moment-id={topMoment.id}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      aria-label={`Stack of ${count} ${topMoment.name} moment${count > 1 ? "s" : ""}, draggable`}
    >
      {/* Visual stack layers - rendered behind the top card */}
      {showLayers &&
        Array.from({ length: layerCount }).map((_, i) => (
          <div
            key={i}
            data-testid="stack-layer"
            className="absolute w-full h-full rounded-lg bg-stone-300 dark:bg-stone-600 border border-stone-400 dark:border-stone-500"
            style={{
              // Offset each layer down and to the right (bottom layer first)
              top: `${(layerCount - 1 - i) * 4}px`,
              left: `${(layerCount - 1 - i) * 2}px`,
              zIndex: i,
            }}
          />
        ))}

      {/* Top moment card - actual interactive card */}
      <div className="relative" style={{ zIndex: layerCount }}>
        <MomentCard moment={topMoment} area={area} />

        {/* Counter badge */}
        {showBadge && (
          <div
            data-testid="stack-counter"
            className="absolute -top-2 -right-2 px-2 py-0.5 rounded-md bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-xs font-mono font-medium"
            style={{ zIndex: layerCount + 1 }}
          >
            x{count}
          </div>
        )}
      </div>
    </div>
  );
}
