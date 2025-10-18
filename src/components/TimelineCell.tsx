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
  momentCard,
  momentConstraints,
  phaseBackgrounds,
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
 * - Clean, minimalist design with subtle backgrounds
 * - Moment cards have full area-colored backgrounds
 * - Proper vertical spacing to fit exactly 3 cards
 * - Full ARIA support for screen readers
 * - Mode-specific focus ring (violet for cell navigation)
 * - Theme-aware (light/dark)
 *
 * Layout:
 * - Min height: 240px (3 cards × 64px + 2 gaps × 12px + padding)
 * - Card gap: 12px between cards
 * - Cell padding: 16px
 *
 * Features:
 * - Displays up to 3 moments for a given (day, phase) combination
 * - Enforces max-3-per-cell constraint visually
 * - Shows empty state when no moments with helpful hints
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

  return (
    <div
      className={cn(
        "min-h-[240px] p-4 rounded-lg",
        "transition-all",
        "focus-within:outline-none",
        "cursor-pointer",
        // Phase-based gradient background
        phaseBackgrounds[phaseIndex],
        // Minimal border
        "border border-stone-200/60 dark:border-stone-700/40",
        // Cell focus ring (violet for timeline navigation)
        isCellFocused && getFocusRingClasses("cell"),
        // Full state - thicker left border
        isFull && "border-l-4 border-l-stone-400 dark:border-l-stone-500"
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
      {cellMoments.length > 0 ? (
        <div className="flex flex-col" style={{ gap: momentCard.gap }}>
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
        </div>
      ) : (
        <div className="flex items-center justify-center h-full min-h-[192px]">
          <p className="text-sm text-stone-400 dark:text-stone-600 font-mono">
            Empty
          </p>
        </div>
      )}
      {isFull && (
        <output
          className="text-xs text-stone-500 dark:text-stone-500 font-mono mt-3 flex items-center gap-2"
          aria-live="polite"
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500"
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
