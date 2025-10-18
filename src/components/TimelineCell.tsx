/** biome-ignore-all lint/a11y/useSemanticElements: <explanation> */
"use client";

import { use$ } from "@legendapp/state/react";
import type { Moment } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";
import { useFocusManager } from "@/hooks/useFocusManager";
import { areas$, moments$ } from "@/infrastructure/state/store";
import {
  ariaLabels,
  getFocusRingClasses,
  momentConstraints,
} from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { MomentCard } from "./MomentCard";

interface TimelineCellProps {
  day: string; // ISO date
  phase: Phase;
  isHighlighted?: boolean; // True for "Today" column
  dayLabel?: string; // "Yesterday", "Today", "Tomorrow"
  phaseLabel?: string; // "Morning", "Afternoon", etc.
  phaseIndex?: number; // Phase row index for alternating greyscale tints (0, 1, 2)
}

/**
 * TimelineCell - Grid cell that holds 0-3 moments
 *
 * Design Philosophy:
 * - Monochromatic design with greyscale tints for phase differentiation
 * - No color accents (phase rows use subtle grey background gradients)
 * - Full ARIA support for screen readers
 * - Mode-specific focus ring (violet for cell navigation)
 * - Theme-aware (light/dark)
 * - Font weight emphasis for "Today" column
 *
 * Features:
 * - Displays up to 3 moments for a given (day, phase) combination
 * - Enforces max-3-per-cell constraint visually
 * - Shows empty state when no moments with helpful hints
 * - Font weight emphasis for "Today" column (no colored borders)
 * - Greyscale background tints for phase rows
 * - Focusable for keyboard navigation
 * - ARIA live region for full state announcements
 */
export function TimelineCell({
  day,
  phase,
  isHighlighted = false,
  dayLabel,
  phaseLabel,
  phaseIndex = 0,
}: TimelineCellProps) {
  const allMoments = use$(moments$);
  const allAreas = use$(areas$);
  const { focusedMomentId, focusedCell, focusMoment, focusCell } =
    useFocusManager();

  // Get moments for this cell
  const cellMoments: Moment[] = Object.values(allMoments)
    .filter((m) => m.day === day && m.phase === phase)
    .sort((a, b) => a.order - b.order);

  const isFull = cellMoments.length >= 3;
  const isCellFocused =
    focusedCell?.day === day && focusedCell?.phase === phase;

  const handleUpdate = (momentId: string, newName: string) => {
    // Update moment name in state
    const moment = allMoments[momentId];
    if (moment) {
      moments$[momentId].name.set(newName);
      moments$[momentId].updatedAt.set(new Date().toISOString());
    }
  };

  // Generate accessible label
  const cellLabel =
    dayLabel && phaseLabel
      ? ariaLabels.timelineCell(
          dayLabel,
          phaseLabel,
          cellMoments.length,
          momentConstraints.maxMomentsPerCell
        )
      : `${day} ${phase}, ${cellMoments.length} of ${momentConstraints.maxMomentsPerCell} moments`;

  // Greyscale phase background tints (light to dark progression)
  const phaseBackgrounds = [
    "bg-stone-50 dark:bg-stone-950/20", // Phase 0 (lightest in both modes)
    "bg-stone-100 dark:bg-stone-900/40", // Phase 1 (medium)
    "bg-stone-150 dark:bg-stone-800/60", // Phase 2 (darker)
    "bg-stone-200 dark:bg-stone-700/80", // Phase 3 (darkest)
  ];

  return (
    <div
      className={cn(
        "min-h-[200px] p-4 rounded-lg border",
        "transition-all",
        "focus-within:outline-none",
        "cursor-pointer",
        // Phase background (greyscale tint)
        phaseBackgrounds[phaseIndex % phaseBackgrounds.length],
        // Border style
        "border-stone-200 dark:border-stone-700",
        // Cell focus ring (violet for timeline navigation)
        isCellFocused && getFocusRingClasses("cell"),
        // Full state indicator
        isFull && "border-l-2 border-l-stone-400 dark:border-l-stone-500"
      )}
      data-cell={`${day}-${phase}`}
      onClick={() => focusCell(day, phase)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          focusCell(day, phase);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={cellLabel}
      aria-live={isFull ? "polite" : "off"}
      aria-atomic="true"
    >
      {cellMoments.length > 0 && (
        <>
          {cellMoments.map((moment) => {
            // Get area from the extracted values (use$ already unwrapped it)
            const area = allAreas[moment.areaId];
            if (!area) return null;

            return (
              <MomentCard
                key={moment.id}
                moment={moment}
                area={area}
                isFocused={focusedMomentId === moment.id}
                onFocus={() => focusMoment(moment.id)}
                onUpdate={(newName) => handleUpdate(moment.id, newName)}
              />
            );
          })}
        </>
      )}
      {isFull && (
        <output
          className="text-xs text-stone-600 dark:text-stone-400 font-mono mt-2 flex items-center gap-2"
          aria-live="polite"
        >
          <span
            className="w-2 h-2 rounded-full bg-stone-500 dark:bg-stone-500"
            aria-hidden="true"
          />
          <span>
            Full ({cellMoments.length}/{momentConstraints.maxMomentsPerCell})
          </span>
        </output>
      )}
    </div>
  );
}
