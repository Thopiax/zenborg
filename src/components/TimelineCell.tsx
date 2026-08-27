/** biome-ignore-all lint/a11y/useSemanticElements: a grid cell that is also a drop target, which no single semantic element covers */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: pointer handlers implement dragging; keyboard access lives on the wrapping control */
/** biome-ignore-all lint/a11y/useAriaPropsSupportedByRole: the role is set dynamically on the same element, which the rule does not follow */
"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { use$ } from "@legendapp/state/react";
import type { Area } from "@/domain/entities/Area";
import { DAY_VIEW_PHASE_CAPACITY, type Moment } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";
import { PhaseIcon } from "@/domain/value-objects/phaseStyles";
import { selectionState$ } from "@/infrastructure/state/selection";
import { areas$, moments$ } from "@/infrastructure/state/store";
import {
  isDuplicateMode$,
  openMomentFormCreate,
} from "@/infrastructure/state/ui-store";
import {
  ariaLabels,
  momentCard,
  momentConstraints,
  phaseBackgrounds,
  timelineCell,
  zIndex,
} from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import type { DropTargetType } from "@/types/dnd";
import { MomentCard } from "./MomentCard";

interface TimelineCellProps {
  day: string; // ISO date
  phase: Phase;
  isHighlighted?: boolean; // True for "Today" column
  isActivePhase?: boolean; // True for current phase on active day
  dayLabel?: string; // "Yesterday", "Today", "Tomorrow"
  phaseLabel?: string; // "Morning", "Afternoon", etc.
  phaseIndex?: number; // Phase row index for alternating greyscale tints (0, 1, 2)
}

// The day view's cell capacity. Display-only: the data layer accepts more,
// and the excess surfaces in the zoomed-in (time-blocked) view.
export const MAX_MOMENTS_PER_CELL = DAY_VIEW_PHASE_CAPACITY;

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
  isActivePhase,
  dayLabel,
  phaseLabel,
  phaseIndex = 0,
}: TimelineCellProps) {
  const allMoments = use$(moments$);
  const allAreas = use$(areas$);

  // Get moments for this cell
  const cellMoments: Moment[] = Object.values(allMoments)
    .filter((m) => m.day === day && m.phase === phase)
    .sort((a, b) => a.order - b.order);

  // Droppable configuration
  const { setNodeRef, isOver } = useDroppable({
    id: `timeline-${day}-${phase}`,
    data: {
      targetType: "timeline-cell" as DropTargetType,
      targetDay: day,
      targetPhase: phase,
    },
  });

  // Handle empty cell click - always opens modal
  const handleEmptyCellClick = () => {
    openMomentFormCreate({
      day,
      phaseStr: phase,
      phase: phase as Phase,
    });
  };

  // Generate accessible label
  const cellLabel =
    dayLabel && phaseLabel
      ? ariaLabels.timelineCell(
          dayLabel,
          phaseLabel,
          cellMoments.length,
          momentConstraints.maxMomentsPerCell,
        )
      : `${day} ${phase}, ${cellMoments.length} of ${momentConstraints.maxMomentsPerCell} moments`;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-h-[240px] h-full relative",
        "p-2 pb-8 rounded-md",
        // Only transition visual cues — never layout/transform (which fights dnd-kit)
        "transition-colors transition-shadow duration-fast transition-smooth",
        "focus-within:outline-none",
        // Flat at rest: depth is the tonal step below, never blur or shadow.
        // Phase-based tonal background
        "md:p-2.5",
        phaseBackgrounds[phaseIndex],
        // Active phase indicator (current phase on active day)
        isActivePhase && "ring-1 ring-stone-400/50",
        // Drag hover state
        isOver && "ring-2 ring-slate-400 dark:ring-slate-300",
      )}
      data-cell={`${day}-${phase}`}
      aria-label={cellLabel}
      aria-live="off"
      aria-atomic="true"
    >
      <div
        className="overflow-y-auto overscroll-contain"
        style={{ maxHeight: timelineCell.viewportHeight }}
      >
        {cellMoments.length > 0 && (
          <SortableContext
            items={cellMoments.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col" style={{ gap: momentCard.gap }}>
              {cellMoments.map((moment) => {
                const area = allAreas[moment.areaId];
                if (!area) return null;

                return (
                  <SortableMomentCard
                    key={moment.id}
                    moment={moment}
                    area={area}
                    contextMomentIds={cellMoments.map((m) => m.id)}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleEmptyCellClick}
              className="flex-1 flex items-center justify-center min-h-[48px] rounded-md cursor-pointer text-stone-500 dark:text-stone-400 opacity-30 hover:opacity-70 transition-opacity"
              aria-label={`add moment to ${phaseLabel || phase}`}
            >
              <span className="text-2xl">+</span>
            </button>
          </SortableContext>
        )}

        {cellMoments.length === 0 && (
          <button
            type="button"
            onClick={handleEmptyCellClick}
            className="flex items-center justify-center h-full w-full min-h-[120px] rounded-md cursor-pointer text-stone-500 dark:text-stone-400 opacity-30 hover:opacity-70 transition-opacity"
            aria-label={`add moment to ${phaseLabel || phase}`}
          >
            <span className="text-3xl">+</span>
          </button>
        )}
      </div>

      {/* Phase icon -- fixed at the cell bottom, above the scroll content */}
      <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center pointer-events-none z-20">
        <PhaseIcon
          phase={phase}
          className={cn(
            "text-stone-800 dark:text-stone-100 w-4 h-4 md:w-5 md:h-5",
            isActivePhase ? "opacity-80" : "opacity-50",
          )}
        />
      </div>
    </div>
  );
}

/**
 * SortableMomentCard - Wrapper that combines sortable and draggable behavior
 *
 * This component wraps MomentCard with useSortable to enable:
 * - Reordering within the same cell (sortable)
 * - Dragging to other cells or drawing board (draggable)
 */
interface SortableMomentCardProps {
  moment: Moment;
  area: Area;
  contextMomentIds?: string[];
}

function SortableMomentCard({
  moment,
  area,
  contextMomentIds,
}: SortableMomentCardProps) {
  const isDuplicateMode = use$(isDuplicateMode$);
  const selectedMomentIds = use$(selectionState$.selectedMomentIds);

  // Disable sortable behavior if:
  // 1. In duplicate mode, OR
  // 2. This moment is part of a multi-selection (prevents reorder conflicts)
  const isPartOfMultiSelection =
    selectedMomentIds.includes(moment.id) && selectedMomentIds.length > 1;
  const shouldDisableSortable = isDuplicateMode || isPartOfMultiSelection;

  // Always use useSortable, disable sorting behavior when needed
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
      sourceType: "timeline" as const,
      sourceDay: moment.day ?? undefined,
      sourcePhase: moment.phase ?? undefined,
      sourceOrder: moment.order,
    },
    disabled: shouldDisableSortable,
    transition: shouldDisableSortable ? null : undefined,
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    transition: transition ?? undefined,
    opacity: isDragging && !shouldDisableSortable ? 0 : 1,
    touchAction: "none" as const,
    cursor: isDragging ? "grabbing" : "grab",
    zIndex: isDragging ? zIndex.dragOverlay : 1,
    willChange: isDragging ? "transform" : undefined,
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
