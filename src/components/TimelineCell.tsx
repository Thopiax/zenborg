/** biome-ignore-all lint/a11y/useSemanticElements: <explanation> */
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
import { useMomentManager } from "@/contexts/MomentManagerContext";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";
import { selectionState$ } from "@/infrastructure/state/selection";
import {
  areas$,
  moments$,
  unallocatedMoments$,
} from "@/infrastructure/state/store";
import {
  drawingBoardExpanded$,
  isDuplicateMode$,
} from "@/infrastructure/state/ui-store";
import {
  ariaLabels,
  momentCard,
  momentConstraints,
  phaseBackgrounds,
} from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import type { DropTargetType } from "@/types/dnd";
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
  dayLabel,
  phaseLabel,
  phaseIndex = 0,
}: TimelineCellProps) {
  const allMoments = use$(moments$);
  const allAreas = use$(areas$);
  const unallocated = use$(unallocatedMoments$);
  const { handleOpenCreateModal } = useMomentManager();

  // Get moments for this cell
  const cellMoments: Moment[] = Object.values(allMoments)
    .filter((m) => m.day === day && m.phase === phase)
    .sort((a, b) => a.order - b.order);

  const isFull = cellMoments.length >= 3;

  // Droppable configuration
  const { setNodeRef, isOver } = useDroppable({
    id: `timeline-${day}-${phase}`,
    data: {
      targetType: "timeline-cell" as DropTargetType,
      targetDay: day,
      targetPhase: phase,
    },
  });

  // Check if current drop would be valid
  const wouldAcceptDrop = !isFull; // Simple check for now, validation happens in DnDProvider

  // Handle empty cell click - opens Drawing Board or create modal
  const handleEmptyCellClick = () => {
    handleOpenCreateModal(day, phase, undefined, "this-week");
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
      ref={setNodeRef}
      className={cn(
        // Height: flexible to fill available space, with flex layout to distribute cards
        "h-full flex flex-col min-h-[240px]",
        "p-2 rounded-md",
        "transition-all",
        "focus-within:outline-none shadow-inner",
        // Phase-based gradient background
        "md:p-2.5",
        phaseBackgrounds[phaseIndex],
        // Drag hover states
        isOver &&
          wouldAcceptDrop &&
          "ring-2 ring-slate-400 dark:ring-slate-300",
        isOver && !wouldAcceptDrop && "ring-2 ring-red-400 dark:ring-red-500"
      )}
      data-cell={`${day}-${phase}`}
      aria-label={cellLabel}
      aria-live={isFull ? "polite" : "off"}
      aria-atomic="true"
    >
      <div className="flex-1 flex flex-col justify-start">
        {cellMoments.length > 0 ? (
          <SortableContext
            items={cellMoments.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col" style={{ gap: momentCard.gap }}>
              {cellMoments.map((moment) => {
                // Get area from the extracted values (use$ already unwrapped it)
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
          </SortableContext>
        ) : (
          /* Empty state - clickable to open Drawing Board */
          <button
            type="button"
            onClick={handleEmptyCellClick}
            className="flex items-center justify-center h-full w-full rounded-md transition-colors cursor-pointer group"
            aria-label={`add moment to ${phaseLabel || phase}`}
          >
            <span className="text-slate-800 dark:text-slate-100 text-3xl opacity-70 md:opacity-0 group-hover:opacity-70 transition-opacity gap-2 flex items-center">
              +
            </span>
          </button>
        )}
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

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    // Kanban style: original disappears on move, stays visible on duplicate/multi-select
    opacity: isDragging && !shouldDisableSortable ? 0 : 1,
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
